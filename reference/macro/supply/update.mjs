import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const out = path.join(root, "Output", "supply");
const dbFile = path.join(out, "observations.json");
const logFile = path.join(out, "refresh_log.jsonl");
const cfg = JSON.parse(await fs.readFile(path.join(here, "config.json"), "utf8"));
const sourceMap = new Map([...cfg.annual_sources, ...cfg.snapshot_series, ...cfg.supplementary_sources].map(x => [x.id, x]));
const seriesMap = new Map([...cfg.annual_series, ...cfg.snapshot_series, ...cfg.supplementary_sources].map(x => [x.id, x]));

function berlinDay(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: cfg.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function assert(x, message) { if (!x) throw new Error(message); }
function parseCount(html, expected) {
  const h = html.match(/<h1\b[^>]*data-testid=["']serp-title-variant-a-testid["'][^>]*>([\s\S]*?)<\/h1>/i);
  assert(h, "Missing result heading; page may be blocked or changed");
  const plain = h[1].replace(/<[^>]*>/g, "").replace(/&nbsp;|&#160;/gi, " ").trim();
  const m = plain.match(/^([\d.,]+)\s+(.+)$/);
  assert(m && m[2] === expected, "Unexpected heading: " + plain);
  const value = Number(m[1].replace(/[.,]/g, ""));
  assert(Number.isSafeInteger(value) && value >= 0, "Invalid listing count");
  return value;
}
async function readDb() {
  try { return JSON.parse(await fs.readFile(dbFile, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return { schema_version: 1, updated_at: null, observations: [] }; throw e; }
}
function validateDb(db) {
  assert(db.schema_version === 1 && Array.isArray(db.observations), "Bad DB schema");
  const ids = new Set();
  for (const o of db.observations) {
    assert(seriesMap.has(o.series_id), "Unknown series " + o.series_id);
    assert(sourceMap.has(o.source_id), "Unknown source " + o.source_id);
    assert(Number.isSafeInteger(o.value) && o.value >= 0, "Invalid count for " + o.series_id);
    assert(/^\d{4}(-\d{2}-\d{2})?$/.test(o.period), "Invalid period for " + o.series_id);
    assert(typeof o.captured_at === "string" && !Number.isNaN(Date.parse(o.captured_at)), "Invalid capture date");
    assert(typeof o.method === "string", "Missing capture method");
    assert(typeof o.id === "string" && !ids.has(o.id), "Duplicate observation ID");
    ids.add(o.id);
    const annual = o.series_id.startsWith("ibb_");
    assert(annual === /^\d{4}$/.test(o.period), "Annual/snapshot period mismatch");
  }
}
async function saveDb(db) {
  validateDb(db);
  db.updated_at = new Date().toISOString();
  await fs.mkdir(out, { recursive: true });
  const temp = dbFile + ".next";
  await fs.writeFile(temp, JSON.stringify(db, null, 2) + "\n", "utf8");
  await fs.rename(temp, dbFile);
}
async function log(entry) {
  await fs.mkdir(out, { recursive: true });
  await fs.appendFile(logFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n", "utf8");
}
function latestByPeriod(rows) {
  const sorted = [...rows].sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  const byPeriod = new Map();
  for (const row of sorted) byPeriod.set(row.period, row);
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}
function annualRows(db, id) { return latestByPeriod(db.observations.filter(x => x.series_id === id)); }
function snapshotRows(db, id) { return db.observations.filter(x => x.series_id === id).sort((a, b) => a.captured_at.localeCompare(b.captured_at)); }
function changePct(current, prior) { return prior > 0 ? (current / prior - 1) * 100 : null; }
function fmt(n) { return new Intl.NumberFormat("zh-CN").format(n); }
function pct(n) { return n === null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%"; }
function esc(s) { return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function csvCell(v) { return '"' + String(v ?? "").replaceAll('"', '""') + '"'; }
function csv(headers, rows) { return "\uFEFF" + [headers.join(","), ...rows.map(r => headers.map(k => csvCell(r[k])).join(","))].join("\r\n") + "\r\n"; }

async function build(db) {
  validateDb(db);
  await fs.mkdir(out, { recursive: true });
  const apartments = annualRows(db, "ibb_apartment_ads_annual");
  const houses = annualRows(db, "ibb_house_ads_annual");
  const annualExport = [...apartments, ...houses].sort((a,b) => a.period.localeCompare(b.period) || a.series_id.localeCompare(b.series_id));
  const snapshots = db.observations.filter(x => !x.series_id.startsWith("ibb_")).sort((a,b) => a.captured_at.localeCompare(b.captured_at));
  await fs.writeFile(path.join(out, "annual.csv"), csv(["series_id","period","value","source_id","captured_at","method","note"], annualExport), "utf8");
  await fs.writeFile(path.join(out, "snapshots.csv"), csv(["series_id","period","value","source_id","captured_at","method","note"], snapshots), "utf8");

  const annualLines = apartments.map((a,i) => {
    const prev = i > 0 && Number(a.period) - Number(apartments[i-1].period) === 1 ? apartments[i-1] : null;
    return "| " + a.period + " | " + fmt(a.value) + " | " + (prev ? pct(changePct(a.value,prev.value)) : "—") + " | [" + a.source_id + "](" + sourceMap.get(a.source_id).url + ") |";
  });
  const houseLines = houses.map((a,i) => {
    const prev = i > 0 && Number(a.period) - Number(houses[i-1].period) === 1 ? houses[i-1] : null;
    return "| " + a.period + " | " + fmt(a.value) + " | " + (prev ? pct(changePct(a.value,prev.value)) : "—") + " | [" + a.source_id + "](" + sourceMap.get(a.source_id).url + ") |";
  });  const latestApartment = apartments.at(-1);
  const previousApartment = apartments.at(-2);
  const annualDirection = latestApartment && previousApartment && Number(latestApartment.period)-Number(previousApartment.period)===1
    ? "IBB 年度公寓挂牌广告数：" + previousApartment.period + " 年 " + fmt(previousApartment.value) + " 条，" + latestApartment.period + " 年 " + fmt(latestApartment.value) + " 条，变化 " + pct(changePct(latestApartment.value,previousApartment.value)) + "。"
    : "IBB 年度公寓挂牌广告数暂不足以判断最近同比。";

  const displaySnapshotSeries = [...cfg.snapshot_series, ...cfg.supplementary_sources];
  const latestHouse = houses.at(-1);
  const previousHouse = houses.at(-2);
  const houseDirection = latestHouse && previousHouse && Number(latestHouse.period)-Number(previousHouse.period)===1
    ? "一二户住宅挂牌广告数：" + previousHouse.period + " 年 " + fmt(previousHouse.value) + " 条，" + latestHouse.period + " 年 " + fmt(latestHouse.value) + " 条，变化 " + pct(changePct(latestHouse.value,previousHouse.value)) + "。"
    : "一二户住宅年度挂牌广告数暂不足以判断最近同比。";  const snapshotLines = displaySnapshotSeries.map(s => {
    const rows = snapshotRows(db,s.id);
    const latest = rows.at(-1);
    if (!latest) return "| " + s.label + " | — | — | 尚未采集 |";
    const prior = [...rows].reverse().find(x => x.method === latest.method && new Date(latest.captured_at)-new Date(x.captured_at) >= 28*86400000);
    const direction = prior ? pct(changePct(latest.value,prior.value)) + "（对比 " + prior.period + "）" : "仅有一次/不足 28 天，暂不能判断";
    return "| [" + s.label + "](" + s.url + ") | " + fmt(latest.value) + " | " + latest.period + " | " + direction + "（" + latest.method + "） |";
  });
  const report = [
    "# 柏林出售房产供给观察",
    "",
    "**更新日：" + berlinDay() + "。** " + annualDirection + " " + houseDirection,
    "",
    "## 年度挂牌广告量（IBB，柏林全市出售公寓）",
    "",
    "| 年度 | 广告数 | 同比 | 来源 |",
    "| --- | ---: | ---: | --- |",
    ...annualLines,
    "",
    "### 年度一二户住宅挂牌广告量",
    "",
    "| 年度 | 广告数 | 同比 | 来源 |",
    "| --- | ---: | ---: | --- |",
    ...houseLines,
    "",
    "这是 VALUE Marktdatenbank 经 IBB/RegioKontext 整理的一年内挂牌广告数量，不是某一天仍在售的库存，也不是新建竣工量。广告数不等于去重后的独立住房套数。",
    "",
    "## 公开平台即时搜索结果",
    "",
    "| 固定查询 | 最近数量 | 采集日 | 与可比快照相比 |",
    "| --- | ---: | --- | --- |",
    ...snapshotLines,
    "",
    "这里以 Immowelt 柏林全市的无价格、面积、建造年限制的公寓与房屋购买搜索为自动主源，Mitte 行政区公寓另列；以网页可见结果标题为准，不用 SEO 标题中的另一组数量。ImmoScout24 为网页索引辅助观测（web_indexed），不与直接 HTTP 抓取混接。平台计数可能包含项目展示、重复广告或下架延迟；只比较同一平台、同一搜索链接及同一采集方法的时间点，不与 IBB 年度量相加。少于两个相隔至少 28 天的可比快照时不输出即时供给方向。",
    "",
    "ImmoScout24 可作交叉核对，但当前直接 HTTP 返回 401/人机验证，不能作为自动更新的主源；不得绕过验证。IBB 年报发布后需人工核实当年公寓及一二户住宅广告数，再以来源链接导入。若某来源不可访问，保留旧观测并在 refresh_log.jsonl 记录失败。",
    "",
    "原始观测：[observations.json](observations.json)；导出：[annual.csv](annual.csv)、[snapshots.csv](snapshots.csv)。"
  ].join("\n") + "\n";
  await fs.writeFile(path.join(out, "report.md"), report, "utf8");

  const max = Math.max(1, ...apartments.map(x => x.value));
  const bars = apartments.map((a,i) => {
    const x=72+i*124, height=Math.round(a.value/max*190), y=238-height;
    return '<g><rect x="'+x+'" y="'+y+'" width="72" height="'+height+'" rx="4" fill="#2563eb"/><text x="'+(x+36)+'" y="'+(y-8)+'" text-anchor="middle" font-size="13" fill="#0f172a">'+fmt(a.value)+'</text><text x="'+(x+36)+'" y="260" text-anchor="middle" font-size="13" fill="#334155">'+a.period+'</text></g>';
  }).join("");
  const snapshotHtml = displaySnapshotSeries.map(s => {
    const x=snapshotRows(db,s.id).at(-1);
    return '<tr><td>'+esc(s.label)+'</td><td>'+esc(x?fmt(x.value):"—")+'</td><td>'+esc(x?x.period:"—")+'</td></tr>';
  }).join("");
  const html = [
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>柏林出售房产供给观察</title><style>body{font-family:Arial,system-ui,sans-serif;color:#0f172a;max-width:900px;margin:32px auto;padding:0 20px;line-height:1.6}h1{font-size:28px}h2{font-size:19px;margin-top:32px}p{max-width:780px}.muted{color:#475569}.card{background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:20px}table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border-bottom:1px solid #cbd5e1;text-align:left;padding:8px}td:nth-child(2){text-align:right}a{color:#1d4ed8}svg{max-width:100%;height:auto}</style>',
    '<h1>柏林出售房产供给观察</h1><p class="muted">更新日 '+berlinDay()+'。年度广告量与即时挂牌数量分别展示。</p>',
    '<div class="card"><strong>'+esc(annualDirection)+" "+esc(houseDirection)+'</strong></div>',
    '<h2>年度公寓挂牌广告量</h2><svg viewBox="0 0 600 280" role="img" aria-label="IBB 柏林出售公寓年度挂牌广告数量"><line x1="40" x2="580" y1="239" y2="239" stroke="#94a3b8"/>'+bars+'</svg>',
    '<p class="muted">IBB / VALUE 年度广告流量；不是某天在售库存，也不等于独立住房套数。</p>',
    '<h2>公开平台即时搜索结果</h2><table><thead><tr><th>固定查询</th><th>最近数量</th><th>日期</th></tr></thead><tbody>'+snapshotHtml+'</tbody></table>',
    '<p class="muted">每条即时序列需至少两次相隔 28 天的同口径观察才判断增减。平台间不相加。来源、完整口径和缺口见 <a href="report.md">报告</a>；原始数据见 <a href="observations.json">数据库</a>。</p>',
    '</html>'
  ].join("");
  await fs.writeFile(path.join(out, "柏林出售房产供给.html"), html, "utf8");
  console.log("built", apartments.length, "annual apartment years,", snapshots.length, "snapshots");
}

async function refresh() {
  const db=await readDb(); validateDb(db);
  const successes=[], failures=[];
  for (const s of cfg.snapshot_series) {
    try {
      const response=await fetch(s.url,{headers:{"Accept-Language":"de-DE,de;q=0.9","User-Agent":"Mozilla/5.0"}});
      assert(response.ok, "HTTP " + response.status);
      const body=await response.text();
      const value=parseCount(body,s.heading);
      const captured_at=new Date().toISOString();
      const period=berlinDay(new Date(captured_at));
      const prior=snapshotRows(db,s.id).at(-1);
      if (!(prior && prior.period===period && prior.value===value)) {
        db.observations.push({id:s.id+"_"+captured_at,series_id:s.id,period,value,source_id:s.id,captured_at,method:"direct_public_html",note:"Visible search-result heading; unfiltered fixed URL"});
      }
      successes.push({series_id:s.id,value,period});
    } catch(e) {failures.push({series_id:s.id,error:String(e.message)});}
  }
  if (successes.length) await saveDb(db);
  await build(db);
  await log({action:"refresh",successes,failures});
  console.log(JSON.stringify({successes,failures}));
  if (failures.length) process.exitCode=1;
}
async function ingest(batchPath) {
  assert(batchPath,"Missing batch path");
  const batch=JSON.parse(await fs.readFile(batchPath,"utf8"));
  const list=Array.isArray(batch)?batch:batch.observations;
  assert(Array.isArray(list),"Batch needs observations array");
  const db=await readDb();
  const captured_at=new Date().toISOString();
  let added=0;
  for (const input of list) {
    const o={...input,captured_at:input.captured_at||captured_at};
    o.id=o.id||o.series_id+"_"+o.period+"_"+o.captured_at;
    assert(seriesMap.has(o.series_id) && sourceMap.has(o.source_id),"Unknown series/source");
    assert(o.method==="official_report" || o.method==="web_indexed" || o.method==="direct_public_html","Invalid method");
    assert(typeof o.note==="string","Missing note");
    if (!db.observations.some(x=>x.series_id===o.series_id&&x.period===o.period&&x.value===o.value&&x.source_id===o.source_id&&x.method===o.method)) {
      db.observations.push(o); added++;
    }
  }
  validateDb(db); if(added) await saveDb(db);
  await build(db); await log({action:"ingest",added,batch:path.basename(batchPath)});
  console.log("ingested",added);
}
function test() {
  const html='<h1 data-testid="serp-title-variant-a-testid">9.286 Wohnungen kaufen in Berlin</h1>';
  assert(parseCount(html,"Wohnungen kaufen in Berlin")===9286,"Count parser failed");
  let rejected=false; try {parseCount("<html>captcha</html>","Wohnungen kaufen in Berlin");} catch {rejected=true;}
  assert(rejected,"Challenge page must fail closed");
  assert(changePct(31312,28841)>8.5 && changePct(31312,28841)<8.6,"Growth test failed");
  console.log("supply tests passed");
}
const action=(process.argv[2]||"build").toLowerCase();
if(action==="test") test();
else if(action==="validate"){const db=await readDb();validateDb(db);console.log("valid",db.observations.length);}
else if(action==="build") await build(await readDb());
else if(action==="refresh") await refresh();
else if(action==="ingest") await ingest(process.argv[3]);
else throw new Error("Unknown action "+action);



