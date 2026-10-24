# 云端巡检与独立告警

GitHub Actions 的 `monitor.yml` 执行只读巡检，Healthchecks.io 独立监测信号缺失。
不依赖本机、Codex、网站进程或生产数据库写权限。

## 检查范围

- 每 6 小时执行（UTC 01:11 / 07:11 / 13:11 / 19:11），main 的私有备份、浏览器流程或公开快照工作流结束后也执行。
- 验证三个工作流 active，`PRIVATE_BACKUP_ENABLED`、`PRIVATE_RESTORE_ENABLED`、`E2E_ENABLED` 为 true。
- create、公开快照、browser flows 最近实际成功不超过 36 小时；备份健康检查不超过 12 小时；SQL 恢复不超过 35 天。
- 独立 health 全天每 6 小时调度（北京时间 04:37 / 10:37 / 16:37 / 22:37），12 小时窗口留出一轮调度余量。
- 健康检查的新鲜度接受独立 health，或完成创建、数据库取回验证及 health 的 create；仍验证对应 job 的关键步骤实际成功，不只看工作流总状态。
- 故障与新鲜度分开判定：各操作的最新失败、取消、超时及待验重跑仍独立告警；成功 create 不能清除 health 失败，成功 health 不能清除 create、verify 或恢复失败。每日 create 与自然 create 的 36 小时要求不由 health 替代。
- 验证 job 与关键步骤实际执行；全部 skipped 不算成功，新失败不能被旧成功掩盖。
- 按最新执行尝试排序；失败、取消、超时与需处理状态不按创建时间截断查询，防止旧任务重跑或季度失败消失。
- 恢复要求原生逐表行/列、迁移、序列比对摘要，且日志时间位于实际恢复步骤内。日志过期或无法访问即报告无法验证。
- 2026-10-14 16:17（北京时间）起另查最近 36 小时自然 create；手工运行不能替代自然调度验收。
- 排除受控 `alert-test`；普通 verify / verify-database 失败仍需告警。
- `pnpm backup:private health` 读取真实加密仓库新鲜度，不创建备份、取回媒体、恢复或写库。

GitHub API 使用短期 Actions token，仅 `contents:read` / `actions:read`。
`workflow_run` 一律 checkout 默认分支，不执行来源分支代码或下载其 artifact，checkout 不保存凭据。

## 独立通知与检测窗口

检查名 `fhfs-site cloud monitor`，Period 6 小时、Grace 6 小时，仅 POST。
审计与真实仓库 health 全通过后才发送成功；失败发送 `/fail`。
整个巡检停用、长时间排队或无法上报时，最后成功信号超过 12 小时后由外部服务告警。
状态刚变坏且没有完成事件时，要等下一轮巡检，通常最多 6 小时加调度延迟。
明确的工作流失败完成后，通过 `workflow_run` 触发巡检并上报 `/fail`，不等上述新鲜度窗口或外部 Grace 到期。
GitHub 调度、外部服务及邮件传输均可能延迟；已有 GitHub 失败通知保留。

上报只有固定服务名和成功/失败，不含连接串、草稿、原生日志或备份内容。
Healthchecks 不持有数据库、restic、B2、GitHub 或网站后台凭据。
专用 ping URL 具有上报权，保存在 Actions Secret `HEALTHCHECKS_PING_URL`，不进入代码和公共日志。
管理 API 密钥只在配置/演练期间使用，收尾撤销，不放入 Actions。

## 巡检工具安装

云端巡检与独立 `health` 共用 `scripts/install-restic.sh`，固定官方 restic 0.19.1 的 Linux amd64
发布包与 SHA-256；不再调用 Ubuntu 软件源安装 restic。下载连接超时 10 秒、单次最多 30 秒，
最多三次尝试；安装步骤最多 3 分钟，云端真实仓库 health 步骤最多 3 分钟，整体仍为 12 分钟。

