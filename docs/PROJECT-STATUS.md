# 项目现状与审查记录

检查日期：2026-10-14（北京时间）。本页只保留当前结论、验证证据和未完成事项；历史发布细节见对应 PR 与 Git 历史。设计决定继续以 `DESIGN.md` / `DESIGN-LOG.md` 为准。

## 代码、推送与合并

- 本轮从 `main` / `origin/main` 的 `7eac972a7c97d13293ad7eb694831dd7c5ff0782` 开始，开发分支为 `codex/sitemap-webgl-optimization`。
- 审查开始时最新合并为 [PR #26](https://github.com/fanhefeng/fhfs-site/pull/26)，当时没有开放 PR。
- 该提交的 [check / 生产构建 / smoke](https://github.com/fanhefeng/fhfs-site/actions/runs/38421391636) 实际执行成功；GitHub 上 Vercel 部署状态为 success。
- 本轮的提交、检查与部署验收记录在对应 PR；此页记录代码结论及本机证据。开始审查前已有的 `AGENTS.md` 修改保留，并修正缓存函数闭包的说明。

已删除 8 个本地开发分支、7 个对应远端开发分支。删除前核对 PR 已合并、远端 head 没有新增提交；远端使用原子操作和逐分支提交租约。

| 已清理分支（均为 `codex/` 前缀） | 原 head | 合并证据 |
|---|---|---|
| `build-backup-browser-verification` | `a37564e0a80025b8fcd77b2798e7a1c0d27c4fab` | [#19](https://github.com/fanhefeng/fhfs-site/pull/19)，main 祖先 |
| `dependency-release-verification`（仅本地） | `6cad9a64a42dcefe9e4adaf9b26290918b0c3f8a` | [#20](https://github.com/fanhefeng/fhfs-site/pull/20)，main 祖先 |
| `production-automation-verification` | `9407c1de4db064becf0e29bb6f32e72e8720044c` | [#21](https://github.com/fanhefeng/fhfs-site/pull/21)，main 祖先 |
| `admin-rounded-release` | `d7180eb9869ac9ad36c9f1ae1769fb94f03af840` | [#22](https://github.com/fanhefeng/fhfs-site/pull/22)，main 祖先 |
| `periodic-restore-drill` | `6060d877aaef447a40b86d6e49fe9db78e388166` | [#23](https://github.com/fanhefeng/fhfs-site/pull/23)，main 祖先 |
| `admin-critical-flows` | `147489d41bd830795757822a036ae04e368b7571` | [#24](https://github.com/fanhefeng/fhfs-site/pull/24)，main 祖先 |
| `reproducible-cjk-fonts` | `254e56203076da26e57ecaea7fb70861e1dab01d` | [#25](https://github.com/fanhefeng/fhfs-site/pull/25)，与 squash 后 `3a5c303` 代码树完全一致 |
| `cloud-monitoring` | `f120ae91b39965d928c10e19c9154559876bc354` | [#26](https://github.com/fanhefeng/fhfs-site/pull/26)，与 squash 后 `7eac972` 代码树完全一致 |

保留 `main` 和 `db-snapshots`。后者是自动内容备份分支，不能按“未合并开发分支”删除；本地从 `52b017a` 快进至远端 `5e1cbed`，没有独有提交被覆盖。

## 架构与目录

整体结构适合当前个人内容站，执行环境和领域职责清楚，无需整体重写或增加通用 Repository / Service 层。

```text
src/
  app/[locale]/       中英文公开路由、元数据和静态 JSON
  app/admin/          后台页面、actions 和表单 UI
  components/         按页面领域组织的交互与展示
  lib/                两端可用的纯函数和领域数据
    server/           带缓存的内容读取、鉴权、Markdown、SEO、OG
    client/           GSAP、播放器、滚动和浏览器生命周期
    node/             文件系统、备份与脚本辅助
  config/             环境变量、CSP、站点配置和资源缓存规则
  db/                 Neon 驱动与 Drizzle schema
  i18n/               locale 校验、导航与消息加载
scripts/              构建外的检查、资源、备份和测试入口
tests/e2e/            公开流程与独立测试库后台流程
messages/             全站文案默认值
public/               按 hash 寻址的静态资源
drizzle/              数据库迁移与快照
backup/               可公开内容导出
media/                Cloudflare 媒体 Worker；files/ 不进 Git
tools/                字体复现与模型校准工具
docs/                 当前操作说明、设计依据和历史决定
```

- `content.ts` 集中公开读层、缓存标签、草稿过滤和文章语言回退；多个内容领域的实现集中于此，没有因此造成错误。保持这一接口比按表拆出转发层更容易维护缓存约定。
- 后台页面各自鉴权，写入 actions 先验会话、后验证、最后失效；`forms.ts` 和 `useSaveAction` 集中处理校验及保存失败保留输入。
- 3D 经按需加载和 WebGL / Save-Data 探测，首页不挂 three.js。`gsap-extras`、请求时间缓存、主题首屏脚本等小模块都有具体作用。
- 没有独立 `CONTEXT.md` / ADR 目录；现有术语和决定集中在 `AGENTS.md` 与设计日志。当前规模不必为目录形式再复制一份说明。

## 本轮代码审查与清理

审查覆盖路由/缓存、后台鉴权与保存、Markdown/媒体路径、播放器/WebGL 生命周期、备份/恢复保护、目录引用和依赖使用。未发现需要立即阻止发布的高危问题；这不是完整安全审计。

| 发现 | 处理 |
|---|---|
| `/admin/intro` 允许标题只写一种语言，公开 `/intro` 却直接取当前语言，另一侧为空标题 | 页面统一调用已有 `inLocale`；标题、正文、时间段与要点一起回退 |
| 版本履历同样允许单语标题/日期占位，英文实验室履历会出现空标题与空日期 | 同一条记录统一本地化，再生成 Changelog 数据 |
| 连续保存期间仍显示上一轮成功/错误提示 | 保存中隐藏旧结果，仅显示当前操作的进度，完成后再报告本轮结果 |
| `ExpoScaleEase` 导入、注册但没有调用 | 删除该插件和预留说明，保留实际使用的 GSAP 插件 |
| `CopyLocale` 无引用 | 删除未使用类型 |
| 完整依赖审计发现旧 TS loader 间接引入 esbuild 0.18.20 | 精确覆盖该依赖至 drizzle-kit 已用的 0.25.12，移除旧版及平台副本；CJS / ESM 转换兼容验证通过 |
| 文案/说说数量写死，Markdown 注释仍描述已移除管线 | 删除易过期计数和无助于当前实现的迁移叙述 |
| 介绍页文档仍说首屏 probing 留白、about 预取工作台 | 更新为当前 SSR 开场、可聚焦简历与按需分包行为 |
| 缓存说明误称禁止捕获任何模块常量 | 改准为请求/调用间变化的值必须是参数；稳定数据库句柄与列集合可共享 |
| 项目状态反复追加旧版本结果，完成项仍写待观察 | 合并为本页，保留发布与恢复证据，区分本轮结果和历史测量 |
| sitemap 按 slug 逐一读取版本，查询数量随文章数增长 | 在缓存读层一次 `db.batch` 读取两表的已发布 slug/locale/date；导航、标签和子页并行读取，保持 URL、语言及日期语义 |
| 镜片与消融分别实现尺寸、可见性、context 和时钟管理 | 提取不依赖 three.js 的 `mountCanvasLoop`，隐藏/离屏暂停、恢复即重绘、幂等释放；各效果仍拥有纹理与 shader |
| 镜片图片部分加载成功后失败时，已到达纹理未进入清理列表 | 每张纹理到达即登记；失败或卸载释放成功项，晚到项自行释放，不重启已卸载效果 |

后台新增两项真实浏览器回归：单语简历节点保存后另一语言的无 JavaScript 页面可读；单语版本履历在英文页回退，新增/删除会刷新缓存。只写带手工标记的独立测试库；节点恢复原内容，新建履历由 UI 和运行器清理。

引用检查遍历 376 个受跟踪的 TS/TSX/MTS/MJS 文件，从路由、脚本、配置与测试入口追踪 import / dynamic import。两个看似未被 import 的文件是框架配置入口：`app/global-not-found.tsx` 和 `i18n/request.ts`；未发现可据此删除的整模块。

直接依赖均有用途：`leva` 用于开发校准面板；`shiki` 是 Markdown 高亮的 peer；Vitest、coverage、Tailwind、类型包和 CLI 由配置/工具链使用。`works` 后台、`media:deploy:safe` 兼容别名、旧字体分片/许可、迁移及备份均有保留用途。

esbuild 的[上游公告](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99)影响开发 serve 功能，修复版本为 0.25.0 起；本站旧加载器只调用 transform，未发现启用受影响服务的路径。仍移除旧版本，覆盖只作用于 `@esbuild-kit/core-utils`，没有整体升级工具链。

## 验证

| 检查 | 本轮结果 |
|---|---|
| `pnpm check` | 41 个测试文件、359 项测试通过，含类型、lint、格式和覆盖率门禁 |
| 辅助模块覆盖率 | 语句 95.92%、分支 94.57%、函数 91.56%、行 96.50%；不代表组件或全项目覆盖率 |
| `pnpm audit --prod` | info / low / moderate / high / critical 均为 0 |
| `pnpm audit`（含开发依赖） | 修复后所有严重级别均为 0；锁文件依赖条目从 680 降到 657 |
| `pnpm e2e` | 独立测试库迁移/导入、161 页生产构建（含测试样本）、33 项流程全部通过（15 后台、18 桌面/移动公开流程），包括真实 WebGL context 丢失/恢复和 resize |
| 定向 `pnpm smoke` | 独立测试库生产构建的 8 页全部通过，覆盖中英文介绍/实验室履历、贴纸墙、揭角、标题与后台登录；含资源、异常、控制台/CSP、脚本预算 |
| `git diff --check` | 通过 |
| 测试后清理 | 只读复核原简历节点已恢复，六类 `e2e-created-*` 行均为 0；临时会话与锁已删除 |

本机沙箱不能写默认 SWC 原生缓存，首次检查因此失败；设置 `SWC_NATIVE_BINDING_CACHE=/private/tmp/fhfs-site-swc` 后通过，无需修改项目或依赖。CodeRabbit CLI 0.7.3 当前未登录，本轮使用源码审查与架构独立复核，没有 CodeRabbit 自动报告。

本机公开浏览器流程仍出现媒体域名被代理解析到 `198.19.0.97` 的情况，Next 图片优化器按 SSRF 保护拒绝该请求。流程测试通过不表示所有媒体请求通过；此前 8 页定向 smoke 不含说说媒体，本机全量 sitemap smoke 尚受此环境限制。应按 [TESTING.md](TESTING.md) 调整代理的 fake-IP 过滤，不开启 `dangerouslyAllowLocalIP`。合并前仍须以本轮 PR 的云端全量 smoke 验收，发布后再检查生产站点。

## 备份、恢复与线上保障

- 最新 main 的 [自然 E2E](https://github.com/fanhefeng/fhfs-site/actions/runs/38490006605) 已成功，检查时云端空闲后才启动本机回归。
- 首次 [自然私有创建](https://github.com/fanhefeng/fhfs-site/actions/runs/38486137481) 已于 10 月 14 日 07:45 开始并成功，创建、数据库取回验证与 health 步骤均执行；此前 [自然 health](https://github.com/fanhefeng/fhfs-site/actions/runs/38461968074) 也成功。原“首个自然 create 待观察”已完成，GitHub 调度时间仍不是 SLA。
- [独立云端巡检](https://github.com/fanhefeng/fhfs-site/actions/runs/38490334591) 的工作流审计、加密仓库新鲜度和 Healthchecks 信号均实际执行成功。配置与窗口见 [CLOUD-MONITORING.md](CLOUD-MONITORING.md)。
- 私有存储与 Neon / Cloudflare 分离。既有完整恢复验证为数据库及 281 个媒体文件共 282 个文件的大小/SHA-256 一致；真实 SQL 恢复为 17 表、14 序列及迁移一致。[云端恢复证据](https://github.com/fanhefeng/fhfs-site/actions/runs/38381161831) 保留。它们是此前验收，不是本轮重复下载/恢复。
- 每月真实 SQL 恢复、每日私有创建、季度全量字节验证已经启用。操作与回退分别见 [PRIVATE-BACKUP.md](PRIVATE-BACKUP.md)、[RECOVERY.md](RECOVERY.md)。恢复密码仍需用户独立保管，不能只依赖本机或 GitHub Secrets。

## 后续优先级

| 优先级 | 项目 | 验收重点 |
|---|---|---|
| P1 | 恢复凭据独立保管、完整部署切换演练 | 确认离线/密码管理器可取回；既有 190 秒 SQL 恢复不等于完整灾难恢复 RTO |
| P2 | 介绍页冷访问性能 | 既有实际限速冷访问 LCP 约 3.2 秒，高于 1.8 秒目标；暖连接/CSS 缓存曾为 924/932 毫秒。先测 TLS、HTML/CSS 请求链，不把 TTFB 全归为服务器处理或用降画质替代诊断 |
| P2 | 真机与人工无障碍 | WebKit/axe 既有结果不能替代 iOS 系统播放器、触摸、省电、VoiceOver、键盘与放大表单验收 |
| P2 | 本机媒体域名解析 | 代理排除媒体域名并确认返回公网地址后，再跑包含说说页的全量 smoke |
| P2 | 真实用户性能 | 现场 INP 尚未测量，实验室 TBT 不能代替；先明确采样与隐私约定 |

可选双语段落仍按原策略允许留空隐藏；本轮只修复后台承诺至少一种语言、前台必须显示标题的两处。Cache Components、数据库驱动和全站架构没有足以要求立刻迁移的证据。
