# fhfs-site 重设计 · 画廊编辑部「The Quiet Issue」

> 本文档是全站重设计的唯一权威依据。由 14-agent 研究/提案/评审工作流产出：
> 三位独立评审（用户契合度 / 可实现性 / 设计品味）一致选出本方案，并嫁接了另两个提案的 15 项优点。
> 研究底稿（GSAP demo 拆解、推文实勘、apple-design skill、HTML-in-Canvas、趋势）见文末「参考材料」。

## 0. 核心概念

把个人站从「深夜爵士俱乐部」改造成**一本安静的个人杂志兼私人画廊**：

- 暖白纸感为默认底色，**文字是绝对主角**——超大负字距无衬线标题 + 衬线 italic 点缀、窄版心、大量留白、一屏一个信息点。
- 玻璃拟态严格降级为「**悬浮层材质**」：灵动岛导航、chip、HUD、面板。玻璃是容器，不是装饰。
- 霓虹时代唯一保留的情绪资产是「**灯**」：全站「开灯」拨杆让 aurora 光晕与双态图像在 1.2s 内交叉淡化（致敬 incommonwith.com）。暗色模式即「闭馆后的画廊」。
- **贴纸**是「内容物」材质，注入个人温度，全站限定 5 处（见 §4）。
- 所有动效遵循 Apple 弹簧语言：进场可华丽、退场必干脆（easeReverse + timeScale 2~2.5）、随时可中断（quickTo / overwrite:'auto'）。每个效果必须回答它服务于安全感/理解/成就/愉悦中的哪一个——答不上来就删。
- 信息架构、内容管线、zh/en 双语、SEO/RSS 基础设施**全部保留**。

## 1. 设计系统

### 1.1 色板

| Token | 亮色（开馆，默认） | 暗色（闭馆） |
|---|---|---|
| 底色 | `#FAF9F6` 纸 | `#0E0E11` |
| 分区底 | `#F2F0EA` | `#141417`（卡底） |
| 文字主 | `#1A1A1A` | `rgba(255,255,255,.92)` |
| 文字次 | `rgba(26,26,26,.72)` | `rgba(255,255,255,.68)` |
| 文字三级 | `rgba(26,26,26,.60)` | `rgba(255,255,255,.45)` |
| Accent（唯一） | 琥珀 `#B45309`（链接下划线/当前态/开灯点缀，对纸底 4.7:1） | `#D97706`（`#B45309` 在 `#0E0E11` 上仅 3.8:1，不足以承载文字） |

> 亮色两级次要文字的初稿值（.62/.40）实测只有 4.8:1 / **2.5:1**，三级文字承载日期、计数与 caption，必须过 4.5:1。层次改由字号与字重承担，不靠淡出。
| 光晕 | — | 暖 `#FFB86B` + 冷 `#6E8BFF`（blur 100px、opacity .12–.18，仅存在于 AuroraLayer） |

- **亮色阴影必须带暖色**：`rgba(120,80,40,0.08)` 系——暖白纸底上冷灰阴影会显脏（评审嫁接）。
- FilmGrain 降维为 **2.5% opacity 纸感噪点层**（GrainLayer），置于玻璃层之上防 banding。
- 品牌色只放实色层，永不进玻璃面。

### 1.2 字体

- EN display：**Inter Display**（`Inter` 可变字重）600–700，`clamp(2.5rem, 7vw, 6.5rem)`，`letter-spacing: -0.03em`，`line-height: 1.05`。
- 衬线点缀：**Instrument Serif** italic（引语/关键词，next/font/google 新增）。
- 正文：Inter 400，16–18px / 1.7。
- 元信息：**Geist Mono** 11–12px uppercase `tracking +0.08em`（版本号/日期/kicker）。
- ZH：PingFang SC 系统栈优先，**Noto Sans SC** 400/500/600 兜底（`preload: false`）；中文标题不做负字距（tracking 0～+0.01em）；引语点缀沿用 Noto Serif SC。
- **删除 Monoton / Poiret_One**。`lib/og.ts` 的 OG 字体同步换为 Inter + Noto Sans SC 子集。
- CJK 字体 `display: swap`；CLS 目标 <0.05。