缓存只保存压缩包，不保存可执行文件或健康结果；每次使用前重新校验摘要，再解压到本次 runner
的独立目录。缓存步骤最多 1 分钟，缓存不可用时直接下载；下载失败、摘要不符或实际 health
失败均使巡检失败并发送 `/fail`，只有缓存本身允许 `continue-on-error`。

每日创建与恢复操作仍需安装 Postgres 客户端；独立 `health` 不走这条软件源路径。
两条工作流的 pnpm 安装最多 3 分钟；Postgres 客户端安装最多 8 分钟，apt 的连接/读取
超时均为 20 秒、最多重试两次。超时或安装失败仍进入原有失败上报路径。

## GitHub 步骤证据同步

审计固定读取所选 `run_id` / `run_attempt` 的 jobs，并在读取后确认运行仍停留于同一次
成功尝试。仅空 jobs、空步骤或尚未完成的元数据允许复查：首次读取后按 10 / 20 / 40 秒
间隔重试，最多四次读取，整轮审计所有证据共用两分钟预算，预算也约束 HTTP 请求。
审计步骤另有 4 分钟上限，整体巡检仍为 12 分钟。

明确的工作流、job、关键步骤失败、取消或跳过，以及运行尝试变化、API 错误、非法或截断
响应均立即判为失败；持续缺失证据在重试耗尽后失败。只重读 GitHub 元数据，不重跑备份或
恢复操作。等待结束后重新核对原有新鲜度窗口，不接受旧成功覆盖新失败。

2026-10-25 01:44（北京时间）的告警报 `health: critical step did not execute successfully`，
但 health run `40116677924` 已报告备份有效；05:19 的巡检在相同代码下接受了同一 run 的
同一次尝试。底层原因疑似 GitHub 元数据同步延迟；未保存当时 API 响应，不能完全确认。
回归用例以该运行的公开元数据为基础合成暂未同步的响应，并保留真实失败与缺失证据告警。

12 小时 health、36 小时备份与自然 create、35 天恢复证据和外部看门狗窗口均保持不变。
CI 用相同安装脚本执行临时本地加密仓库往返与篡改检测，不接触生产数据库或远端备份仓库。

## 迁移顺序

1. 创建正式和独立演练检查，确认邮箱集成；保留本地巡检。
2. 配置专用 Secret 与仓库变量 `MONITOR_ENABLED=true`。关闭此开关后外部看门狗仍会因信号缺失告警。
3. 策略测试、真实 API/恢复日志和云端运行全部验证，不能只看总状态绿色。
4. 实测 success → failure → recovery；停止信号后等待 timeout → recovery，并核对邮件。
5. 合并后运行 main，验证自动 `workflow_run` 及服务端最后信号。
6. 全通过后停用本地 Codex 自动化、演练与默认检查，撤销管理 API 密钥，删除本地临时凭据。

逐项证据记录在发布 PR；自然巡检与自然 create 分别验收，手工和 `workflow_run` 不能冒充 schedule。

公开快照现在核对两个后台事务记录的预期行数，正常清空可自动备份；异常减少、归零或缺失证据仍告警。部署与一次性初始化见 [后台编辑与备份保护](BACKUP-EDIT-AUDIT.md)。

## 排障与回退

- 先看 Actions 的 `cloud monitor`：API 审计、restic health、状态上报分开显示。
- API 限流、权限不足、日志缺失与异常元数据属于无法验证，不报告健康。
- 历史查询有分页和数量上限，达到 GitHub 搜索上限时告警要求缩小查询，不把截断历史视为健康。
- 备份过期应修复原备份任务；巡检不会自动写库或创建备份来消除告警。
- 新增表或序列后，先创建迁移后的私有备份，再执行 `restore-database`，更新实际恢复证据。
  巡检按当前 schema 核对数量，旧结构的成功演练不会覆盖新结构；不应放宽数量检查来消除告警。
