# GitHub 数据同步

`/admin/apps` 的 `repo`（`owner/name`）决定接入哪些仓库。现有六款软件已填好。
GitHub 是版本号、发布日期、Release 下载文件、Star 与 Fork 数量的来源；双语介绍、
官网、分类和平台仍在后台编辑。没有 Release 时显示第一个 tag，指向实际 tag 的源码树，
不编造发布日期或安装包。

首页的最近发布和软件页共享按仓库划分的缓存标签。Webhook 到达后立即过期这个标签，
下一次访问会等待新数据；已经打开的页面需刷新。页面保持静态预渲染，不增加浏览器侧
GitHub 请求。即使构建时 GitHub 不可用，两页也每小时重新检查，不会永久停在空版本。

## 启用立即同步

1. 用密码管理器生成独立随机密钥，至少 32 个字符。在站点的生产环境配置
   `GITHUB_WEBHOOK_SECRET`，然后部署本次代码。不要复用后台的 `AUTH_SECRET`，
   不要把密钥写入代码、命令参数或日志。
2. 每个已接入仓库打开 **Settings → Webhooks → Add webhook**：
   - Payload URL：实际站点地址加 `/api/github/webhook`，不带 `/zh` 或 `/en`。
   - Content type：`application/json`。
   - Secret：与生产环境中的 `GITHUB_WEBHOOK_SECRET` 相同。
   - SSL verification：启用；Active：启用。
   - 选择事件：Releases、Pushes、Branch or tag creation、Branch or tag deletion、
     Repository、Stars、Forks；公开化事件 `public` 也被处理。
3. Webhook 的首次 `ping` 应返回 HTTP 200 和 `{"ok":true}`。发布或编辑 Release 后，
   在 Recent Deliveries 中应看到 `{"ok":true,"repo":"owner/name"}`，随后刷新双语首页
   和软件页，确认版本、时间、文件与统计更新。

可选 `GITHUB_TOKEN` 仅在服务端用于提升 API 配额。公开仓库无需 token；如配置，使用只可
读取公开仓库的 token，避免授予私有仓库权限。增加仓库只需填 `repo`，并给这个仓库添加
同一个 Webhook。仓库改名或转移后同步更新后台的 `repo`。

Webhook 使用原始请求字节验证 `X-Hub-Signature-256`（HMAC-SHA256、恒定时间比较），
签名通过后才解析 JSON、读取配置和失效缓存。只处理后台已配置的仓库；忽略其他事件或
仓库，重复投递只重复失效同一个标签，不写数据库。不配置密钥时端点返回 503，页面仍
按小时刷新。错误签名返回 401，非法 JSON 返回 400，超过 25 MiB 的请求返回 413。

桌面软件和工具有已上传的 Release 附件时，主按钮前往该 Release；展开「下载文件」
可按文件名选择对应平台的直接下载地址。网站和网页游戏保留原入口。GitHub 请求失败时
缺失的信息不显示，原官网和项目介绍仍可用。GitHub 未投递的事件（例如上游 Fork 删除
或下载附件变化未触发 Release 事件）、投递失败和超出托管平台请求上限的负载，由按小时
刷新兜底；不是后台定时任务，刷新由下一次访问触发。

## 验证

`pnpm check` 覆盖签名的 GitHub 官方测试向量、Unicode 原始字节、篡改、禁用/未授权
请求、仓库白名单、重复投递、缓存标签、下载地址和数据解析、错误与 tag 回退。
生产构建后用 `pnpm smoke <本机地址>` 检查静态路由、双语 UI、脚本预算与 CSP。

协议来源：[签名验证](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)、
[Webhook 事件](https://docs.github.com/en/webhooks/webhook-events-and-payloads)、
[Release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)、
[仓库 API](https://docs.github.com/en/rest/repos/repos#get-a-repository)。Next 16 的即时外部失效
使用 `revalidateTag(tag, { expire: 0 })`；`updateTag` 只用于 Server Actions。

## 2026-10-14 启用记录

生产站点已配置独立敏感变量 `GITHUB_WEBHOOK_SECRET`，并已部署同步代码。
`file-tidy`、`keyboard-piano`、`link-verse`、`lumitext`、`photo-browser`、`portreaper`
六个仓库均启用了指向生产端点的签名 Webhook；GitHub 实际发出的六次首次 `ping`
全部返回 HTTP 200。正式域名上的签名发布事件、错误签名和未知仓库检查通过，
中英文软件页的版本、时间、下载文件和统计与 GitHub API 一致。

同步代码随 `main` 的提交发布，后续部署继续使用同一条主分支历史。
本机全站 smoke 的说说页因代理将媒体域名解析到私网地址而失败；同一图片的生产请求
返回 200。受影响页面另行检查脚本预算、控制台和 CSP。