### 1.3 玻璃材质 · 三档制

CSS 变量双套（亮/暗随 `data-theme` 切换），类名 `.glass-thin` / `.glass-thick` / `.liquid-chip`：

| 档 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `glass-thin` | 卡片/HUD | bg `rgba(255,255,255,.55)` + `blur(12px) saturate(160%)` + border 1px `rgba(255,255,255,.65)` + **border-top 亮线 `rgba(255,255,255,.85)`**（受光统一，评审嫁接）+ shadow `0 8px 32px rgba(20,20,30,.08)` | bg `rgba(20,20,25,.45)` + border `rgba(255,255,255,.10)` + shadow `rgba(0,0,0,.35)` |
| `glass-thick` | 灵动岛展开/FullNav/面板 | `blur(20px) saturate(180%)` + bg `rgba(255,255,255,.72)` + border-top 1px `rgba(255,255,255,.8)` + inset `0 1px 0 rgba(255,255,255,.6)` + shadow `0 16px 48px rgba(20,20,30,.16)` | bg `rgba(16,16,20,.62)` |
| `liquid-chip` | chip/ProgressHud 胶囊/小按钮 | bg `rgba(255,255,255,0.15)` + `blur(2px)` + inset 高光（评审嫁接，低成本 Liquid Glass 小件质感） | bg `rgba(255,255,255,0.06)` + `blur(2px)` |

**铁律**：玻璃背后必须有 aurora/图像可折射（纯色底上禁用）；禁止玻璃叠玻璃；玻璃面文字走 vibrancy（`text-*/90` + font-medium + tracking 微增）；单屏玻璃 ≤3 处（liquid-chip 减半计数）；blur ≤20px，移动端降至 8–10px。
`@custom-variant` 支持 `prefers-reduced-transparency`（全部玻璃退实色卡）与 `prefers-contrast: more`（近实色 + 明确对比边框）。

### 1.4 圆角与阴影

圆角：10px（chip/按钮）/ 16px（卡片）/ 24px（面板）/ full（胶囊岛）。
阴影动画一律**双层伪元素 opacity 交叉淡化**，禁止 tween box-shadow。

### 1.5 动效 token（`src/lib/gsap.ts` 唯一中心）

```ts
gsap.defaults({ duration: 0.35, ease: 'power3.out' })  // 临界阻尼
export const EASE = {
  default: 'power3.out',
  momentum: 'back.out(1.2)',   // 仅手势带动量场景
  exit: 'power2.in',
}
```

- 退场统一：反向 ease + `timeScale(2~2.5)`。
- 滚动 reveal：`y:24 / opacity:0 → 0.6s power2.out`，单次触发。
- materialize（面板出现）：`--panel-blur 20→0`（@property 注册）+ `scale .96→1`，0.4s，仅入退场瞬时 tween backdrop-filter。
- 开灯/主题切换：**1.2s `cubic-bezier(.42,0,.58,1)`**，包 `document.startViewTransition`，≥300ms 防亮度跳变。
- press 反馈基类：`a, button { active: scale-[0.97], 100ms ease-out, touch-action: manipulation }`。
- hover tween 硬规则 `overwrite: 'auto'`；插件注册：ScrollTrigger / SplitText / Flip / Draggable + InertiaPlugin / **ScrambleTextPlugin（补注册）** / CustomEase + CustomWiggle。
- 每个动效组件内建 `gsap.matchMedia('(prefers-reduced-motion: reduce)')` 分支。

### 1.6 暗亮模式（「开灯」叙事）

