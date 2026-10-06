# 柏林出售房产供给观察

**更新日：2026-10-04。** IBB 年度公寓挂牌广告数：2024 年 28,841 条，2025 年 31,312 条，变化 +8.6%。 一二户住宅挂牌广告数：2024 年 5,631 条，2025 年 6,135 条，变化 +9.0%。

## 年度挂牌广告量（IBB，柏林全市出售公寓）

| 年度 | 广告数 | 同比 | 来源 |
| --- | ---: | ---: | --- |
| 2022 | 23,629 | — | [ibb-2022](https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2022.html) |
| 2023 | 25,598 | +8.3% | [ibb-2023](https://www.ibb.de/media/dokumente/publikationen/berliner-wohnungsmarkt/wohnungsmarktbericht/ibb-wohnungsmarktbericht-2023.pdf) |
| 2024 | 28,841 | +12.7% | [ibb-2024](https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2024.html) |
| 2025 | 31,312 | +8.6% | [ibb-2025](https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2025.html) |

### 年度一二户住宅挂牌广告量

| 年度 | 广告数 | 同比 | 来源 |
| --- | ---: | ---: | --- |
| 2023 | 5,235 | — | [ibb-2023](https://www.ibb.de/media/dokumente/publikationen/berliner-wohnungsmarkt/wohnungsmarktbericht/ibb-wohnungsmarktbericht-2023.pdf) |
| 2024 | 5,631 | +7.6% | [ibb-2024](https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2024.html) |
| 2025 | 6,135 | +9.0% | [ibb-2025](https://www.ibb.de/de/ueber-uns/publikationen/wohnungsmarktbericht/2025.html) |

这是 VALUE Marktdatenbank 经 IBB/RegioKontext 整理的一年内挂牌广告数量，不是某一天仍在售的库存，也不是新建竣工量。广告数不等于去重后的独立住房套数。

## 公开平台即时搜索结果

| 固定查询 | 最近数量 | 采集日 | 与可比快照相比 |
| --- | ---: | --- | --- |
| [Immowelt 柏林在售公寓](https://www.immowelt.de/suche/kaufen/wohnung/berlin/berlin-11000/ad06de326) | 9,284 | 2026-10-04 | 仅有一次/不足 28 天，暂不能判断（direct_public_html） |
| [Immowelt 柏林在售住宅房屋](https://www.immowelt.de/suche/kaufen/haus/berlin/berlin-10115/ad08de8634/) | 2,565 | 2026-10-04 | 仅有一次/不足 28 天，暂不能判断（direct_public_html） |
| [Immowelt Mitte 行政区在售公寓](https://www.immowelt.de/suche/kaufen/wohnung/berlin-10115/mitte-10117/ad09de475) | 1,212 | 2026-10-04 | 仅有一次/不足 28 天，暂不能判断（direct_public_html） |
| [ImmoScout24 柏林在售公寓](https://www.immobilienscout24.de/Suche/de/berlin/berlin/wohnung-kaufen) | 13,204 | 2026-10-04 | 仅有一次/不足 28 天，暂不能判断（web_indexed） |
| [ImmoScout24 柏林在售房屋](https://www.immobilienscout24.de/Suche/de/berlin/berlin/haus-kaufen) | 3,458 | 2026-10-04 | 仅有一次/不足 28 天，暂不能判断（web_indexed） |

这里以 Immowelt 柏林全市的无价格、面积、建造年限制的公寓与房屋购买搜索为自动主源，Mitte 行政区公寓另列；以网页可见结果标题为准，不用 SEO 标题中的另一组数量。ImmoScout24 为网页索引辅助观测（web_indexed），不与直接 HTTP 抓取混接。平台计数可能包含项目展示、重复广告或下架延迟；只比较同一平台、同一搜索链接及同一采集方法的时间点，不与 IBB 年度量相加。少于两个相隔至少 28 天的可比快照时不输出即时供给方向。

ImmoScout24 可作交叉核对，但当前直接 HTTP 返回 401/人机验证，不能作为自动更新的主源；不得绕过验证。IBB 年报发布后需人工核实当年公寓及一二户住宅广告数，再以来源链接导入。若某来源不可访问，保留旧观测并在 refresh_log.jsonl 记录失败。

原始观测：[observations.json](observations.json)；导出：[annual.csv](annual.csv)、[snapshots.csv](snapshots.csv)。
