# 柏林出售房产供给观察

## 要回答的问题

“柏林正在挂牌出售的房产是变多还是变少”分两种可比指标，固定为独立序列，不在宏观核心 Excel 中混列：

1. **年度挂牌广告流量**：IBB Wohnungsmarktbericht 基于 VALUE Marktdatenbank 统计的柏林全市当年出售公寓广告数；另存一二户住宅广告数。一个年度内曾出现过的广告，不是年末存量，也不保证广告对应独立住房。来源每年发布一次，适合观察年际方向。
2. **平台即时搜索结果**：固定 Immowelt 柏林全市“Wohnung kaufen”“Haus kaufen”及 Mitte 行政区“Wohnung kaufen”的无价格、面积、建造年限制结果页，取页面可见 H1 的数量。它是某日平台搜索结果，不是全市场库存。ImmoScout24 全市公寓和房屋搜索页作独立辅助观测；直接 HTTP 当前可能返回 401，不绕过平台验证。

IBB 与平台数量、不同平台数量、柏林全市与 Mitte 区数量不能相加或接成一条折线。平台即时方向仅比较**同一平台、同一 URL、同一采集方法**、至少相隔 28 天的快照。搜索口径或网站计数方式变更时开新序列，旧序列保留。不能把年度广告流量增加直接解读为某天在售库存增加，或把挂牌增加等同于新建供给增加。

## 来源与数据

- IBB 2022–2025 年年度报告的具体链接在 `supply/config.json`。2022 出售公寓 23,629 条；2023 年 25,598 条、一二户住宅 5,235 条；2024 年分别 28,841、5,631 条；2025 年分别 31,312、6,135 条。来源年份与广告统计年份一致，访问日存入观测。
- Immowelt 固定链接及 H1 标题在 `supply/config.json`。脚本直接读取公开 HTML、校验 HTTP 状态、预期标题和非负整数，失败则保留旧值并记录错误。SEO `<title>` 数量与页面 H1 可能不同，固定只取 H1。
- ImmoScout24 两条固定链接也登记在配置中。网页辅助观察必须以 `method=web_indexed` 单列，不能伪装成直接抓取成功；未能读取或遇到人机验证时保留旧观测并记录障碍。

规范库是 `Output/supply/observations.json`，含每条观测的 series_id、period、value、source_id、captured_at、method、note。年度条目的 period 为 YYYY，即当年广告流量；即时条目为 YYYY-MM-DD。重复采集同一日同一数值不重复入库；数值变化或来源修订保留为新观测。`Output/supply/history/` 存入库批次，`refresh_log.jsonl` 记录成功与失败。生成结果为 `柏林出售房产供给.html`、`report.md`、`annual.csv`、`snapshots.csv`。本地重建只读规范库，不重新下载。

## 更新方式

从任何工作目录运行：

~~~powershell
& './reference/macro\supply\run.ps1' -Action Refresh
& './reference/macro\supply\run.ps1' -Action Validate
& './reference/macro\supply\run.ps1' -Action Build
~~~

Refresh 自动采集三条 Immowelt 即时序列、校验后入库并重建报告。单源失败不覆盖旧观测；有失败时命令非零退出。每次半年宏观任务另检查 IBB 是否发布了新年报：阅读“Angebotskaufpreise Eigentumswohnungen”和“Ein- und Zweifamilienhäuser”正文，记录准确年度、地域、物业类型及广告数，制作 JSON 批次后导入：

~~~powershell
& './reference/macro\supply\run.ps1' -Action Ingest -Batch '批次JSON绝对路径'
~~~

批次格式是 `{"observations":[{"series_id":"ibb_apartment_ads_annual","period":"2026","value":实际核实整数,"source_id":"ibb-2026","method":"official_report","note":"口径说明"}]}`。新增报告必须先在 `supply/config.json` 登记来源 ID 和原始 URL；不能照抄上述示例中的占位值。若报告尚未发布，不填 0、不延长旧值。网页辅助 ImmoScout 数量用相应 series_id、来源 ID、`method=web_indexed` 和实际访问日导入。

**周期沿用宏观项目已有的每半年任务**（3 月和 9 月 28 日，Europe/Berlin）；不另设一个月度提醒。半年快照只能回答半年尺度的方向，不能用于解释周/月波动；如果以后需要更敏感的转折监测，再单独调整频率。每轮自动更新成功不代表 IBB 年度数据也已复核，日志与报告要说明最新统计期。