- 亮色默认，尊重 `prefers-color-scheme`；手动开关即「开灯/闭馆」。
- **保留三件套契约**：localStorage `'fhfs-theme'` + `documentElement.dataset.theme` + window `'fhfs:theme'` 事件（layout.tsx 的 inline 预置 script 保留）。
- 开关组件：`LightSwitch`（玻璃拨杆，继承 PullCord 的灯绳精神），联动 aurora、Software 双态截图、主题。
- 多模态（全站唯一允许处）：AudioContext 预解码合成「咔哒」轻响（零冷启动延迟，不引音频资产）+ `navigator.vibrate(10)`。

## 2. 页面规格

### 2.0 全局壳层

**Header 灵动岛**：顶部居中玻璃胶囊（glass-thick）。收起态 = logo 角标 + 汉堡；展开至 ~400px 依次露出 4 个导航项 + zh/en + 开灯拨杆。
动效（JoRMPLg 蓝本）：岛体 `back.out(2)` 弹性拉宽、easeReverse 收回（timeScale 2.5，若 GSAP easeReverse 不可用则独立收起 timeline）；汉堡→X 直接 tween SVG line 的 `attr:{x1,y1,x2,y2}`；菜单项 stagger .05 上浮；描边接跟随光标的 `fePointLight`「手电扫过玻璃边缘」高光；`aria-current` 页用 Flip 平移的胶囊指示器；滚动后岛下缘 scroll-edge 渐隐（mask-image 渐变）。清理原 PullCord 避让 hack（`mr-12 min-[1120px]:mr-0`）。
**logo Flip 共享形变**（评审嫁接）：首页 hero 站名大字 → 灵动岛角标的 Family 式连续形变（Flip，仅首页）。

**FullNav**（移动端为主）：glass-thick 全屏层，display 大号导航词 + 次级链接（RSS/GitHub）+ 语言/主题。打开时 main `scale .98 + blur 2px` + scrim 后推。
动效（raMQBVQ 机制）：进场 fromTo 滑入 `back.out(1.2)` + 链接级联；退场改**整体下沉 + 模糊消散**（舍弃随机旋转坠落）；中途可点击立即反向；滚动锁定沿用 lenis `stop → scrollTo(immediate) → start → ScrollTrigger.refresh()` 契约；Esc/focus trap/aria-expanded 保留。

**Footer**：单行式极简：小字站名 + 导航 + RSS/GitHub + 本地时间落款（`Intl.DateTimeFormat` + `timeZone: 'Asia/Shanghai'`，「HH:mm in Qingdao」）+ 主题拨杆副本；右下角一张**可撕小贴纸**，撕开露出 email（CSS 3D 翻折 + 双层阴影，无 WebGL）。其余全静态——页脚是全站最安静的地方。ASCII 霓虹画退役。

**RouteTransition**：保留机制骨架（捕获阶段点击拦截 / cover-reveal 状态机 / forceClear 兜底 / reduced-motion 直通 / `data-no-transition` 逃生口），幕布换玻璃 materialize：新页 `--panel-blur 20→0 + scale .98→1 + opacity`。locale 切换走 `document.startViewTransition` 整页 cross-fade。转场可中断、不锁 pointer-events。

**Loader（开灯仪式）**：首访每 session 一次，0.9s：**黑场中一枚小灯亮起，光晕以 clip-path 圆形扩散揭幕**（评审嫁接，替换纯 cross-fade）→ masthead 显形。保留 sessionStorage `'fhfs-overture-seen'` + `'fhfs:overture-done'` 事件握手。

**AuroraLayer**（替代 Atmosphere/Starfield）：fixed 双光晕层（一暖一冷），纯 CSS 渐变（非 WebGL），60–120s 超慢呼吸（transform only），暗色模式亮度提升。
**GrainLayer**（替代 FilmGrain）：2.5% 纸感噪点。
**ProgressHud**：重写为 liquid-chip 玻璃小胶囊阅读进度（仅 Blog 详情显示），唱机退役。

### 2.1 首页 `/[locale]`

编辑部封面式单栏（版心 680px，hero 破格 920px）：

