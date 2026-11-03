# 项目现状与发布核对

检查日期：2026-11-03（北京时间）。本页记录本轮代码、验证与发布契约；历史事件以对应 Git 提交、Actions 和平台部署记录为准。

## 两个独立应用

| 应用 | 框架与部署 | 生产地址 | 仓库 |
| --- | --- | --- | --- |
| fhfs | TanStack Start / React 19 / Vite+ / Void，Cloudflare Workers | https://fhfs.fhfs.workers.dev | https://github.com/fanhefeng/fhfs |
| fhfs-site | Next.js 16 / React 19 / Vite+，Vercel | https://fhfs-site.vercel.app | https://github.com/fanhefeng/fhfs-site |

两站共享 Neon schema、数据库内容和媒体 Worker，应用、管理员会话和发布独立。没有跨站代理或后台跳转。公开数据库缓存窗口保持 30 秒，后台读取和鉴权预览绕过公开缓存；本轮不修改 schema、上传租约或生产数据。

## 本轮代码

- 将 20 篇公开导入稿融入既有文章与生活目录。11 篇技术稿使用 `/blog/:slug`，9 篇生活稿使用 `/secrets/:slug` 并列在 `/life`；双语保留原语言正文、回退提示、canonical、选编说明和署名。不补造写作日期，RSS 仅收录有日期的文章。
- 旧 `/blog/notes` 与分篇地址返回 301，按原分类转入既有栏目；搜索、标签、相邻篇目和 sitemap 使用新地址。原始内容清单和分篇 JSON 在两仓库中保持一致。
- 修复 P2：数据库拥有同 slug 的所有语言版本，草稿也保留拥有权。全部版本撤为草稿时，公开详情、列表、标签、搜索与 sitemap 隐藏该地址，不再回退到静态原稿；鉴权预览仍可读取草稿。若仍有已发布译文，公开页继续回退到该译文。使用内存 PGlite 覆盖撤稿、多语言回退、预览隔离与另一部署编辑后的缓存过期。
- 搜索只共享尚未完成的请求，每次打开重新验证索引；失败可重试，查询保留，输入法合成键不触发跳转。
- Markdown 预览在切回编辑、重置和卸载时取消并使旧任务失效；晚到的结果、错误和 loading 不覆盖当前编辑状态。会话过期保留正文。
- 导航修复鼠标/触摸与键盘切换后的焦点指示；日期提示支持悬停保持和 Escape 关闭。保留主题、音乐、滚动锁、缓动 token、按需 3D、WebGL 与 reduced-motion 契约。
- 本轮入口、剧照分页及后台面包屑不再附加装饰性箭头。文字按钮、焦点、键盘方向键及原生展开控件保留；偏好已写入两仓库的 `AGENTS.md` 和 `docs/DESIGN.md`。
- 图片实现按各自框架保留：fhfs 构建本地 JPEG 的响应式候选图，fhfs-site 继续使用 `next/image`。两边全屏剧照均读原图，资源来源与许可不变。

## 本地验证

| 应用 | 检查 | 结果 |
| --- | --- | --- |
| fhfs | `pnpm check` | 63 个文件、543 项测试通过；含 Workers 运行时、类型、lint 和格式 |
| fhfs | `pnpm build` | 正常生产构建通过，数据库驱动与凭据未进入客户端包 |
| fhfs | `pnpm e2e` | 5 项原生后台流程通过，含预览竞态、重置、会话过期、保存与上传保留 |
| fhfs | 公开 smoke 与专项浏览器 | 191 页、20 篇归类稿、40 个旧分篇跳转、双语导航、搜索刷新和原图预览通过 |
| fhfs-site | `pnpm check` | 57 个文件、521 项测试通过，覆盖率超过既有门禁 |
| fhfs-site | `pnpm build` | 正常生产构建通过 |
| fhfs-site | 公开 smoke 与专项浏览器 | 原有 smoke 分批覆盖全部 108 页，无资源/控制台/CSP/脚本预算错误；归类稿、导航和搜索/图片专项通过；两边搜索索引各 594 条及 191 个 sitemap 路径逐项一致 |
| fhfs-site | `pnpm e2e` | 47 项流程最终通过，其中 2 项既有上传测试首次未通过、重试通过；新增预览竞态测试首次通过 |


数据库写入测试只进入各自预先隔离、带手工 guard 的测试库，单元回归使用内存 PGlite；未对生产执行迁移、导入、种子或测试写入。后台浏览器套件由运行器清理测试数据与临时凭据。

本轮另按 code-review 与 React Best Practices 清单审查缓存、语言回退、服务端边界、请求竞态、生命周期及可访问性。CodeRabbit CLI 0.7.3 未登录，未生成其自动报告。

## 发布与线上版本

本轮修复、同步和状态文档一并进入两仓库的 `main`；不再用本地未提交工作树代替已发布版本。

- fhfs 由 [CI and deploy](https://github.com/fanhefeng/fhfs/actions/workflows/check.yml) 检查、构建并通过 Void 更新现有 `fhfs` Worker。对应运行的 `headSha`、Cloudflare Version ID 和生产部署记录共同标识版本；线上 smoke 使用同一提交的脚本。
- fhfs-site 由现有 GitHub → Vercel 集成从 `main` 发布到 `fhfs-projects/fhfs-site`；[check](https://github.com/fanhefeng/fhfs-site/actions/workflows/check.yml) 和 [browser flows](https://github.com/fanhefeng/fhfs-site/actions/workflows/e2e.yml) 提供检查证据。Vercel 生产部署的 `meta.githubCommitSha` 应等于 GitHub `main`。
- 线上验收检查双语列表、20 篇稿件、旧地址 301、搜索/RSS/sitemap、移动阅读、导航、图片原图预览及本部署的管理员登录边界。线上只执行公开读取和无内容写入的交互；P2 撤稿场景只在隔离测试库复现。

具体提交 SHA、部署 ID 和运行链接由 GitHub 与平台记录保存，避免在自身提交中硬编码无法自引用的版本号。发布核对将本地 HEAD、远端 main、部署提交及公开行为一起比较。

## 保留事项

- 生产恢复凭据仍需独立保管；数据库恢复耗时不代表完整灾难切换 RTO。
- 真机播放器、VoiceOver、触摸及现场 INP 需要独立人工/真实用户测量；本轮浏览器通过不替代这些验收。
- 本机 fake-IP 代理会使 Next 拒绝媒体域名的私网解析；本轮本地生产预览仅在进程级使用 Cloudflare DNS-over-HTTPS 返回的公网地址，并保留 Next 的 SSRF 和 TLS 检查。该临时环境配置不进入应用或发布产物。长期修复仍按 `docs/TESTING.md` 排除代理，不启用本地 IP 放行。
- 更早的备份/恢复记录属于历史证据，不当作本轮重跑结果。操作入口见 `docs/RECOVERY.md`、`docs/PRIVATE-BACKUP.md` 和 `docs/CLOUD-MONITORING.md`。
