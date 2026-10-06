# 房产分析 Skill / Real Estate Analysis

一个用于住宅购房研究的 Codex Skill：宏观模块比较何时、在哪个城市购房；微观模块持续整理具体城市的房源。当前重点城市是柏林。

## 结构

- [SKILL.md](SKILL.md)：核心路由、证据规则与输出约定
- [reference/macro.md](reference/macro.md)：宏观市场分析入口；细分工作流位于 `reference/macro/`
- [reference/micro.md](reference/micro.md)：城市房源分析入口；柏林持续入库规则位于 `reference/micro/listing_workflow.md`
- [Output/](Output/)：已整理的数据快照、报告和工作簿；更新前优先复用本地数据

## 使用

将仓库克隆到本地，再让 Codex 读取根目录的 `SKILL.md`。所有命令从仓库根目录运行。宏观表和柏林微观库可分别验证：

```powershell
./reference/macro/run.ps1 -Action validate
./reference/micro/run.ps1 -Action Verify
```

重建工作簿：

```powershell
./reference/macro/run.ps1 -Action build
./reference/micro/run.ps1 -Action Build
```

脚本使用 Codex 工作区提供的 Node.js、Python 和 `@oai/artifact-tool`。不在该环境运行时，可通过脚本参数或环境变量指定运行时；详情见各模块工作流。数据采集还依赖相关公开来源当前是否可访问。

## 数据说明

`Output/` 是带有观察日期的研究快照，不是实时房源接口。宏观指标必须核对地区、住宅类型、统计期间和来源口径。柏林微观表中，“已建且年份核实”“期房按预计交付年暂纳入”“建筑年份待核”分开列示；挂牌页面可见并不证明该单元实际可售。平台搜索页未遍历完时，结果只代表已核实子集。

默认柏林筛选：住宅产权公寓，实际建造年晚于 2010 年，挂牌住宅价严格低于 €500,000，Wohnfläche 严格大于 40 m²；新房和二手房均可。详情和来源见 [微观工作流](reference/micro/listing_workflow.md) 与 [Output/micro/README.md](Output/micro/README.md)。

本仓库未附带付费数据、平台账号或自动绕过网站验证的能力。来源摘录压缩包、临时运行目录与本地备份不纳入版本控制。