1. Masthead：小字站名 + 灵动岛。
2. **Hero**：超大排印宣言（EN clamp 至 6.5rem + 中文副标），关键词切 Instrument Serif italic；**kinetic 字母机关**——宣言中一个字母的笔画是一根滑入的电线，插头「咔哒」接通瞬间点亮 hero 玻璃卡 specular 描边（灯叙事闭环；zh locale 机关落在英文副标上）；文字后方 AuroraLayer 双光晕。
3. **横向宣言段**：一句双语 slogan，桌面 pin 横移一屏 + SplitText 字符随机散落回弹（MYyBrZw，全站唯一 pin 段落；移动端 matchMedia 降级纵向淡入；locale 切换后重 split）。
4. 最近文章：纯文字列表 4 篇（标题+日期，hover 显示阅读时长）。
5. 自研软件 mini-bento：6 卡（2 大 4 小）。
6. About 引子两行 + 链接。

动效：开灯 loader → hero SplitText 行级 mask-reveal（`y:110%→0`, stagger .08）→ 插头机关。列表与 bento 统一 y24 reveal + stagger .06。CTA 用 Magnetic（quickTo 版）。
原六幕组件（NeonSign/ClubWindow/NotesDeck/PoemInterlude/TourRoad/AppsSlider/PosterWall/PlanetStage）全部退役；POEM_LINES 的诗已存在于博文 note-digital-monk，不丢失。

### 2.2 About `/[locale]/about`

窄栏 720px：

1. 引子：姓名 + 身份关键词（衬线 italic）。
2. Workstation 3D 工作台**保留**，视口门控懒加载（不新增 three.js 场景；未来任何全屏 WebGL 需求优先裸 WebGL2，防依赖回潮——评审嫁接）。
3. Mdx 正文 65–75ch / 18px / 1.7。
4. **贴纸墙**：兴趣/技能/城市做成白描边贴纸（`<Sticker>` 组件），微随机 rotate(-3°~3°)，可拖拽（Draggable + InertiaPlugin `minimumMovement:10`，超界 rubberband）；极坐标弧形 stagger 入场（`i*0.05 + elastic.out(1,0.5)`，gbwvbgQ 模式）；hover CustomWiggle 微抖（wiggles 6–8、rotation 5–8°）+ 揭角投影变软；拖拽松手飘出 1–2 枚小贴纸向上淡出（WbbEGmp 降维，池 8 个）。
5. **时间线 → Changelog 版本履历**（评审三方一致嫁接）：条目改为 `fhf 1.0 → 5.x` 版本号式（Geist Mono 版本号 + 日期 + 一句话），玻璃便签卡材质；年份数字 Family 式 snap 滚动；节点 tooltip easeReverse 弹性冒泡。**内容纪律：不编造个人经历**——用可从仓库/作品推断的真实事实填充，未知处保留明确占位并在交付报告中提示用户补填。
6. 页尾本地时间落款。

### 2.3 Blog 列表 `/[locale]/blog`

杂志目录页 720px：大标题「文章 / Writing」+ **按年份分组的纯文字列表**（标题 20–22px、日期 mono 右对齐）+ 标签云一行。8 篇内容量刚好一屏半，不做卡片网格。SplitFlap 删除。
**TagPill 贴纸化**（评审嫁接，放宽贴纸配额）：标签云用轻量白边贴纸（微随机旋转）；文章详情页 meta 行保持极简文字 tag。
动效：页标题一次 SplitText 行 reveal；列表项 stagger .05 淡入；hover 下划线 250ms + 阅读时长浮现；chip press scale .97；筛选态显示「N 篇 · 清除筛选」出口。

### 2.4 Blog 详情 `/[locale]/blog/[slug]`

