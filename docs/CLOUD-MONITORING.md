# 云端巡检与独立告警

GitHub Actions 的 `monitor.yml` 执行只读巡检，Healthchecks.io 独立监测信号缺失。
不依赖本机、Codex、网站进程或生产数据库写权限。

## 检查范围

- 每 6 小时执行（UTC 01:11 / 07:11 / 13:11 / 19:11），main 的私有备份、浏览器流程或公开快照工作流结束后也执行。
- 验证三个工作流 active，`PRIVATE_BACKUP_ENABLED`、`PRIVATE_RESTORE_ENABLED`、`E2E_ENABLED` 为 true。
- create、公开快照、browser flows 最近实际成功不超过 36 小时；health 不超过 12 小时；SQL 恢复不超过 35 天。
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
GitHub 调度、外部服务及邮件传输均可能延迟；已有 GitHub 失败通知保留。

上报只有固定服务名和成功/失败，不含连接串、草稿、原生日志或备份内容。
Healthchecks 不持有数据库、restic、B2、GitHub 或网站后台凭据。
专用 ping URL 具有上报权，保存在 Actions Secret `HEALTHCHECKS_PING_URL`，不进入代码和公共日志。
管理 API 密钥只在配置/演练期间使用，收尾撤销，不放入 Actions。

## 迁移顺序

1. 创建正式和独立演练检查，确认邮箱集成；保留本地巡检。
2. 配置专用 Secret 与仓库变量 `MONITOR_ENABLED=true`。关闭此开关后外部看门狗仍会因信号缺失告警。
3. 策略测试、真实 API/恢复日志和云端运行全部验证，不能只看总状态绿色。
4. 实测 success → failure → recovery；停止信号后等待 timeout → recovery，并核对邮件。
5. 合并后运行 main，验证自动 `workflow_run` 及服务端最后信号。
6. 全通过后停用本地 Codex 自动化、演练与默认检查，撤销管理 API 密钥，删除本地临时凭据。

逐项证据记录在发布 PR；自然巡检与自然 create 分别验收，手工和 `workflow_run` 不能冒充 schedule。

## 排障与回退

- 先看 Actions 的 `cloud monitor`：API 审计、restic health、状态上报分开显示。
- API 限流、权限不足、日志缺失与异常元数据属于无法验证，不报告健康。
- 历史查询有分页和数量上限，达到 GitHub 搜索上限时告警要求缩小查询，不把截断历史视为健康。
- 备份过期应修复原备份任务；巡检不会自动写库或创建备份来消除告警。
- ping URL 泄露须更换检查地址与 Secret，并验证新信号；只删日志不能撤销旧地址。
- 回退时先启用并验证本地巡检，再停云端并暂停外部检查，避免空窗或持续误报。
- 服务套餐、邮件地址或通知设置变更后重新验证送达。

资料：[Healthchecks](https://healthchecks.io/docs/)、[GitHub 工作流停用规则](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)。
