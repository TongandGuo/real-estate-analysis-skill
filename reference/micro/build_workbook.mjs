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
const out = path.join(root, "Output", "micro");
const db = JSON.parse(await fs.readFile(path.join(out, "listings.json"), "utf8"));
const rent = JSON.parse(await fs.readFile(path.join(out, "rent_benchmarks.json"), "utf8"));
const historyText = await fs.readFile(path.join(out, "observations.jsonl"), "utf8");
const history = historyText.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const cutoff = db.criteria.min_year_built_exclusive;
function yearStatus(x){
  if(Number.isInteger(x.year_built)) return x.year_built > cutoff ? "已建-符合" : "不符合-建造年";
  if(Number.isInteger(x.planned_completion_year) && x.planned_completion_year > cutoff) return "期房-待交付";
  return "建造年待核";
}
const rows = db.records.filter(x => x.city === db.criteria.city
  && x.price_eur < db.criteria.max_price_eur_exclusive
  && x.area_sqm > db.criteria.min_area_sqm_exclusive
  && yearStatus(x) !== "不符合-建造年")
  .sort((a,b) => {
    const rank = {"已建-符合":0,"期房-待交付":1,"建造年待核":2};
    return rank[yearStatus(a)] - rank[yearStatus(b)] || a.price_eur/a.area_sqm - b.price_eur/b.area_sqm;
  });
