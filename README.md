# fhf — The Quiet Issue · 安静的个人杂志

fhf 的个人网站：一本安静的个人杂志兼私人画廊——收录文章、自研软件与动效实验。
暖纸色、编辑部式排版、一盏琥珀色的灯；深色主题是「闭馆后」的同一间画廊。
完整设计语言（材质、动效语法、每页的叙事）见 `docs/DESIGN.md`。

## 版面

- **首页** —— 封面是一整屏程序化生长的苔藓树根（实验室「长出来的，不是建模的」
  的成品），宣言站在它前面，自带 dock；往下是近期文章、软件架子与一段关于。
  开场点灯仪式仍每会话一次。
- **/blog** —— 目录页式索引：按年分组的纯文字行，日期右对齐；文章页单栏
  68ch，中文标题逐行揭示、拉丁标题解码进场。
- **/portfolio** —— 一张暗室台灯的照片随滚动溶解成纸（实验室「溶解转场」的成品）
  + Mac / iPhone 设备框里翻看各个软件 + 手作日志。
- **/software** —— keynote 式 bento 展柜，分类筛选用 Flip 重排；版本号读自各仓库
  的 GitHub 最新 release。
- **/about** —— 点阵名字画布、横穿屏幕的标语（全站唯一 pin）、贴纸墙、版本履历。
- **/lab** —— 六则动效研究：滚动帧序列、溶解、融化文字、苔藓树根、色散按钮、
  可拖拽的 3D 工作台。每则按路由单独拆包。
- **/intro** —— R3F 的 3D 头像：滚动带镜头绕头飞行，每张贴纸停一站，
  即一份滚动叙事的简历（`docs/INTRO3D.md`）。
- **/resume** —— 正式的一页简历，内容全在库里。
- **/admin** —— 浏览器里的编辑部：文章、文案、列表全部可编辑，保存即生效。

## 技术栈

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4 · next-intl（zh/en 双语，`messages/*.json`）
- GSAP 3.15（核心 ScrollTrigger / SplitText / Flip / CustomEase 在 `src/lib/gsap.ts`
  注册；Draggable / Inertia / ScrambleText / CustomWiggle / ExpoScale 在
  `src/lib/gsap-extras.ts`，只由用到的组件引入）
- Lenis 1.3 惯性滚动，与 GSAP 时钟统一（`gsap.ticker` 驱动 `lenis.raf`）
- three.js：/intro 用 @react-three/fiber + drei，/about 工作台为命令式 three
- Neon Postgres + Drizzle ORM；admin 会话是 jose 签的 JWT，登录按 IP 限流

全站单一动效版本，`prefers-reduced-motion` 只关掉停不下来的那几处——三条
无限 CSS 循环、点阵画布、惯性滚动、开场黑幕（清单与理由见
`src/lib/gsap.ts` 与 `docs/DESIGN.md` §1.5）；SSR 输出完整内容，无 JS 也可读。

两个踩过的坑，改动相关代码前先读：

- **`html` 必须留 `scrollbar-gutter: stable`**。开场遮罩会锁 `overflow`，那一刻
  没有滚动条；ScrollTrigger 若在此时测量被 pin 的段落，会把 pin-spacer 宽度
  写死成含滚动条的宽度，遮罩撤走后整页就能横向滚动 15px。
- **局部接管滚轮不能只靠 `preventDefault()`**。Lenis 的 wheel 监听挂在 window
  上，且**从不检查 `defaultPrevented`**——`/about` 的 3D 工位曾经只调
  `preventDefault()`，实测结果是镜头在推拉的同时页面照样滚走（实测 Δ595px）。
  正确做法是 Lenis 自己的契约 `data-lenis-prevent-wheel`（它沿 composedPath 读
  这个属性），并且**只在真正接管的那一刻打开**。

## 开发

```bash
pnpm dev             # 开发
pnpm build           # 生产构建（构建期读库预渲染，需要 DATABASE_URL）
pnpm start           # 预览生产构建
pnpm check           # tsc --noEmit + oxlint + vitest
pnpm test            # 只跑 src/lib 的纯函数测试
pnpm admin:password  # 生成 ADMIN_PASSWORD_HASH 与 AUTH_SECRET
pnpm db:generate     # schema 改动后生成迁移
pnpm db:migrate      # 应用迁移
```

## 内容存在哪

内容全部在数据库里，日常编辑走 `/admin`。`src/lib/content.ts` 是唯一的读取层：
每个 getter 都带缓存标签，页面照旧全静态预渲染，保存时 `updateTag` 让相关页面
失效即可，不必重新部署。

```bash
pnpm db:check    # 打印库里各表的真实内容
pnpm db:export   # 导出到 backup/（db.json + 文章的 markdown 副本）
pnpm db:import   # 从 backup/ 恢复（按键 upsert，导入后在 /admin 保存一次刷缓存）
pnpm db:studio   # 表格界面
```

`backup/` 跟着仓库走，所以内容仍然有 diff、有历史、有一份能离线读的纯文本副本 ——
这是从文件搬进数据库时唯一真正会丢的东西，用 `db:export` 换回来了。

`messages/*.json` 仍是**全部**文案的默认值；库里的 `copy_blocks` 只是叠在上面的
覆盖层。表空了或者连不上库，站点就照 JSON 显示，不会白屏。

## 内容与模型从哪来

- 那几篇 `note-*` 手札 —— 从旧 VitePress 知识库（fanhefeng/fhf）精选改写
  （OSI 七层、macOS 主机名、JS 三则、简历方法论、《数字僧侣》）。
- /lab/workstation 的工作台
  ["Gaming Desktop PC" by Yolala1232](https://sketchfab.com/3d-models/gaming-desktop-pc-d1d8282c9916438091f11aeb28787b66)
  （CC-BY-4.0，画布下方署名）；原模型 8.5MB 经
  `gltf-transform optimize`（Draco + 1024px WebP）压到 1.1MB，Draco 解码器
  自托管于 `public/draco/`。
- /portfolio 封面照片 `public/portfolio/lamp.jpg`：Sixteen Miles Out 摄，
  [Unsplash License](https://unsplash.com/license)（可商用、无需署名）。
- /lab/lens-slider 的四张照片 `public/lab/lens/`（均为 Unsplash License，
  经 Lorem Picsum 取得，1440px 宽重编码）：`river.jpg` Steve Carter、
  `falls.jpg` Andrew Coelho、`sea.jpg` Anna Popović、`coffee.jpg` Karl Fredrickson。
- 软件版本号：`apps.repo`（owner/name）+ `src/lib/github.ts` 读 GitHub 最新 release，
  `fetch` 缓存一小时；未登录配额 60 次/小时足够，设 `GITHUB_TOKEN` 可放宽。
- /intro 的头像 `head.glb` 由单张照片重建（TRELLIS 风格化 v3），眼镜为程序
  几何补回——重建会把镜片糊成阴影（`docs/INTRO3D.md`）。

部署：Vercel（push 即发布）。