- ping URL 泄露须更换检查地址与 Secret，并验证新信号；只删日志不能撤销旧地址。
- 回退时先启用并验证本地巡检，再停云端并暂停外部检查，避免空窗或持续误报。
- 服务套餐、邮件地址或通知设置变更后重新验证送达。

## 2026-10-18 告警复盘

北京时间 13:49:14 的 DOWN 来自主动失败信号。独立 health 上次于 01:31 启动，
10:37 的下一轮延迟至 15:24，审计因此报 `health: successful run is outside the 12 hour window`。
当天 06:27 的 create 和 07:20 的巡检实际都确认备份正常；旧判断只按独立 health 的运行名取证，
且 22:37 至次日 10:37 本来就相隔 12 小时，没有调度余量。15:26:38 后恢复，告警约持续 1 小时 37 分钟。
这次反映备份巡检证据过期，不能据此认定网站 HTTP 宕机。

修复补齐凌晨 health，并接受 create 内真实执行的健康检查作为新鲜度证据，保留最新失败的独立判断。
不延长 12 小时健康窗口、36 小时快照窗口或外部看门狗窗口；本轮巡检仍必须读取真实加密仓库。
回归测试重放该次延迟、最新失败被其他成功覆盖、待验重跑、缺失/过期证据及自然 create 超期。
GitHub 调度没有准点保证，超出余量的长时间延迟仍应告警，不能承诺消除所有由调度引起的通知。

资料：[Healthchecks](https://healthchecks.io/docs/)、[GitHub 工作流停用规则](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)。

## 2026-10-22 软件源超时告警复盘

北京时间 20:56:27，[巡检 39782444132](https://github.com/fanhefeng/fhfs-site/actions/runs/39782444132)
的工作流审计全部通过，随后 `apt-get update` 访问 `azure.archive.ubuntu.com` 多次重试后停滞。
21:08:42 GitHub 记录 `The job has exceeded the maximum execution time of 12m0s` 并取消任务；
`always()` 状态上报于 21:08:43 发送失败，Healthchecks 随即 DOWN。该轮尚未执行真实仓库 health。

22:09:33，[下一轮巡检 39793174607](https://github.com/fanhefeng/fhfs-site/actions/runs/39793174607)
完成真实仓库检查并发送成功，Healthchecks 恢复 UP，持续约 1 小时 1 分钟。两轮使用相同代码；
证据指向 runner 软件源访问停滞，没有显示备份损坏或网站 HTTP 宕机。

修复移除两条健康巡检路径的 apt 依赖，固定并校验官方二进制，限制下载时间且允许缓存故障回退。
回归直接执行工作流中的 shell，模拟软件源不可用、真实 health 非零退出、取消状态、下载超时与
损坏压缩包；失败仍上报 `/fail`，不会以旧成功或缓存结果冒充真实健康。

官方来源：[restic 0.19.1](https://github.com/restic/restic/releases/tag/v0.19.1)、
[官方二进制校验说明](https://restic.readthedocs.io/en/stable/020_installation.html#official-binaries)。

10 月 23 日修复分支实测：

- [云端巡检 39928359058](https://github.com/fanhefeng/fhfs-site/actions/runs/39928359058)
  首次无缓存，完成官方 Linux 发布包下载、摘要校验、真实仓库 health 与成功上报，整轮约 39 秒。
- [独立 health 39928488680](https://github.com/fanhefeng/fhfs-site/actions/runs/39928488680)
  命中同一压缩包缓存，重新校验后完成真实仓库 health，整轮约 33 秒；未执行 Postgres 安装或恢复。
- 两次均为修复分支的 `workflow_dispatch`，不替代 main 的自然调度证据。
- 本地 `pnpm check` 的 434 项测试、`pnpm build`、生产依赖审计、ShellCheck、actionlint
  及 restic 0.19.1 的临时本地加密仓库往返与篡改检测均通过；完整公开浏览器 smoke 的 61 页全部通过。
