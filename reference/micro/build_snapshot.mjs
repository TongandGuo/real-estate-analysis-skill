import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
let artifactTool;
try {
  artifactTool = await import("@oai/artifact-tool");
} catch {
  const bundled = process.env.REAL_ESTATE_ARTIFACT_TOOL_PATH
    || path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime",
      "dependencies", "node", "node_modules", "@oai", "artifact-tool", "dist", "artifact_tool.mjs");
  artifactTool = await import(pathToFileURL(bundled).href);
}
const { Workbook, SpreadsheetFile } = artifactTool;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "Output", "2026-10-04_柏林Mitte_2010后住宅");
const snapshot = JSON.parse(await fs.readFile(path.join(dir, "listings.json"), "utf8"));
const rows = snapshot.records.filter(x => x.year_built > snapshot.criteria.min_year_built_exclusive && x.area_sqm > snapshot.criteria.min_area_sqm_exclusive).sort((a,b) => a.price_eur-b.price_eur || a.id.localeCompare(b.id));
const ids = new Set(rows.map(x => x.id));
if (ids.size !== rows.length || rows.length !== snapshot.records.length) throw new Error("Duplicate or out-of-scope listing");
const year = Number(snapshot.observed_on.slice(0,4));
const coverageComplete = snapshot.coverage_status === "complete";
const wb = Workbook.create();
const ws = wb.worksheets.add("Mitte候选");
ws.showGridLines = false;
ws.tabColor = "#17365D";
ws.getRange("A2").values = [[coverageComplete ? "柏林 Mitte｜已完成平台覆盖核验" : "柏林 Mitte｜已核实子集（非全量）"]];
ws.getRange("A2").format.font = {name:"Arial",size:15,bold:true,color:"#17365D"};
ws.getRange("A3").values = [["行政区 Mitte（含 Mitte、Tiergarten、Moabit 等）；建筑实际建造年 > 2010，居住面积 > 40 m²，不限价格。记录日："+snapshot.observed_on]];
ws.getRange("A4").values = [[coverageComplete ? "覆盖状态见 report.md / coverage.json；页面可见不等于实际可售。" : "覆盖未完成：ImmoScout24 和 Immowelt 的筛选结果未能全部翻页。此表仅列已核实子集；详情见 report.md / coverage.json。"]];
ws.getRange("A5:D5").values = [["统计年",year,"Mitte冷租基准 €/m²/月",snapshot.rent_benchmark_eur_sqm_month]];
ws.getRange("E5").values = [["租金基准：IBB 2025；非具体房源合法租金"]];
const headers=["房源ID","街区","位置","项目/简述","建造年","房龄 年","面积 m²","挂牌价 €","单价 €/m²","房间","Hausgeld €/月","买方佣金","车位另付 €","车位条件","占用/交付","年毛租售比情景","房源链接","待核事项","平台","记录日"];
ws.getRange("A7:T7").values = [headers];
ws.getRange("A7:T7").format = {fill:"#17365D",font:{name:"Arial",size:10,bold:true,color:"#FFFFFF"},rowHeight:30,verticalAlignment:"center",horizontalAlignment:"center"};
if (rows.length) {
  const values=rows.map(x=>[x.id,x.quarter,x.address,x.project,x.year_built,null,x.area_sqm,x.price_eur,null,x.rooms,x.housegeld_eur_month,x.buyer_commission_pct===null?null:x.buyer_commission_pct/100,x.parking_eur,x.parking_condition,x.occupancy,null,x.url,x.note,x.platform,snapshot.observed_on]);
  ws.getRangeByIndexes(7,0,values.length,20).values=values;
  for(let i=0;i<values.length;i++){
    const n=i+8;
    ws.getRange("F"+n).formulas=[["=$B$5-E"+n]];
    ws.getRange("I"+n).formulas=[["=H"+n+"/G"+n]];
    ws.getRange("P"+n).formulas=[["=G"+n+"*$D$5*12/H"+n]];
  }
  const end=7+rows.length;
  ws.getRange("G8:G"+end).setNumberFormat("0.00");
  ws.getRange("H8:I"+end).setNumberFormat("#,##0");
  ws.getRange("K8:K"+end).setNumberFormat("#,##0.00");
  ws.getRange("L8:L"+end).setNumberFormat("0.00%");
  ws.getRange("M8:M"+end).setNumberFormat("#,##0");
  ws.getRange("P8:P"+end).setNumberFormat("0.00%");
  ws.getRange("A8:T"+end).format.font={name:"Arial",size:10,color:"#1F2937"};
  ws.getRange("F8:F"+end).format.fill="#EFF6FF";
  ws.getRange("I8:I"+end).format.fill="#EFF6FF";
  ws.getRange("P8:P"+end).format.fill="#EFF6FF";
}
for(const [col,width] of Object.entries({A:43,B:19,C:39,D:31,E:14,F:12,G:14,H:16,I:16,J:10,K:19,L:15,M:16,N:35,O:25,P:21,Q:68,R:75,S:20,T:15})){
  ws.getRange(col+":"+col).format.columnWidth=width;
}
ws.getRange("A3:T5").format.font={name:"Arial",size:10,color:"#475569"};
ws.freezePanes.freezeRows(7);
wb.recalculate();
const errors=await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:30},maxChars:3000});
console.log("formula_errors",errors.ndjson);
console.log("first_rows",ws.getRange("E8:P10").values);
const preview=path.join(os.tmpdir(),"mitte_snapshot_preview");
await fs.mkdir(preview,{recursive:true});
for(const [range,name] of [["A1:J18","left.png"],["K7:T18","right.png"]]){
  const blob=await wb.render({sheetName:"Mitte候选",range,scale:1,format:"png"});
  await fs.writeFile(path.join(preview,name),new Uint8Array(await blob.arrayBuffer()));
}
const file=path.join(dir,"Mitte房源筛选.xlsx");
await (await SpreadsheetFile.exportXlsx(wb)).save(file);
await fs.rm(file+".inspect.ndjson",{force:true});
const cols=["id","quarter","address","project","year_built","area_sqm","price_eur","price_per_sqm_eur","rooms","housegeld_eur_month","buyer_commission_pct","parking_eur","parking_condition","occupancy","gross_yield_scenario_pct","platform","url","note","observed_on"];
function csvCell(value){const s=String(value??"");return '"'+s.replaceAll('"','""')+'"';}
const csv=[cols.join(","),...rows.map(x=>cols.map(k=>csvCell(k==="price_per_sqm_eur"?Math.round(x.price_eur/x.area_sqm*100)/100:k==="gross_yield_scenario_pct"?Math.round(x.area_sqm*snapshot.rent_benchmark_eur_sqm_month*12/x.price_eur*10000)/100:k==="observed_on"?snapshot.observed_on:x[k])).join(","))].join("\r\n")+"\r\n";
await fs.writeFile(path.join(dir,"listings.csv"),"\uFEFF"+csv,"utf8");
console.log("saved",file,"rows",rows.length);