居中单栏 68ch。display 阶梯标题、mono 元信息、isFallback 玻璃提示条**保留**；`.prose-club` 重写为 `.prose-editorial`（衬线引语块、琥珀下划线链接、大圆角图片、rehype-pretty-code 配色适配双主题）；底部上一篇/下一篇 + 返回列表。
动效：EN 标题 ScrambleText 一次性解码（0.9s，`chars:'lowerCase'`，仅播一次）；**zh 标题改行级 mask-reveal（中文一律不 scramble）**；顶部 sticky 区 6 层 progressive blur scrim；正文不做逐段动画（阅读优先）；移动端右下 **radial FAB**（分享/回顶/RSS/主题）沿 90° 弧 elastic 炸开、easeReverse 收回（gbwvbgQ；桌面端不出现）。

### 2.5 Portfolio `/[locale]/portfolio`（重定位「作品画廊 / Craft」）

上部 **bento 拼贴 hero**（6–8 张 app 截图/实验封面，复用 software 数据，兼容未来 works YAML）；下部 rauno.me Craft 式**实验列表**（每件动效实验一行：名称+一句话+状态），收录「玻璃 hero 实验」「liquid glass 透镜」「Three.js 碎玻璃（链接+降级截图）」等条目。
**空状态兜底**（评审嫁接）：works YAML 为空时渲染「正在布展」glass-thick 卡 + 引导跳 Software。
动效：**bento scrub 推近 hero**（vYMzKZx：Flip 捕获终态 + expoScale + pin 一屏，滚动把拼贴推成近全屏——「走近展品」；动画期间 backdrop blur 降档；resize revert 重建）；卡片 hover `feSpecularLighting` 描边点亮（光源色取项目主色）；Chrome 增强（P4）：实验条目内嵌 HTML-in-Canvas liquid glass 透镜 demo，其余浏览器静态截图 + 说明。PosterWall/PosterLightbox 退役。

### 2.6 Software `/[locale]/software`

bento grid（Apple keynote 式）：**分段控件筛选 All/Desktop/Tool/Game/Website + Flip 卡片重排**（评审嫁接：元素从上一状态继承位置）；主打 app col-span-2 大卡（深/浅**双态截图**，随全站开灯拨杆 1.2s cross-fade + startViewTransition，预加载目标态图 `Promise.allSettled`）；卡片 glass-thin + 图标白边贴纸化；页尾「设备框架」段落：Mac/iPhone 玻璃框 + 分段控件切换 6 个 app 截图。
动效：bento stagger .06 入场；hover lift `y:-4` + 双层阴影交叉；分段控件指示器 Flip 平移；移动端横滑 Draggable + inertia snap（RwKwLWK 裁剪版：seamlessLoop + offset 代理 + snap，无 pin），snap 到位 `1.0→1.03→1.0` 微缩放；Chrome 增强（P4）：hover elastic bulge。

### 2.7 404 `not-found.tsx`

display 大字 404 + 一句话 + 两条出路（回首页/看文章）；一角**可剥离大贴纸彩蛋**（Draggable + clip-path 分割贴住/翘起区、投影随 lift 变软变大，撕开露一句话）。
动效：404 数字 0.8s ScrambleText 解码（`chars:'0123456789'`——评审嫁接的参数）；P4 可选：文字吹散 canvas 粒子彩蛋（≤3000 粒 2D，按屏宽 1800/4500/9000 分档，移动端与 reduced-motion 禁用）。

## 3. 组件处置清单

