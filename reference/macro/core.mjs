import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import crypto from "node:crypto";
export const root=process.env.REAL_ESTATE_PROJECT_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
export const dataPath=path.join(root,"Output/macro/observations.json");
export const config=JSON.parse(await fs.readFile(path.join(root,"reference/macro/config.json"),"utf8"));
const statuses=new Set(["observed","model","indexed","derived","conflict","proxy"]);
const stable=x=>x&&typeof x==="object"?Array.isArray(x)?x.map(stable):Object.fromEntries(Object.keys(x).sort().filter(k=>k!=="accessed_at").map(k=>[k,stable(x[k])])):x;
const digest=o=>crypto.createHash("sha256").update(JSON.stringify(stable(o))).digest("hex").slice(0,20);
export function calc(c){const a=c.inputs;if(c.op==="ratio")return a[0]/a[1];if(c.op==="growth")return a[0]/a[1]-1;if(c.op==="sum")return a.reduce((x,y)=>x+y,0);if(c.op==="index_to_growth")return a[0]/100-1;throw Error("未知算式");}
export function validate(data){
 if(!Array.isArray(data.observations)||!/^\d{4}-\d{2}-\d{2}$/.test(data.as_of))throw Error("缺少观测数组或截止日");
 for(const [i,o]of data.observations.entries()){
 const fail=t=>{throw Error("观测"+i+": "+t);};
 const m=config.metrics.find(m=>m.id===o.metric);
 if(!config.cities.some(c=>c.id===o.city)||!m||!config.sources.some(s=>s.id===o.source_id))fail("未知城市、指标或来源");
 if(m.unit!==o.unit)fail("单位不匹配");
 if(typeof o.value!=="number"||!Number.isFinite(o.value))fail("缺失值不得用文字或零冒充");
 if(!o.period||!o.geography||!statuses.has(o.status)||!["include","exclude"].includes(o.selection))fail("口径或状态缺失");
 for(const d of [o.period_end,o.accessed_at])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d)))fail("日期无效");
 if(o.period_end>data.as_of||o.accessed_at>data.as_of)fail("不可把未来观测作为实际值");
 if(o.published_at&&o.published_at>data.as_of)fail("未来发布日");
 if((o.unit==="years"||o.unit==="months")&&o.value<=0)fail("比值必须为正");
 if(["vacancy","unemployment","mortgage_rate"].includes(o.metric)&&(o.value<0||o.value>1))fail("百分比用小数0–1");
 if(o.unit==="count"&&(o.value<0||!Number.isInteger(o.value)))fail("套数需为非负整数");
 if(o.calculation){
 if(!Array.isArray(o.calculation.inputs)||!o.calculation.inputs.every(Number.isFinite))fail("算式输入无效");
 const v=calc(o.calculation);if(!Number.isFinite(v)||Math.abs(v-o.value)>1e-9*Math.max(1,Math.abs(v)))fail("推导值不匹配");
 }
 }
 return data;
}
export function merge(old,batch){
 validate(batch);validate(old);
 const seen=new Set(old.observations.map(digest));
 const additions=batch.observations.filter(o=>{const k=digest(o);if(seen.has(k))return false;seen.add(k);return true;});
 return {data:{...old,as_of:[old.as_of,batch.as_of].sort().at(-1),observations:[...old.observations,...additions]},added:additions.length};
}
export function select(data,city,metric){
 const all=data.observations.map((o,index)=>({...o,index})).filter(o=>o.city===city&&o.metric===metric);
 if(!all.length)return null;
 const latest=all.map(o=>o.period_end).sort().at(-1);
 let rows=all.filter(o=>o.period_end===latest);
 const accessed=rows.map(o=>o.accessed_at).sort().at(-1);
 rows=rows.filter(o=>o.accessed_at===accessed);
 if(rows.some(o=>o.status==="conflict"))return null;
 rows=rows.filter(o=>o.selection==="include");
 if(!rows.length)return null;
 if(new Set(rows.map(o=>JSON.stringify([o.value,o.geography,o.basis,o.source_id]))).size>1)return null;
 return rows.at(-1);
}
export const keyMetrics=["price_rent_centre","price_income","vacancy","price_yoy","new_area_yoy","completion_yoy","net_migration","population_yoy","mortgage_rate","rent_yoy","transaction_yoy","inventory_months"];
export function gaps(data){return config.cities.flatMap(c=>keyMetrics.filter(m=>!select(data,c.id,m)).map(m=>({city:c.name,metric:config.metrics.find(x=>x.id===m).name,reason:data.observations.some(o=>o.city===c.id&&o.metric===m&&o.status==="conflict")?"同期间来源冲突，暂停选入":"尚无可靠且同口径的观测"})));}
export async function read(){return validate(JSON.parse(await fs.readFile(dataPath,"utf8")));}
export async function ingest(batchPath){
 const old=await read(),batch=JSON.parse(await fs.readFile(batchPath,"utf8")),result=merge(old,batch);
 if(!result.added)return {added:0,total:old.observations.length};
 const stamp=new Date().toISOString().replaceAll(":","-");
 await fs.mkdir(path.join(root,"Output/macro/history"),{recursive:true});
 await fs.writeFile(path.join(root,"Output/macro/history",stamp+"-before.json"),JSON.stringify(old,null,2));
 await fs.writeFile(path.join(root,"Output/macro/history",stamp+"-batch.json"),JSON.stringify(batch,null,2));
 const tmp=dataPath+".tmp";await fs.writeFile(tmp,JSON.stringify(result.data,null,2));await fs.rename(tmp,dataPath);
 return {added:result.added,total:result.data.observations.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const command=process.argv[2]||"validate";
 if(command==="ingest"){if(!process.argv[3])throw Error("用法: core.mjs ingest batch.json");console.log(JSON.stringify(await ingest(process.argv[3])));}
 else if(command==="validate"){const d=await read();console.log(JSON.stringify({valid:true,observations:d.observations.length,cities:config.cities.length,gaps:gaps(d).length}));}
 else if(command==="test"){
 const assert=(await import("node:assert/strict")).default;const d=await read(),o=d.observations[0];
 assert.equal(merge(d,d).added,0);
 assert.throws(()=>validate({...d,observations:[{...o,unit:"wrong"}]}));
 assert.throws(()=>validate({...d,observations:[{...o,value:null}]}));
 assert.throws(()=>validate({...d,observations:[{...o,period_end:"2099-01-01"}]}));
 assert.equal(select(d,"amsterdam","price_yoy"),null);
 assert.equal(select(d,"berlin","new_area_yoy"),null);
 const older={...o,value:999,period:"2020",period_end:"2020-12-31"};
 const x=merge(d,{as_of:d.as_of,observations:[older]}).data;assert.equal(select(x,o.city,o.metric).value,o.value);
 assert.equal(calc({op:"growth",inputs:[110,100]}),110/100-1);
 assert.equal(merge(d,{as_of:d.as_of,observations:[o,o]}).added,0);
 console.log("PASS: 9 checks (idempotence, units, missing, future, conflicts, gaps, chronology, arithmetic, duplicates)");
 }else throw Error("未知命令");
}
