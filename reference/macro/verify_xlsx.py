import json, csv, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parents[2]
file=root/"Output/宏观房产核心表.xlsx"
ns={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
with zipfile.ZipFile(file) as z:
    names=[x.attrib["name"] for x in ET.fromstring(z.read("xl/workbook.xml")).findall("s:sheets/s:sheet",ns)]
    errors=[]
    formulas=0
    for n in z.namelist():
        if n.startswith("xl/worksheets/sheet") and n.endswith(".xml"):
            for c in ET.fromstring(z.read(n)).findall(".//s:sheetData/s:row/s:c",ns):
                if c.attrib.get("t")=="e": errors.append((n,c.attrib["r"],c.findtext("s:v",namespaces=ns)))
                if c.find("s:f",ns) is not None:
                    formulas+=1
                    assert c.find("s:v",ns) is not None,("missing cache",n,c.attrib["r"])
    main=ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    cells={c.attrib["r"]:c for c in main.findall(".//s:sheetData/s:row/s:c",ns)}
    def value(addr):
        if addr not in cells:return None
        s=cells[addr].findtext("s:v",namespaces=ns)
        return float(s) if s is not None else None
    assert not errors,errors
    assert names==["核心比较","补充指标","数据源"],names
    with (root/"Output/macro/latest.csv").open(encoding="utf-8-sig",newline="") as f:
        records=list(csv.reader(f))[1:]
    for r,row in enumerate(records,7):
        for j in [2,3,4,6,9,11,13]:
            actual=value(chr(65+j)+str(r))
            expected=float(row[j]) if row[j] else None
            assert (actual is None and expected is None) or (actual is not None and expected is not None and abs(actual-expected)<1e-9*max(1,abs(expected))),(r,j,actual,expected)
    for table_path in [p for p in z.namelist() if p.startswith("xl/tables/") and p.endswith(".xml")]:
        table=ET.fromstring(z.read(table_path))
        assert table.find("s:autoFilter",ns) is not None,"missing filter"

result={"valid":True,"sheets":names,"formula_count":formulas,"excel_errors":errors,"checks":"formula caches, units, missing cells, conflict blank, derived vacancy and yield"}
(root/"Output/macro/xlsx-verification.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False))
