# 柏林房源数据库

截至 2026-10-06，默认筛选条件为：柏林住宅产权公寓、建筑实际建造年份在 2010 年之后、住宅挂牌价 < €500,000、居住面积 > 40 m²；不限一手或二手。已建房看原始建筑年份，装修年份不能代替。期房将预计交付年单列。

当前主库 49 条公开页面候选：6 条已核实符合建筑年份的已建房、30 条仅有预计交付年的期房候选、13 条建筑年份待核。后两类不能视作已确认符合实际建造年份。本轮从五个 Neubaukompass 项目页补充 33 条有明确价格与面积的单元示例，具体单套页面与实际可售状态未获确认。平台筛选结果页未能遍历，因此这是“未完成/已核实子集”，不代表柏林全市场。

| 文件 | 用途 |
| --- | --- |
| [柏林房源筛选.xlsx](柏林房源筛选.xlsx) | 房价、面积、单价、年份、房龄、预计交付年、租售测算、链接及观察历史 |
| [listings.json](listings.json) | 当前候选房源主库，下轮优先读取 |
| [observations.jsonl](observations.jsonl) | 以房源 ID 和日期追加的观察历史 |
| [batches/](batches/) | 增量观察批次与覆盖情况 |
| [rent_benchmarks.json](rent_benchmarks.json) | IBB 2025 年区域挂牌净冷租基准 |
| [search_log.jsonl](search_log.jsonl) | 每轮来源、范围、变动和限制 |

年毛租售比 = 面积 × 同区月租基准 × 12 ÷ 挂牌住宅房价。这是区域租金情景，不等于该套房合法可收租金或净收益；未计交易税费、融资、空置、Hausgeld、维修与车位费用。

本轮来源包括 [GERN 36](https://www.neubaukompass.de/neubau/gern-36-berlin/148787.html)、[Waldpanorama](https://www.neubaukompass.de/neubau/waldpanorama-berlin/148531.html)、[Unsere Flora](https://www.neubaukompass.de/neubau/unsere-flora-berlin/151083.html)、[Borsig Green Living](https://www.neubaukompass.de/neubau/borsig-green-living-berlin/148769.html) 和 [ACHTERDECK](https://www.neubaukompass.de/neubau/achterdeck-berlin-koepenick-berlin/143476.html) 项目页；并核对 [Bonava](https://www.bonava.de/immobilien/berlin/buch/waldpanorama)、[Unsere Flora 开发商页](https://flora.otto-wulff.de/) 的项目状态。此次未能遍历 ImmoScout24、Immowelt 平台结果页，详见 [覆盖记录](batches/2026-10-06_coverage.json)。

增量更新规则见 [微观工作流](../../reference/micro/listing_workflow.md)。普通重建 Excel 只读取本地 JSON，不重复下载房源页或租金 PDF。