const counts = {"已建-符合":0,"期房-待交付":0,"建造年待核":0};
for(const x of rows) counts[yearStatus(x)]++;
const wb = Workbook.create();
const main = wb.worksheets.add("筛选结果");
const log = wb.worksheets.add("价格观察");
main.showGridLines = false;
log.showGridLines = false;
main.tabColor = "#17365D";
main.getRange("A2").values = [["柏林房源｜筛选结果"]];
main.getRange("A2").format.font = {name:"Arial",size:14,bold:true,color:"#17365D"};
main.getRange("A3").values = [["条件：建筑建造年 > 2010；挂牌房价 < €500,000；居住面积 > 40 m²；不限一手/二手。记录更新：" + db.updated_on]];
main.getRange("A4").values = [["期房仅按公布的预计交付年暂纳入；建造年未知者标为待核。租售比采用 IBB 区域冷租金中位数的毛收益情景，未扣成本。"]];
main.getRange("A5:H5").values = [["已建候选",counts["已建-符合"],"期房候选",counts["期房-待交付"],"年份待核",counts["建造年待核"],"统计年",Number(db.updated_on.slice(0,4))]];
main.getRange("A6").values = [["租金来源：IBB 2025，"+rent.source_url]];
const headers = ["ID","区","街区","项目","单元","位置","房价 €","面积 m²","单价 €/m²","建造年份","房龄 年","预计交付年","年份核验","销售类型","房间","租金基准 €/m²/月","估算月冷租 €","年毛租售比","房价/年租","交付","车位另购 €","来源级别","可售状态","记录日","房源链接","核验备注"];
main.getRange("A7:Z7").values = [headers];
main.getRange("A7:Z7").format = {fill:"#17365D",font:{name:"Arial",size:10,bold:true,color:"#FFFFFF"},rowHeight:30,verticalAlignment:"center",horizontalAlignment:"center"};
if(rows.length){
  const data = rows.map(x => [x.id,x.district,x.quarter,x.project,x.unit,(x.address||"")+" · "+(x.postcode||""),x.price_eur,x.area_sqm,null,x.year_built,null,x.planned_completion_year,yearStatus(x),x.sale_type||"待核",x.rooms,rent.districts[x.district],null,null,null,x.completion||"",x.parking_eur,x.source_level,x.availability,x.observed_on,x.url,x.note||""]);
  main.getRangeByIndexes(7,0,data.length,26).values = data;
  for(let i=0;i<data.length;i++){
    const n=i+8;
    main.getRange("I"+n).formulas = [["=G"+n+"/H"+n]];
    main.getRange("K"+n).formulas = [["=IF(J"+n+"=\"\",\"\",$H$5-J"+n+")"]];
    main.getRange("Q"+n).formulas = [["=H"+n+"*P"+n]];
    main.getRange("R"+n).formulas = [["=Q"+n+"*12/G"+n]];
    main.getRange("S"+n).formulas = [["=G"+n+"/(Q"+n+"*12)"]];
    if(yearStatus(rows[i])==="建造年待核") main.getRange("M"+n).format.fill="#FFF1CC";
  }
  const end=7+data.length;
  main.getRange("G8:G"+end).setNumberFormat("#,##0");
  main.getRange("H8:H"+end).setNumberFormat("0.00");
  main.getRange("I8:I"+end).setNumberFormat("#,##0");
  main.getRange("J8:L"+end).setNumberFormat("0");
  main.getRange("P8:Q"+end).setNumberFormat("0.00");
  main.getRange("R8:R"+end).setNumberFormat("0.00%");
  main.getRange("S8:S"+end).setNumberFormat("0.0");
  main.getRange("U8:U"+end).setNumberFormat("#,##0");
  main.getRange("A8:Z"+end).format.font={name:"Arial",size:10,color:"#1F2937"};
  main.getRange("I8:I"+end).format.fill="#EFF6FF";
  main.getRange("K8:K"+end).format.fill="#EFF6FF";
  main.getRange("Q8:S"+end).format.fill="#EFF6FF";
}
for(const [col,width] of Object.entries({A:43,B:26,C:17,D:25,E:26,F:39,G:14,H:12,I:16,J:14,K:12,L:16,M:19,N:21,O:10,P:23,Q:17,R:17,S:15,T:15,U:17,V:19,W:34,X:15,Y:68,Z:67})){
  main.getRange(col+":"+col).format.columnWidth=width;
}
main.getRange("A3:Z6").format.font={name:"Arial",size:10,color:"#475569"};
main.freezePanes.freezeRows(7);
log.getRange("A2").values=[["柏林房源｜价格与年份观察记录"]];
log.getRange("A2").format.font={name:"Arial",size:14,bold:true,color:"#17365D"};
log.getRange("A3").values=[["历史按观察日保留；早期记录未采集建造年时保持空白，不补造历史值。"]];
log.getRange("A5:I5").values=[["ID","观察日","挂牌价 €","面积 m²","建造年份","预计交付年","年份核验","页面状态","链接"]];
log.getRange("A5:I5").format={fill:"#17365D",font:{name:"Arial",size:10,bold:true,color:"#FFFFFF"},rowHeight:30,verticalAlignment:"center",horizontalAlignment:"center"};
if(history.length){
  const h=history.sort((a,b)=>b.observed_on.localeCompare(a.observed_on)||a.id.localeCompare(b.id));
  log.getRangeByIndexes(5,0,h.length,9).values=h.map(x=>[x.id,x.observed_on,x.price_eur,x.area_sqm,x.year_built,x.planned_completion_year,x.year_status||"",x.availability,x.url]);
  log.getRange("C6:C"+(5+h.length)).setNumberFormat("#,##0");
  log.getRange("D6:D"+(5+h.length)).setNumberFormat("0.00");
  log.getRange("E6:F"+(5+h.length)).setNumberFormat("0");
  log.getRange("A6:I"+(5+h.length)).format.font={name:"Arial",size:10,color:"#1F2937"};
}
for(const [col,width] of Object.entries({A:43,B:17,C:18,D:15,E:15,F:17,G:20,H:35,I:72})){
  log.getRange(col+":"+col).format.columnWidth=width;
}
log.freezePanes.freezeRows(5);
wb.recalculate();
const errors=await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:30},maxChars:3000});
console.log("formula_errors",errors.ndjson);
console.log("spot_check",main.getRange("G8:S9").values);
const tmp=path.join(os.tmpdir(),"real_estate_micro_preview");
await fs.mkdir(tmp,{recursive:true});
for(const [sheetName,range,name] of [["筛选结果","A1:O17","main-left.png"],["筛选结果","P7:Z17","main-right.png"],["价格观察","A1:I15","history.png"]]){
  const blob=await wb.render({sheetName,range,scale:1,format:"png"});
  await fs.writeFile(path.join(tmp,name),new Uint8Array(await blob.arrayBuffer()));
}
const xlsx=await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(path.join(out,"柏林房源筛选.xlsx"));
await fs.rm(path.join(out,"柏林房源筛选.xlsx.inspect.ndjson"),{force:true});
console.log("output",path.join(out,"柏林房源筛选.xlsx"),"rows",rows.length,"counts",counts);

