"""Local, append-only Berlin listing registry. No network calls."""
from __future__ import annotations
import argparse
import json
import os
import shutil
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "Output" / "micro"
LISTINGS = DATA / "listings.json"
HISTORY = DATA / "observations.jsonl"
RENT = DATA / "rent_benchmarks.json"
REQUIRED = ("id", "city", "district", "project", "unit", "platform", "url",
            "price_eur", "area_sqm", "rooms", "observed_on")

def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)

def year_status(row, criteria):
    """Actual construction year takes precedence over a proposed completion year."""
    cutoff = criteria["min_year_built_exclusive"]
    actual = row.get("year_built")
    if actual is not None:
        return "已建-符合" if actual > cutoff else "不符合-建造年"
    planned = row.get("planned_completion_year")
    if planned is not None and planned > cutoff:
        return "期房-待交付"
    return "建造年待核"

def validate(row, criteria):
    absent = [key for key in REQUIRED if key not in row or row[key] is None or row[key] == ""]
    if absent:
        raise ValueError(f"{row.get('id', '?')}: missing {', '.join(absent)}")
    if not isinstance(row["price_eur"], (int, float)) or isinstance(row["price_eur"], bool):
        raise ValueError(f"{row['id']}: price must be numeric")
    if not isinstance(row["area_sqm"], (int, float)) or isinstance(row["area_sqm"], bool):
        raise ValueError(f"{row['id']}: area must be numeric")
    if row["price_eur"] <= 0 or row["area_sqm"] <= 0:
        raise ValueError(f"{row['id']}: price and area must be positive")
    for key in ("year_built", "planned_completion_year"):
        value = row.get(key)
        if value is not None and (not isinstance(value, int) or isinstance(value, bool) or value < 1800 or value > date.today().year + 15):
            raise ValueError(f"{row['id']}: invalid {key}")
    date.fromisoformat(row["observed_on"])
    if row["city"] != criteria["city"]:
        return False
    if row["price_eur"] >= criteria["max_price_eur_exclusive"] or row["area_sqm"] <= criteria["min_area_sqm_exclusive"]:
        return False
    return year_status(row, criteria) != "不符合-建造年"

def history_rows():
    if not HISTORY.exists():
        return []
    return [json.loads(line) for line in HISTORY.read_text(encoding="utf-8-sig").splitlines() if line.strip()]

def append_history(rows):
    old = history_rows()
    key_fields = ("id", "observed_on", "price_eur", "area_sqm", "availability", "year_built", "planned_completion_year")
    keys = {tuple(r.get(k) for k in key_fields) for r in old}
    added = []
    for row in rows:
        h = {k: row.get(k) for k in (*key_fields, "url", "source_level", "eligible", "year_status", "sale_type")}
        key = tuple(h.get(k) for k in key_fields)
        if key not in keys:
            added.append(h)
            keys.add(key)
    if added:
        with HISTORY.open("a", encoding="utf-8", newline="\n") as stream:
            for row in added:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(added)

def ingest(batch: Path):
    current = read_json(LISTINGS)
    incoming = read_json(batch)
    if isinstance(incoming, dict):
        incoming = incoming.get("records", [])
    if not isinstance(incoming, list):
        raise ValueError("batch must be a JSON list or an object with records")
    criteria = current["criteria"]
    existing = {row["id"]: row for row in current["records"]}
    seen, observed = set(), []
    accepted = excluded = pending = 0
    for row in incoming:
        if row.get("id") in seen:
            raise ValueError(f"duplicate ID in batch: {row.get('id')}")
        seen.add(row.get("id"))
        eligible = validate(row, criteria)
        status = year_status(row, criteria)
        observed.append({**row, "eligible": eligible, "year_status": status})
        if eligible:
            existing[row["id"]] = {**existing.get(row["id"], {}), **row}
            accepted += 1
            if status == "建造年待核":
                pending += 1
        else:
            excluded += 1
            # Preserve the observation even when a unit leaves the current shortlist.
            existing.pop(row["id"], None)
    current["records"] = sorted(existing.values(), key=lambda r: (r["district"], r["price_eur"], r["id"]))
    if incoming:
        current["updated_on"] = max(current["updated_on"], *(r["observed_on"] for r in incoming))
    added = append_history(observed)
    write_json(LISTINGS, current)
    print(f"accepted={accepted} pending_year={pending} excluded={excluded} history_added={added} total={len(current['records'])}")

def verify():
    current = read_json(LISTINGS)
    ids = set()
    counts = {"已建-符合": 0, "期房-待交付": 0, "建造年待核": 0}
    for row in current["records"]:
        if row["id"] in ids:
            raise ValueError(f"duplicate ID: {row['id']}")
        ids.add(row["id"])
        if not validate(row, current["criteria"]):
            raise ValueError(f"out-of-criteria row: {row['id']}")
        counts[year_status(row, current["criteria"])] += 1
    rent = read_json(RENT)
    missing = sorted({row["district"] for row in current["records"] if row["district"] not in rent["districts"]})
    if missing:
        raise ValueError(f"missing rental benchmarks: {missing}")
    print(f"validated={len(ids)} status={counts} history={len(history_rows())}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("init-history", "ingest", "verify", "build"))
    parser.add_argument("--batch", type=Path)
    args = parser.parse_args()
    if args.action == "init-history":
        print(f"history_added={append_history(read_json(LISTINGS)['records'])}")
    elif args.action == "ingest":
        if not args.batch:
            parser.error("--batch is required for ingest")
        ingest(args.batch)
    elif args.action == "verify":
        verify()
    else:
        verify()
        node = os.environ.get("REAL_ESTATE_NODE_EXE")
        if not node:
            bundled = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"
            node = str(bundled) if bundled.exists() else shutil.which("node")
        if not node:
            raise FileNotFoundError("Node.js not found; set REAL_ESTATE_NODE_EXE")
        subprocess.run([str(node), str(Path(__file__).with_name("build_workbook.mjs"))], check=True)

if __name__ == "__main__":
    main()


