"""Validate observations and rebuild the offline trend dashboard."""
from pathlib import Path
import calendar,csv,datetime,json,math,re,statistics
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'Output/trends'
HERE=Path(__file__).parent
CITY=[('berlin','柏林','de_rate'),('munich','慕尼黑','de_rate'),('frankfurt','法兰克福','de_rate'),('nyc','纽约','us_rate'),('beijing','北京','cn_rate')]
def load(path): return json.loads(Path(path).read_text(encoding='utf-8-sig'))
def write_json(path,obj): Path(path).write_text(json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf8')
def position(per):
 if re.fullmatch(r'\d{4}',per):return int(per)+.5
 y=int(per[:4])
 if '-Q' in per:return y+(int(per[-1])-.5)/4
 if '-H1' in per:return y+.25
 if len(per)==7:return y+(int(per[5:7])-.5)/12
 d=datetime.date.fromisoformat(per); return y+(d-datetime.date(y,1,1)).days/(366 if y%4==0 else 365)
def validate(d):
 assert d['schema_version']==1
 cutoff=datetime.date.fromisoformat(d['updated_at'])
 today=cutoff.year+(cutoff-datetime.date(cutoff.year,1,1)).days/365.25
 warnings=[]
 for key,s in d['series'].items():
  assert s['metric'] in ['price','rate','volume']
  assert s['frequency'] in ['M','Q','A','H1','W','DEC']
  prev=None;seen=set()
  for p in s['points']:
   per=p['period'];assert per not in seen,(key,per,'duplicate');seen.add(per)
   assert p['source_id'] in d['sources'],(key,per,'source')
   assert math.isfinite(p['value']) and p['value']>0,(key,per,'value')
   pattern={'M':r'\d{4}-(0[1-9]|1[0-2])','DEC':r'\d{4}-12','Q':r'\d{4}-Q[1-4]','A':r'\d{4}','H1':r'\d{4}-H1','W':r'\d{4}-\d{2}-\d{2}'}[s['frequency']]
   assert re.fullmatch(pattern,per),(key,per,'invalid period')
   year=int(per[:4])
   month=12 if s['frequency'] in ('A','DEC') else 6 if s['frequency']=='H1' else int(per[-1])*3 if s['frequency']=='Q' else int(per[5:7])
   end=datetime.date.fromisoformat(per) if s['frequency']=='W' else datetime.date(year,month,calendar.monthrange(year,month)[1])
   assert end<=cutoff,(key,per,'future/incomplete period')
   x=position(per);assert x<=today,(key,per,'future')
   assert prev is None or x>prev,(key,per,'order');prev=x
  if s['metric']=='price':
   base=[p['value'] for p in s['points'] if p['period'].startswith('2015')]
   assert len(base)=={'Q':4,'M':12,'A':1}[s['frequency']],(key,'2015 incomplete')
  if s['frequency'] in ('M','Q','A','H1','DEC'):
   for a,b in zip(s['points'],s['points'][1:]):
    if position(b['period'])-position(a['period'])>{'M':.09,'Q':.26,'A':1.01,'H1':1.01,'DEC':1.01}[s['frequency']]:
     warnings.append(f"{key}: {a['period']} 至 {b['period']} 有缺口，图中断线")
 bj=d['series']['beijing_price']['points']
 for i,p in enumerate(bj):
  if i:
   prev=bj[i-1]['period'];expected_month=int(prev[:4])*12+int(prev[5:])+1
   assert int(p['period'][:4])*12+int(p['period'][5:])==expected_month,'Beijing chain must be continuous'
   assert abs(bj[i-1]['value']*p['mom_index']/100-p['value'])<1e-6,(p['period'],'chain mismatch')
  if i>=12 and p.get('official_yoy') is not None:
   diff=(p['value']/bj[i-12]['value']-1)*100-p['official_yoy']
   if abs(diff)>.8:warnings.append(f"北京{p['period']}链式同比与公布同比差{diff:.2f}个百分点，基期/舍入需注意")
 for key,src in d['sources'].items():assert src['url'].startswith('https://'),key
 return warnings
def enrich(d):
 for s in d['series'].values():
  base=statistics.mean(p['value'] for p in s['points'] if p['period'].startswith('2015')) if s['metric']=='price' else 1
  for p in s['points']:
   p['x']=position(p['period']);p['display']=p['value']/base*100 if s['metric']=='price' else p['value']
  pts=s['points'];last=pts[-1];peak=max(pts,key=lambda p:p['value']);low=min(pts,key=lambda p:p['value'])
  prior=str(int(last['period'][:4])-1)+last['period'][4:]
  other=next((p for p in pts if p['period']==prior),None)
  if s['frequency']=='W':
   target=datetime.date.fromisoformat(last['period'])-datetime.timedelta(days=364)
   other=min(pts,key=lambda p:abs((datetime.date.fromisoformat(p['period'])-target).days))
   if abs((datetime.date.fromisoformat(other['period'])-target).days)>7:other=None
  delta=None if other is None else (last['value']-other['value'] if s['metric']=='rate' else (last['value']/other['value']-1)*100)
  s['stats']={'last':last,'peak':peak,'low':low,'drawdown':(last['value']/peak['value']-1)*100,'change':delta,'comparison_period':None if other is None else other['period'],'base':base}
 return d
def fmt(x):return '暂无可比观测' if x is None else f'{x:+.1f}'
def build():
 d=load(OUT/'data.json');warnings=validate(d);enrich(d)
 reviewed=d.get('analysis',{}).get('reviewed_at','')
 insights=d.get('analysis',{}).get('city_notes',{})
 if reviewed!=d['updated_at']:
  insights={key:'数据已更新；市场解读仍待结合最新来源复核。不要沿用上次周期判断。' for key,_,_ in CITY}
 d['city_insights']=insights
 fields=['series_id','city','metric','period','value','unit','frequency','scope','source_id','source_url','accessed_at','note']
 with (OUT/'历史数据.csv').open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
  for key,s in d['series'].items():
   for p in s['points']:
    src=d['sources'][p['source_id']]
    w.writerow(dict(series_id=key,city=s['city'],metric=s['metric'],period=p['period'],value=p['value'],unit=s['unit'],frequency=s['frequency'],scope=s['scope'],source_id=p['source_id'],source_url=src['url'],accessed_at=src['accessed_at'],note=p.get('note','')))
 lines=['# 五城房产历史趋势分析',f"\n分析截止：{d['updated_at']}。各项最新统计期间分别标注，不能把旧年度数据视为当前月份。",'',
 '与 [宏观核心比较表](../宏观房产核心表.xlsx) 配合：静态表判断估值与区域条件，本报告观察本地价格、融资和交易活动的变化。',
 '\n## 读图方法','房价统一显示为2015年平均=100，只比较走势，不代表同等单价或投资回报。纽约采用成交中位价，其余城市为指数，不能据此直接排名。所有价格均为名义价格，未含租金、税费和通胀调整。',
 '房贷利率采用全国指标，三座德国城市共用同一条德国序列；中国使用每年12月观测而非年度均值。成交量保留原单位；慕尼黑只比较各年上半年。',
 '\n## 历史位置与最新观测','','| 城市 | 房价最新期 / 2015=100 | 距样本内高点 | 价格较上年同期 | 利率最新期 / % | 成交量最新期 / 原单位 |','|---|---|---|---|---|---|']
 for key,city,rate in CITY:
  p=d['series'][key+'_price']['stats'];r=d['series'][rate]['stats'];v=d['series'][key+'_volume']['stats']
  lines.append(f"|{city}|{p['last']['period']} / {p['last']['display']:.1f}|{p['drawdown']:+.1f}%|{fmt(p['change'])}%|{r['last']['period']} / {r['last']['value']:.2f}|{v['last']['period']} / {v['last']['value']:,.1f} {d['series'][key+'_volume']['unit']}|")
 for key,city,rate in CITY:
  lines+=['',f'## {city}','']
  for sk in [key+'_price',rate,key+'_volume']:
   s=d['series'][sk];st=s['stats'];p=st['last'];src=d['sources'][p['source_id']]
   unit='（2015年平均=100）' if s['metric']=='price' else s['unit']
   lines.append(f"- **{s['label']}**：{p['period']} 为 {p['display']:,.2f}{unit}；较 {st['comparison_period'] or '缺失同期'} 变化 {fmt(st['change'])}{'个百分点' if s['metric']=='rate' else '%'}。[{src['title']}]({src['url']})")
   if s['metric']=='price':lines.append(f"  样本内高点为 {st['peak']['period']} 的 {st['peak']['display']:.1f}；目前较该高点 {st['drawdown']:+.1f}%。这里指2015年以来已收录的观测高点，不是每日真实最高价。")
   lines.append(f"  口径：{s['scope']}。限制：{s['caveat']}")
  lines.append('\n**解读（推断）**：'+insights[key])
 lines+=['','## 如何用于 when / where',
 '优先寻找同类物业价格趋稳、同季成交恢复且融资负担可承受的组合，再结合核心表的租售比、收入与人口背景筛选城市。仅凭价格从高点回落、利率下降或一次成交反弹，均不足以确定买入时点。',
 '目前资料适合形成城市观察清单；最终买入条件还取决于预算、持有期、当地实际贷款与具体物业现金流。',
 '\n## 覆盖限制与更新','- 纽约：需补公寓/合作公寓及质量调整价格指数；当前一户住宅系列完整保留，不能直接拼接替换。',
 '- 北京：需补二手住宅网签量；已保留2015—2025年新房住宅销售面积。房价长指数由月环比链乘，舍入和基期轮换影响累计幅度。',
 '- 慕尼黑：需补全年纯公寓成交量；当前2019—2026年H1系列不能与其他城市全年绝对量排序。',
 '- 德国：GREIX价格可能追溯修订；不填补缺失季度。全国房贷利率不能代替城市或个人报价。',
 '- 不同贷款结构的利率不能直接横向比较融资便宜程度。',
 '- 自动接口覆盖GREIX、ECB和Freddie Mac；官方PDF/图片表格由半年任务逐项核实后导入，尚非全部来源无人值守抓取。',
 '\n## 计算与校验',
 '归一化价格 = 原价格 / 2015年观测均值 × 100；距高点 = 最新 / 样本最大值 − 1；同比 = 本期 / 同期 − 1；利率变化用百分点。年度中位价不再对月度作插值，成交面积不换算为套数。',
 '北京链式价格以2015年1月=100起算，后续乘以月环比指数/100，再统一按2015均值重置；保留每月环比原始值及来源。',
 '质量检查：13条序列；正值、有限数、来源引用、期间唯一、排序、未来期间和2015基期完整性；缺口断线。']
 if warnings:lines+=['','校验提示：']+['- '+x for x in warnings]
 (OUT/'五城趋势分析.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
 payload=json.dumps(d,ensure_ascii=False,allow_nan=False).replace('</','<\\/')
 template=(HERE/'dashboard.html').read_text(encoding='utf8')
 vendor=(HERE/'chart.umd.min.js').read_text(encoding='utf8')
 (OUT/'五城房产趋势.html').write_text(template.replace('/*CHART_LIBRARY*/',vendor).replace('/*DATA_PAYLOAD*/',payload),encoding='utf8')
 result={'date':d['updated_at'],'series':len(d['series']),'observations':sum(len(s['points']) for s in d['series'].values()),'warnings':warnings}
 write_json(OUT/'validation.json',result);print(json.dumps(result,ensure_ascii=False))
 return d
if __name__=='__main__':build()
