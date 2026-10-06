import fs from "node:fs/promises";
import path from "node:path";
import {Workbook,SpreadsheetFile} from "@oai/artifact-tool";
import {root,config,read,select,gaps,calc} from "./core.mjs";
const data=await read(),out=path.join(root,"Output"),macro=path.join(out,"macro");
const wb=Workbook.create(),sheets=[];
const sheetMap=Object.fromEntries(["核心比较","补充指标","数据源"].map(n=>[n,wb.worksheets.add(n)]));
const col=n=>{let x="";for(n++;n>0;n=Math.floor((n-1)/26))x=String.fromCharCode(65+(n-1)%26)+x;return x;};
function sheet(name,title,subtitle,headers,rows,widths){
 const s=sheetMap[name];sheets.push(s);s.showGridLines=false;
 const n=headers.length,last=6+rows.length;
 s.getRange("A1:"+col(n-1)+last).format={font:{name:"Microsoft YaHei",size:10,color:"#24364B"},rowHeight:42,verticalAlignment:"center"};
 s.getRange("A1:H1").format.rowHeight=10;s.getRange("A3:H4").format.rowHeight=20;s.getRange("A5:H5").format.rowHeight=10;
 s.getRange("A2:F2").merge();s.getRange("A2").values=[[title]];s.getRange("A2:F2").format={font:{size:19,bold:true,color:"#123B5D"},rowHeight:36};
 s.getRange("A3:H4").merge();s.getRange("A3").values=[[subtitle]];s.getRange("A3:H4").format={wrapText:true,font:{size:10,color:"#546477"}};
 s.getRange("A6:"+col(n-1)+"6").values=[headers];
 s.getRange("A6:"+col(n-1)+"6").format={fill:"#173F5F",font:{bold:true,color:"#FFFFFF"},wrapText:true,rowHeight:44};
 if(rows.length)s.getRange("A7:"+col(n-1)+last).values=rows;
 s.getRange("A7:"+col(n-1)+last).format.wrapText=true;
 for(let r=7;r<=last;r++){if(r%2===0)s.getRange("A"+r+":"+col(n-1)+r).format.fill="#F0F5F9";}
 for(let j=0;j<n;j++)s.getRange(col(j)+"1:"+col(j)+last).format.columnWidth=widths?.[j]||18;
 s.freezePanes.freezeRows(6);s.freezePanes.freezeColumns(2);
 if(rows.length){const table=s.tables.add("A6:"+col(n-1)+last,true,({"核心比较":"T2","补充指标":"T3","数据源":"T5"})[name]);table.style="TableStyleLight9";table.showFilterButton=true;}
 s.getRange("A7:"+col(n-1)+last).format.fill="#FFFFFF";
 for(let r=8;r<=last;r+=2)s.getRange("A"+r+":"+col(n-1)+r).format.fill="#F0F5F9";
 s.getRange("A6:"+col(n-1)+last).format.verticalAlignment="center";
 return s;
}
const fmt={ratio:"0.00%;[Red](0.00%);0.00%",years:"0.00",months:"0.0",persons:"#,##0;[Red](#,##0);0",count:"#,##0",index:"0.0","currency/m2":"#,##0"};
const labels={observed:"直接采集",model:"非官方模型",indexed:"官方/来源索引，待直连",derived:"计算值",conflict:"来源冲突",proxy:"区域代理"};
const metricName=id=>config.metrics.find(m=>m.id===id)?.name||id;
const source=id=>config.sources.find(s=>s.id===id);
const city=id=>config.cities.find(c=>c.id===id);
const drows=data.observations.map(o=>[city(o.city).country,city(o.city).name,metricName(o.metric),o.value,o.unit,o.period,o.geography,o.basis||"—",labels[o.status],o.selection==="include"?"可选（遵循期间/冲突规则）":"排除",source(o.source_id).name,source(o.source_id).tier,o.published_at||"未核实",o.accessed_at,source(o.source_id).url,o.calculation?.op||"",o.calculation?.inputs[0]??null,o.calculation?.inputs[1]??null,o.calculation?.inputs[2]??null]);
const pick=(c,m)=>select(data,c.id,m);
const val=(c,m)=>pick(c,m)?.value??null;
const period=(c,m)=>pick(c,m)?.period||"";
const desc=(c,m)=>{const o=pick(c,m);return o?[o.period,o.geography,o.basis].filter(Boolean).join("｜"):"未取得";};
const note=c=>{
 const arr=data.observations.filter(o=>o.city===c.id);const a=["估值为C级模型"];
 if(arr.some(o=>o.status==="conflict"))a.push("房价来源冲突");
 if(arr.some(o=>o.status==="indexed"))a.push("含索引待复核值");
 if(c.id==="tokyo")a.push("空置为东京都全域");
 if(c.id==="osaka")a.push("估值"+period(c,"price_rent_centre")+"；留意样本量");
 return a.join("；");
};
const mainRows=config.cities.map(c=>[c.country,c.name,val(c,"price_rent_centre")?1/val(c,"price_rent_centre"):null,val(c,"price_rent_centre"),val(c,"price_income"),period(c,"price_rent_centre"),val(c,"vacancy"),desc(c,"vacancy"),val(c,"price_yoy"),desc(c,"price_yoy"),val(c,"new_area_yoy"),val(c,"completion_yoy"),[period(c,"new_area_yoy"),period(c,"completion_yoy")].filter(Boolean).join(" / "),val(c,"net_migration"),period(c,"net_migration"),val(c,"population_yoy"),period(c,"population_yoy"),val(c,"mortgage_rate"),desc(c,"mortgage_rate"),note(c)]).map(row=>row.filter((_,i)=>i<8||i>11));
const main=sheet("核心比较","全球住宅市场 · 城市核心比较","截至 "+data.as_of+"｜20城；估值用Numbeo辅助模型，其他指标优先官方。空白=缺口；空置率口径不同不可直接排名。年毛租售比≈1/房价租金比，未扣成本。",["国家","城市","年毛租售比\n中心","房价租金比\n中心·年","房价收入比\n模型·年","估值数据期","住宅空置率","空置率期间与口径","供给统计期","净迁入\n人","净迁入统计期","人口同比","人口统计期","按揭利率\n参考","利率期间与适用范围","数据质量提示"],mainRows,[10,15,15,16,16,23,14,44,16,16,18,14,16,15,46,40]);
for(const j of [2,6,11,13])main.getRange(col(j)+"7:"+col(j)+"26").setNumberFormat(fmt.ratio);
for(const j of [3,4])main.getRange(col(j)+"7:"+col(j)+"26").setNumberFormat(fmt.years);
main.getRange("J7:J26").setNumberFormat(fmt.persons);main.getRange("A7:P26").format.rowHeight=58;
function link(s,r,cc,c,m){const o=pick(c,m);if(o)s.getRange(cc+r).values=[[o.value]];}
for(const [i,c]of config.cities.entries()){
 const r=i+7;for(const [cc,m]of [["D","price_rent_centre"],["E","price_income"],["G","vacancy"],["J","net_migration"],["L","population_yoy"],["N","mortgage_rate"]])link(main,r,cc,c,m);
 if(pick(c,"price_rent_centre"))main.getRange("C"+r).formulas=[["=1/D"+r]];
}
const suppRows=config.cities.map(c=>[c.country,c.name,val(c,"price_rent_outer")?1/val(c,"price_rent_outer"):null,val(c,"price_rent_outer"),val(c,"rent_yoy"),desc(c,"rent_yoy"),val(c,"new_price_yoy"),period(c,"new_price_yoy"),val(c,"completions"),period(c,"completions"),val(c,"population"),period(c,"population"),val(c,"population_change"),val(c,"price_sqm"),c.currency,period(c,"price_sqm"),val(c,"transaction_yoy"),desc(c,"transaction_yoy"),val(c,"completion_area_yoy"),period(c,"completion_area_yoy")]);
const supp=sheet("补充指标","租赁、供给与人口补充","估值外圈=Numbeo非中心区域；新房与二手房分开。人口总变动不可代替净迁入。价格保留当地币种与原始期间。",["国家","城市","年毛租售比\n非中心","房价租金比\n非中心·年","租金同比","租金期间与口径","新房价格同比","新房统计期","住宅竣工套数","竣工统计期","人口规模","人口统计期","人口总变动","住宅单价/㎡","币种","单价统计期","住宅成交量同比","成交量期间与口径","住宅竣工面积同比","竣工面积统计期"],suppRows,[10,15,17,18,15,50,18,18,18,18,18,18,18,18,12,18,18,50,20,24]);
for(const j of [2,4,6,16,18])supp.getRange(col(j)+"7:"+col(j)+"26").setNumberFormat(fmt.ratio);
for(const j of [8,10,12,13])supp.getRange(col(j)+"7:"+col(j)+"26").setNumberFormat(fmt.persons);
supp.getRange("D7:D26").setNumberFormat(fmt.years);supp.getRange("A7:T26").format.rowHeight=54;
for(const [i,c]of config.cities.entries()){
 const r=i+7;for(const [cc,m]of [["D","price_rent_outer"],["E","rent_yoy"],["G","new_price_yoy"],["I","completions"],["K","population"],["M","population_change"],["N","price_sqm"],["Q","transaction_yoy"],["S","completion_area_yoy"]])link(supp,r,cc,c,m);
 if(pick(c,"price_rent_outer"))supp.getRange("C"+r).formulas=[["=1/D"+r]];
}
sheet("数据源","来源登记与连接状态","A=官方；B=一手研究/调查；C=众包模型。当前接入方式为Codex网页采集+结构化入库，没有声称已建立无人值守API连接。",["来源ID","来源","等级","地域","数据频率","采集状态","访问方式","最后检查","原始链接","限制/后续工作"],config.sources.map(s=>[s.id,s.name,s.tier,s.scope,s.frequency,s.status,s.access_mode,s.last_checked||"待采集",s.url,s.notes]),[27,43,23,25,25,27,22,18,70,80]);
const gapRows=gaps(data).map(g=>[g.city,g.metric,g.reason,"按数据源登记优先补齐；禁止用全国值默认为城市值"]);
wb.recalculate();
await fs.mkdir(path.join(macro,"previews"),{recursive:true});
const inspections=[];
for(const s of sheets){
 inspections.push(await wb.inspect({kind:"table",range:s.name+"!A6:H10",include:"values,formulas",tableMaxRows:5,tableMaxCols:8,maxChars:4000}));
 const last=s.name==="核心比较"?12:11;
 const png=await wb.render({sheetName:s.name,range:"A1:H"+last,scale:1.3,format:"png"});
 await fs.writeFile(path.join(macro,"previews",s.name+".png"),new Uint8Array(await png.arrayBuffer()));
}
for(const [tag,range]of [["核心比较_需求融资","I6:P12"]]){
 const p=await wb.render({sheetName:"核心比较",range,scale:1.3,format:"png"});await fs.writeFile(path.join(macro,"previews",tag+".png"),new Uint8Array(await p.arrayBuffer()));
}
const errors=await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:100},maxChars:10000});
await fs.writeFile(path.join(macro,"validation.json"),JSON.stringify({generated_at:new Date().toISOString(),errors,inspections},null,2));
const file=await SpreadsheetFile.exportXlsx(wb);
const finalPath=path.join(out,"宏观房产核心表.xlsx"),tempPath=path.join(macro,"next.xlsx");
await file.save(tempPath);
try {await fs.copyFile(finalPath,path.join(macro,"history",new Date().toISOString().replaceAll(":","-")+"-before.xlsx"));}catch(e){if(e.code!=="ENOENT")throw e;}
await fs.rename(tempPath,finalPath);
const csv=v=>v==null?"":'"'+String(v).replaceAll('"','""')+'"';
const heads=["国家","城市","年毛租售比_中心","房价租金比_中心","房价收入比","估值数据期","空置率","空置口径","供给期","净迁入","净迁入期","人口同比","人口期","按揭参考","利率范围","提示"];
await fs.writeFile(path.join(macro,"latest.csv"),"\uFEFF"+[heads,...mainRows].map(r=>r.map(csv).join(",")).join("\r\n"));
await fs.writeFile(path.join(macro,"observations.csv"),"\uFEFF"+[["国家","城市","指标","数值","单位","期间","地域","口径","状态","选入","来源","等级","发布日期","访问日","链接","操作","输入1","输入2","输入3"],...drows].map(r=>r.map(csv).join(",")).join("\r\n"));
const conflictRows=data.observations.filter(o=>o.status==="conflict");
const modelPeriods=[...new Set(config.cities.map(c=>period(c,"price_rent_centre")).filter(Boolean))];
await fs.writeFile(path.join(macro,"latest-report.md"),"# 宏观房产数据表\n\n截至 "+data.as_of+"；覆盖"+config.cities.length+"城，仓库累计"+data.observations.length+"条观测（含历史、推导、区域代理和冲突值）。\n\n本表是宏观数据底座，不构成当前买入城市排名。中心年毛租售比=1/中心房价租金比；原比值有舍入，不代表实际净收益。估值采用Numbeo非官方统一模型，当前主表所用版次："+modelPeriods.join("、")+"。\n\n## 读取规则\n\n- 核心比较/补充指标：最新可选记录；数值留空意味着缺口或未解决冲突。\n- 原始观测保存在独立JSON/CSV中，保留期间、地域、计算链和来源；Excel仅保留核心比较、补充指标、数据源三个工作表。\n- 数据源：采集方式与连接状态；网页检索可用不等于API已联通。\n- 年度/普查数据保持原统计期；索引采集需要直连复核；空置类型不同不能排序。\n- 新开工面积、竣工面积、竣工套数分列；人口总变动与净迁入分列。\n- 区域按揭参考不是个人报价；缺少国家数据时保留代理标签。\n\n## 冲突记录（含历史）\n\n"+(conflictRows.map(o=>"- "+city(o.city).name+" "+metricName(o.metric)+" "+o.period+"："+o.value+"；"+o.basis+"；[来源]("+source(o.source_id).url+")").join("\n")||"无")+"\n\n## 待补齐\n\n"+gapRows.map(g=>"- "+g[0]+"："+g[1]+"（"+g[2]+"）").join("\n")+"\n\n优先级：先复核冲突与索引值，再补官方房价/租金趋势、住宅供给、净迁移、成交量和库存。\n");
console.log(JSON.stringify({file:path.join(out,"宏观房产核心表.xlsx"),sheets:sheets.length,observations:data.observations.length,gaps:gapRows.length,errors}));

