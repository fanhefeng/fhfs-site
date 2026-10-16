# 后台媒体上传

2026-10-16：在原有 Cloudflare Worker 静态媒体旁增加 Workers KV，沿用免费、不绑卡的约束。旧文件不搬动。新上传仍使用 `MEDIA_ORIGIN/moments/uploads/<uuid>.<ext>`，每个文件一个地址。

## 使用

- 快捷发布、说说可上传图片、音频、视频；自动填写尺寸、时长，视频自动生成封面。
- 文章及秘密正文可上传图片；播客音频可直接上传并填写分钟数；电影、偶像上传图片后新增一行。
- 文件选中后立即显示本地预览。上传完成、站点读回长度之后才能保存。
- 「移除并清理」「取消本次编辑」及离开编辑页清理本次尚未保存的文件。已保存的内容（包括草稿）保留文件。
- 关闭浏览器时的请求只是尽力送达。Worker 每小时调用站点清理接口，清理超过 24 小时仍未保存的上传。

## 存储与安全

KV 免费额度为账号共 1 GB，每值最多 25 MiB；每日 1,000 次写入、1,000 次删除、100,000 次读取。超过额度失败，不自动开通付费。旧静态文件不占这部分 KV 配额。参考：[限制](https://developers.cloudflare.com/kv/platform/limits/)、[计费](https://developers.cloudflare.com/kv/platform/pricing/)。

`MEDIA_UPLOAD_SECRET` 是独立随机密钥，只存在站点环境和 Worker Secret 中。`/admin/media/uploads` 校验后台会话与 Origin，只签发绑定路径、大小、类型、来源和 10 分钟有效期的上传许可。浏览器直接 PUT 到 Worker，避开站点的请求体大小限制。传输最多 5 分钟，FixedLengthStream 校验字节数，不让视频字节经过 JS。

`media_uploads` 保存上传批次及状态，不保存原始文件名。保存内容时的 CTE 同时锁定并保留对应文件；取消只能把 uploading / ready 标记为 deleting。取消先赢时，旧编辑页的内容写入整句回滚；保存先赢时，取消不能选择 retained 文件。保存失败不会单独留下 retained 状态。

清理只接收本上传器生成的 UUID，不接受要删除的任意地址。第一次删除后留墓碑；过上传许可和最长传输时间后再删一次，清理取消时已在途的写入。之后只删墓碑，不每小时重复删除文件消耗免费额度。已保存文件不做自动垃圾回收。

## 部署与恢复

1. `pnpm db:migrate` 增加租约表；现有内容不改。
2. Worker 绑定 `UPLOADS` 命名空间，设置 `MEDIA_UPLOAD_SECRET`；站点生产环境设置相同密钥。值不得进入命令参数、日志或 Git。
3. `pnpm media:deploy` 部署 Worker，Git 主分支部署站点。Cron 的站点地址由 `UPLOAD_SITE_ORIGIN` 指定。
4. `pnpm e2e` 只使用已标记的测试库和本地 Wrangler KV 模拟器。`E2E_MEDIA_ORIGIN` 仅在 E2E_BUILD 时有效；不写生产媒体。

公开导出仅包含公开内容实际引用的上传租约，保留 UUID；临时上传和仅草稿引用的文件信息不进 Git。`db:import` 恢复这些 retained 租约。私有备份的数据库包含所有租约及草稿，已引用文件照常进入加密媒体备份。

`media:pull` 仍可下载所有已引用文件，包括 KV 上传。恢复时把文件放回 `media/files/` 后按现有流程部署；KV 未命中时 Worker 会读取恢复的同地址静态副本。