**原样保留**：src/i18n/* + proxy.ts、content-collections.ts、lib/content.ts、lib/seo.ts、sitemap/robots/rss、JsonLd、SmoothScroll（lenis + `window.__lenis` 契约）、Magnetic（quickTo 校准，azmKBBJ）、lib/gsap.ts 注册点模式、layout.tsx 主题预置 script、全静态策略（generateStaticParams + dynamicParams=false）。

**重写视觉、保留机制**：RouteTransition、CinematicLoader→OvertureLight、ProgressHud、FullNav、Footer、Header、PullCord→LightSwitch（三件套契约迁移）、Timeline→Changelog、Mdx/prose、PostCard/TagPill/AppCard/WorkCard、SectionTitle、not-found、两处 opengraph-image + lib/og.ts 视觉、icon.svg 新站标（简约 monogram）。

**删除**（页面重写完成后统一删文件+资产）：NeonSign、MarqueeLights、FilmGrain（→GrainLayer）、NoteTrail、Atmosphere（→AuroraLayer）、ClubWindow、NotesDeck、PoemInterlude、TourRoad、AppsSlider、PosterWall、PosterLightbox、PlanetStage（+public/models/planet + footer 署名）、Starfield、SplitFlap、NeonLogo、ArtDecoDivider、PullCord、SpotlightReveal（被新 Reveal 取代则删）。

**内容纪律**：博客正文（hello-club、on-side-projects 等）是用户的写作，**一律不改动**；messages/*.json 键结构不动、值全面去俱乐部隐喻；site.ts 更新站点定位描述；timeline 换 Changelog 结构、不编造事实。

## 4. 贴纸配额（全站限定 5 处，评审要求的收敛清单）

1. About 贴纸墙（核心，可拖拽）
2. Footer 可撕小贴纸（露 email）
3. Software app 图标白边贴纸化
4. 404 大贴纸彩蛋（可剥离）
5. Blog 列表页标签云轻量贴纸

`<Sticker>` 通用组件：SVG `feMorphology` dilate 白边，零 JS、SSR 安全（sticker.oooo.so / Sticker Forge 思路）。材质纪律：贴纸=内容物、玻璃=容器。

## 5. 工程规则（实现 agent 必读）

### 5.1 Next.js 16 硬规则（violating = build 失败）

- `params`/`searchParams` 是 **Promise，必须 await**（page/layout/route/generateMetadata/opengraph-image 全部）；类型用 `PageProps<'/route'>` 助手。
- `cookies()/headers()` 只能 await。
- middleware 叫 **src/proxy.ts**（勿建 middleware.ts；勿在其中 export runtime）。
- Turbopack 默认；**勿加 webpack 配置**。dev/build 有 lockfile——**禁止并发跑 build/dev**。
- fetch 与 GET Route Handler 默认**不缓存**；静态化要显式 `force-static`（rss.xml 已是）。
- 本项目未开启 cacheComponents：**禁止 `'use cache'`/cacheLife/cacheTag**。
- `next/image`：`priority` 已废弃 → 用 `preload`/`fetchPriority`；远程图必须 remotePatterns。
- root layout 是 `src/app/[locale]/layout.tsx`，勿建顶层 layout；勿手写 `<head>`。
- 勿给 html 加 CSS smooth-scroll（与 Lenis 冲突）。
- `next lint` 已删除。
- 全部动态路由：generateStaticParams + `dynamicParams = false`，保持纯静态输出。
- 导航一律 `@/i18n/navigation` 的 Link/useRouter/usePathname（勿直接 next/link）。
- 每个 page/generateMetadata：`hasLocale` 校验 + `setRequestLocale(locale)`；翻译用 `getTranslations`/`getFormatter`。
- `'use client'` 只加在交互/GSAP 组件；页面文件保持 Server Component。
- 完整规则与出处：研究底稿 r05（见 §7）。

### 5.2 项目契约（跨组件耦合，破坏即回归）

- 主题三件套：localStorage `'fhfs-theme'` / `data-theme` / `'fhfs:theme'` 事件。
- 滚动锁定：覆盖层暂停走 `window.__lenis.stop()` + overflow hidden，恢复必须 `scrollTo(y,{immediate,force}) → start() → ScrollTrigger.refresh()`。
- Loader 握手：sessionStorage `'fhfs-overture-seen'` + `'fhfs:overture-done'` 事件。
- RouteTransition 捕获阶段拦截 `<a>`：外链/锚点/`data-no-transition`/modifier 键放行。
- `html { scrollbar-gutter: stable; overflow-x: clip }` hack 保留（globals.css 有详注）。
- 内容管线：blog/about 用 `.zh.mdx/.en.mdx` 后缀；works/apps/timeline 用 YAML 内嵌 `{zh,en}`；locale fallback + isFallback 提示条行为保留。
- OG 图构建期联网拉 Google Fonts（lib/og.ts）——换字体先本地跑通 build。

### 5.3 性能预算

LCP ≤1.8s（hero 纯文字）；INP <200ms；滚动 60fps：只动 transform/opacity，backdrop-filter 仅入退场瞬时；首页 JS <180KB gz（three.js 移出首页）；aurora 纯 CSS；canvas 增强层「静止停在最后一帧、零持续开销」（评审嫁接的通用验收项）。

### 5.4 HTML-in-Canvas（P4 纯增强）

SSR 永远输出完整 DOM；`src/lib/htmlInCanvas.ts` 导出 `supportsHtmlInCanvas()`（检测 `drawElementImage`/`getElementTransform`/`texElementImage2D`），客户端 useEffect 通过后才挂 canvas 层并由 JS 添加 `layoutsubtree`。兜底链：liquid glass→CSS backdrop-filter；elastic card→GSAP hover；翻页→View Transitions→opacity。Origin Trial token 需用户自行注册（Vercel 域 + localhost），placeholder 留 TODO。

## 6. 实现顺序

- **P0 基础层**：globals.css @theme 换代（色板/字阶/玻璃三档/圆角/motion 变量/reduced-transparency variant/press 基类）+ lib/gsap.ts（defaults/EASE/补注册 ScrambleText+Flip+Draggable+Inertia+CustomWiggle）+ layout.tsx 字体换代 + AuroraLayer/GrainLayer + `<Sticker>` + messages/site.ts 文案换代。
- **P1 壳层**：Header 灵动岛 + FullNav + Footer + LightSwitch + RouteTransition + OvertureLight loader + ProgressHud。
- **P2 页面**（纪律：**先静态布局跑通类型检查，动效后补**——评审嫁接的交付纪律）：首页、About、Blog×3、Portfolio、Software、404。
- **P3 记忆点收口**：specular 描边、撕纸、开灯音效+震动、logo Flip 形变、bento scrub 调优。
- **P4 可选增强**：HTML-in-Canvas 三项、404 粒子、About 序列帧。
- **收尾**：删除退役组件与资产、OG 图/icon 新视觉、build + 浏览器逐页走查（双语×双主题×移动端视口）+ 终审 review。

## 7. 参考材料（研究底稿，实现时按需深读）

Session scratchpad：`/private/tmp/claude-501/-Users-fhf-IT-code-mine-fhfs-site/91b50f46-b1f3-483c-bca2-683e34a954bc/scratchpad/`

- `r01.json` — apple-design skill 19 条规范（press/弹簧/可中断/rubberband/vibrancy/scrim/热区…）
- `r02.json` — HTML-in-Canvas 现状、API、demo、降级
- `r03.json` — 代码库全量审计（组件逐个处置依据）
- `r04.json` / `r07.json` — 11 个 GSAP demo 源码级拆解（azmKBBJ 磁吸、vYMzKZx bento Flip、RwKwLWK 无限流、JoRMPLg 灵动岛、gbwvbgQ 径向 FAB、JoRZaLY easeReverse、raMQBVQ 全屏菜单、MYyBrZw 横向散落、VwgevYW 序列帧、QWzZwxR scramble）
- `r05.json` — Next.js 16.2.11 规则全文（含出处）
- `r06.json` — 简约风趋势（rauno.me/emilkowal.ski/Linear/Family/Daylight 等）
- `r08.json` — 6 条推文 + 3 网站浏览器实勘（feSpecularLighting、state-aware 图、粒子、碎玻璃、pretext、kinetic type、Sticker Forge、shulexiong、incommonwith）
- `r09–r11.json` — 三份提案全文；`r12–r14.json` — 三份评审
