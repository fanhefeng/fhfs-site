# fhfs-site 重设计 · 画廊编辑部「The Quiet Issue」

> 本文档是全站重设计的唯一权威依据。由 14-agent 研究/提案/评审工作流产出：
> 三位独立评审（用户契合度 / 可实现性 / 设计品味）一致选出本方案，并嫁接了另两个提案的 15 项优点。
> 研究底稿（GSAP demo 拆解、推文实勘、apple-design skill、HTML-in-Canvas、趋势）见文末「参考材料」。
>
> **视觉设计仍然照本文档执行；内容管线已经不是了。** 后来内容从 `content/` 下的
> MDX/YAML 迁进了 Neon Postgres（Drizzle 读取，`src/lib/content.ts` 是唯一读取层），
> content-collections 已移除，`dynamicParams = false` 也全部删掉——新文章要能不重新
> 部署就访问。下文凡提到内容文件、content-collections、全静态策略的段落，读作历史。
> 现状见 README「内容存在哪」。
>
> **2026-08-25 修订（简化 + 实验室效果回流站内）**，覆盖下文与之相悖的段落：
> - 首页封面是 **grove**（`/lab/grove` 的程序化苔藓场景，`GroveHero`）：宣言站在苔藓前，
>   自带 dock；滚过 hero 后灵动岛顶栏才出现（`hero.css.ts` 的 `data-grove-header`）。
>   原 `HomeHero`（插电亮灯机关）与独立的 `/grove` 页已退役，`/grove` 308 到首页。
> - **横向 pin 标语段（`ManifestoBand`）搬到 `/about`**，位于引子与正文之间；仍是全站唯一 pin。
> - `/portfolio` 的 bento scrub（`BentoHero`，vYMzKZx）**删除**——用户明确不要「滚动放大」。
>   封面改为 `DissolveHero`：一张暗室台灯的照片（Unsplash，Sixteen Miles Out）随滚动溶解成
>   当前主题的纸色（复用 `/lab/dissolve` 的标量场阈值着色器，纸色跟随 `fhfs:theme`）。
>   「上机看看」设备框段从 `/software` 搬到这里；`/software` 只剩 bento。
> - `/about` 的 3D 工作台搬到 `/lab/workstation`（第六则研究）；`/lab/[slug]` 各研究改为
>   `next/dynamic` 按路由拆包（`LabStudy`）。
> - 主导航只留 文章 / 软件 / 关于 / 实验室；作品、简历进页脚与全屏菜单，/intro 仍只在 sitemap。
> - 软件版本号不再手写：`apps.repo` 列 + `src/lib/github.ts` 读 GitHub 最新 release
>   （`fetch` 缓存 1h，失败即不显示）。
> - 贴纸/履历/简历/about/文案全部换成用户本人的信息（上海、河津、北京、青岛；小提琴、游戏、
>   电影、球场、旅行、好奇心）；/intro 七枚贴纸主题随之改为 FRONTEND / VIOLIN / PLAYER 1 /
>   CINEMA / GAME ON / WANDER / CURIOUS（`stickers.ts` 的角度未动，只换 id/label/icon）。
> - 字体：Noto Sans/Serif SC 改 `weight: "variable"`（每页少 ~100 KB gz 的 `@font-face`）。
>   GSAP：核心只注册 ScrollTrigger/SplitText/Flip/CustomEase；Draggable/Inertia/ScrambleText/
>   CustomWiggle/ExpoScale 在 `src/lib/gsap-extras.ts`，谁用谁引。

> **2026-08-26 修订（首页拆幕 · 推近回来了）**，覆盖上一次修订里与之相悖的段落：
> - 首页不再由 `GroveHero` 一屏承担全部。它拆成**三幕**：
>   1. **开卷**（`components/home/Opening.tsx`）——纸白、纯排印。宣言两行行级 mask-reveal、
>      一段 lede、全站唯一主 CTA（`LiquidPill`），和一条 mono 事实线（现居/前端/写下的 N 篇/
>      自研 N 个，后两个数字读自数据库）。这一屏没有 3D、没有卡片、没有 dock。
>   2. **推近**（`components/grove/GroveApproach.tsx`）——`/lab/grove` 的场景以全视口尺寸
>      渲染在一个 CSS sticky 框里，滚动条打开框前的 `clip-path` 窗口（31%/29% → 0），
>      场景同时反向 scale 1.16 → 1。**这就是被删掉的「滚动视口放大」，换了个落点回来**：
>      它补的是纸白与林下之间那道材质断裂。canvas 尺寸全程不变，所以推近不会让场景
>      每帧重解相机。
>   3. **溶回**（`components/grove/PaperDissolve.tsx`）——`/lab/dissolve` 的标量场阈值，
>      反过来当纸色覆盖层用：不采样图，只按 `1 - mask` 输出纸的 alpha，让合成器去混。
>      裸 WebGL2，一个三角形一个 shader。
> - **灵动岛全程常驻**。`GroveHero` 的 dock、两张浮动玻璃卡、两枚统计、圆形播放钮、
>   竖排滚动提示全部退役（信息去处见下），`hero.css.ts` 里那条让 header 让位的
>   `body:has(.gh-hero) > header` 规则随之删除。唯一保留的例外：读者站在林子里时
>   （`body[data-grove-immersed]`）header 的纸色 scroll-edge scrim 暂时隐身。
> - `LiquidPill` 的样式从 grove 的表里搬进 `components/grove/pill.css.ts`，由组件自带；
>   plate 默认改为**实色近黑**（`--lp-plate`），因为它现在站在纸上而不是林子里，
>   暗色下抬到 `#262a22`；阴影按 §1.1 换成暖色。
> - **`/about` 的横向 pin 段改纵向**（`ManifestoBand`）。全站唯一的 pin 从此是首页的推近段：
>   一段读者正在**阅读**的页面里再插一个 pin，只会打断栏目节奏。字符散落回弹保留，
>   改为进视口时一次性播放。
> - `/portfolio`：`works` 为空时渲染「正在布展」玻璃卡（原 `emptyTitle/empty/emptyCta`
>   三个键一直在 messages 里没接上）；craft 列表在 `experiments` 为空时回落到
>   `LAB_ENTRIES` 全部条目，用 `lab.items.*` 自己的名字与摘要，每行链到那则研究——
>   不编造，也不再只剩一个标题。CraftList 的 `href` 现在按是否以 `/` 开头区分站内/站外。
> - **两张纸卡回到推近段里**（`components/grove/GroveCard.tsx`），覆盖上面那条「两张浮动
>   玻璃卡退役」——退役的是 `GroveHero` 的**玻璃**卡与它整套 dock/统计/播放钮，回来的是
>   另一样东西：一张站在苔藓**后面**、一张站在**前面**的纸卡。这是这一段唯一能做而照片
>   做不到的事——卡片不可能站在一张树林照片的后面，只可能站在一片还在被画出来的树林
>   后面。做法沿用 `PortalCard` 留下的那条：卡 a 不带 z-index（`z-index: auto` 不开层叠
>   上下文，于是它画在 canvas 之下，根从它底边横过去），卡 b 在 z 3；卡 a 的旋钮因此
>   不能长在卡里，单独渲染成 `GroveKnob` 骑在苔藓上。**两张卡是一对**，沿一条对角线角挨
>   角地站着——层次是这两张同样大小的纸互相比出来的，把它们拆到画面两角，各自也压着苔藓，
>   但没有参照物了。
>   位置**照抄旧版坐标**（2026-08-26 晚改回）：卡 a `890 × 200`、卡 b `1237 × 482`、
>   浮动旋钮 `1142 × 427`——树干从卡 a 右下象限斜穿过去（压角、让开标题），卡 b 站在
>   树干根部前面、三面露苔藓。此前一版以为挂点从 `-440u` 改到 `-593u` 后树干在 stage
>   坐标里挪了位，把卡对挪到了 `950 × 380 / 610 × 575`，结果卡 b 压在 caption 上方、
>   树干只擦过卡 a 一角，前后层级读不出来。浏览器里把旧坐标注回去对照过：根是按 stage
>   坐标摆的，stage 挂在哪里树干都从卡的同一处穿过，挂点只决定整组在画幅里的高低。
>   扁画幅不再单开 media query：`.ga-stage` 的 `margin-top` 取
>   `max(-593u, 70px - 50svh - 200u)`，一旦卡 a 顶边会顶到画幅顶 70px 以内，整组
>   （苔藓 + 卡对）一起下移，构图不变。指针视差会让树干的穿越点左右滑几十像素，
>   所以卡角压进树干的量留得比「刚好碰到」多。
>   节奏是滚动的纯函数：`--ga-card` 比 caption 早到晚走，`round(down, …)` 让相片分十二级
>   显影（这是 `PortalCard` 那台低带宽接收机，把时钟换成了滚动条），纸洗从上面盖过去时
>   `--ga-card-hit` 一并收掉命中区。**竖屏只留后写的那张**：窄画幅里近根从边到边占满
>   中段，卡片放它后面不是被垂过肩膀而是被活埋，且 caption 本身就是实验室那张卡的文字版。
> - **实验室第五则 `/lab/grove-stage`**（`components/lab/GroveStageDemo.tsx`）：同一片苔藓
>   加两张纸卡的构图本身，作为一则研究单独陈列。复用推近段的 DOM 与 `approach.css.ts`
>   （同一套 `.ga-*` 规则，`--ga-open` 钉死为 1），只改两处：stage 按参考构图**居中挂**
>   （`-440u`，参考的卡片坐标就是对着这个挂点描的），卡片的升起与相片十二级显影不再由
>   滚动条驱动，改为场景就绪后用 GSAP 播一次。卡片坐标与首页同一组（`890 × 200` /
>   `1237 × 482` / 旋钮 `1142 × 427`）。窄画幅两张都留（首页只留一张）：stage 上提 400u，
>   近拱的脚压过卡 a 顶边，卡 b 在下面站在前面，框随内容长高而不裁切。实验室从此七则，
>   液态金属与工作台顺延为 06 / 07。参考构图的出处：仓库里（注释、文档、提交记录）
>   都没有记下链接，只留了「the reference」这个指代和从它描下来的坐标。
> - **推近段的性能账**（2026-08-26 晚实测，Chrome + Apple GPU，1440 × 900，读者站在林子里
>   静止不动；指标是 `ioreg` 的 GPU Device Utilization 与 Chrome GPU 进程的 CPU）：
>   改前 GPU ~38%、GPU 进程 CPU ~26%；改后静止 GPU ~10%、CPU ~12%。钱花在哪里，
>   和直觉相反：把草从 19 万根砍到 5 千根、像素预算从 3.4M 降到 2.5M、关掉 MSAA，
>   GPU 进程的 CPU 一个点都不动——**着色器不是大头，每帧把画布呈现出来、再把整页
>   合成一遍才是**，而且是按帧计费。所以做的是：
>   1. `body[data-grove-live]`——`GroveScene` 在真正画帧的那段打上，`approach.css.ts`
>      让 grain（一张 300% 大的 `mix-blend-mode: overlay` 层）隐身、aurora 淡出、
>      灵动岛的 backdrop blur 换成 reduced-transparency 那套不透明纸色。这三样在静止页面
>      上免费，在每秒 60 次变化的画布上每帧都要重做，合起来约占一帧开销的三分之一。
>   2. 指针 / 滚轮 / 键盘 2.5s 没动静就降到 30fps（`FPS_IDLE`），一动立刻回 60；失焦仍是 30。
>   3. 近根的 bark / grass / fern 在扫描结束后换成 `#define SETTLED` 的副本，把两处
>      `discard` 编译掉：带 discard 的片元着色器让 tile-based GPU 无法做隐藏面剔除，
>      一层层草全都得着色。副本在扫描期间用 `renderer.compile()` 预先链好，换材质那帧不卡。
>   4. 纸洗盖满（`coveredRef`）后场景停画；`PaperDissolve` 没有纸要画时把自己的画布
>      `visibility: hidden`，不再让合成器每帧多混一张透明全屏层；视差 `--px/--py` 只在
>      段落可见时写。
>   5. 像素预算 3.4M → 2.8M（1440 × 900 上 dpr 1.62 → 1.47）。MSAA 保留：关掉只省 ~8 个点
>      GPU，草边缘会毛。
> - 未动的两项，理由记在这里免得重来：**融化式文字没有进 404**（那个数字上已经有粒子
>   彩蛋在讲「解码成型」，两个叙事叠在同一个数字上只会互相打架——§2.7 记过这一条）；
>   **滚动即播放没有进 `/software`**，因为设备框段需要每个 app 一段操作录屏拆帧，
>   现有的 34 帧是森林素材，缺素材。

> **2026-08-26 补记（第八则研究：镜头畸变滑块）**：
> - `/lab/lens-slider`（`components/lab/LensSliderDemo.tsx`，着色器与滚动算术在
>   `lib/lensSlider.ts`）：四张照片的全视口滑块，换页是一颗从画面中心长出来的透镜——
>   圆内是下一张图，像素朝圆心拉的量是「到圆边有多近」的五次方，所以只有贴边一圈在放大；
>   圆过半对角线即盖满画幅，其余进度都在让这圈松开。蓝本是 Oscar Pico 的作品滑块，
>   按抖音 TTTISE 的拆解复刻，只多加了一圈随进度散去的水波纹（`RIPPLE`，置 0 即原样）。
> - 交互仍是实验室的规矩：stage 按每张一屏 pin 住，滚动条跨进哪一格就朝哪一张开透镜；
>   过渡是真 tween（`LENS_DURATION` 1.7s，`power2.inOut`）而不是 scrub——开一半停住的透镜
>   只是一张坏图。开到一半往回滚，tween 与文字时间线一起 `reverse()`；一次滚过两格，第二颗
>   透镜排队在第一颗落地后开。左下角一对箭头把页面滚到目标格的中点（`bandCentre`），
>   交给 pin 触发。画布只在透镜在动或尺寸变化时画帧，停在两张之间零开销（§5.3）。
> - 文案四段都在 DOM 里（无 JS 也整页可读），标题用 `lib/splitText` 在服务端拆字，
>   按词做 overflow mask，字符沿 y 进出。纹理不设 colorSpace：这段着色器没有 colorspace
>   pass，让 three 解码只会输出线性值。四张照片来源见 README「内容与模型从哪来」。

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
| 光晕 | — | 暖 `#FFB86B` + 冷 `#6E8BFF`（blur 100px、opacity .12–.18，仅存在于 AuroraLayer） |

> 亮色两级次要文字的初稿值（.62/.40）实测只有 4.8:1 / **2.5:1**，三级文字承载日期、计数与 caption，必须过 4.5:1。层次改由字号与字重承担，不靠淡出。

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
- hover tween 硬规则 `overwrite: 'auto'`；插件注册分两层：`src/lib/gsap.ts` 只注册全站都要的 ScrollTrigger / SplitText / Flip / CustomEase；Draggable + InertiaPlugin / ScrambleTextPlugin / CustomWiggle / ExpoScaleEase 在 `src/lib/gsap-extras.ts`，只由用到它们的组件引入（贴纸墙、移动端软件横滑、404、文章标题）。
- **全站单一动效版本，不再按 `prefers-reduced-motion` 分档**（2026-08-04 决策，取代原「每个动效组件内建 reduce 分支」的规则）。
  原因是实测的误伤面：Windows 上该信号写作「显示动画」，被「轻松使用」开关、**性能选项 →「调整为最佳性能」**、节电模式任意一个关掉都会置为 `reduce`。这批访客从未表达过「少一点动效」，却拿到一个残缺版本且无从察觉——`/intro` 直接退化成纯文字简历，而这张脸就是那一页的全部内容。
  这条规则覆盖**所有**表达方式，包括 Tailwind 的 `motion-reduce:` 变体——它编译出来就是 `@media (prefers-reduced-motion: reduce)`。首次执行时漏掉了这一类（只 grep 了 `prefers-reduced-motion` 字面量），复查时补删 9 处；以后加动效不要再引入。
- **唯一例外：停不下来的那几处**（2026-08-05 补回）。判据只有三个字：**循环、大面积、夺走滚动**。WCAG 2.2.2（Pause, Stop, Hide）要求超过 5s 的自动运动必须可停，而浏览器只给了 `prefers-reduced-motion` 这一个信号——全删等于把「不能停」写死。当前落在例外里的一共五处，不要再扩：
  - CSS，globals.css 里同一个 media block：`.aurora-blob`、`.grain-layer`、`.pulse-stepped` → `animation: none`。光、纸和滚动提示都还在，只是不动。
  - `SmoothScroll`：Lenis 惯性滚动是全站唯一的滚动劫持，前庭风险最高。命中时直接不创建实例；所有 `window.__lenis` 消费方本来就写了原生滚动回退。
    但**回退本身必须是中性的**：没有 lenis 就等于命中了 reduce，此时 `window.scrollTo({behavior:'smooth'})` 反而比被拒掉的惯性走得更远（长文回顶是整页扫过）。`RadialFab.toTop` 因此显式给 `behavior: prefersReducedMotion() ? 'auto' : 'smooth'`——这不是第六处例外，是这一处例外的落地补正，别照着它往别处加分支。`RouteTransition` 的 `window.scrollTo(0, 0)` 是两参数瞬时形式，本来就中性；全站没有 CSS `scroll-behavior: smooth`，加之前先确认这一点还成立。
  - `OvertureLight`：0.9s 不透明全屏黑幕 + 滚动锁 + 抢焦点。命中时走 `finishInstant()`，并**顺手写掉 session key**——HomeHero 靠这把钥匙判断接力不会来了，不写就会空等 8s 安全超时，首屏一片空白。
  入场、揭幕、路由帘幕、hover、pin/视差**一律不在例外里**：它们是一次性的，不属于「停不下来」那一类。`/intro` 的 3D 也不在（那张脸就是那一页的全部内容）。谓词统一用 `prefersReducedMotion()`（`src/lib/gsap.ts`），别在组件里再散写 media query。
  仍然保留的降级信号（它们是明确意图，不是提速副作用）：`navigator.connection.saveData`（JS 侧，跳过两个 3D 场景，即真正的流量大头）、`hasWebGL()`、`(hover: hover) and (pointer: fine)`（悬停类效果）、`(min-width: 768px)`（pin/视差）。
  CSS 侧的 `prefers-reduced-data` 已删掉：MDN 明说 not supported by any user agent，那条规则从未生效过，留着只会让人以为 aurora 有开关。省流量归 `prefersSaveData()`。
- GSAP 组件不需要 `gsap.matchMedia()` 包壳：`useGSAP` 本身就跑在 `gsap.context` 里，回调签名同为 `(context, contextSafe)`，返回的函数就是 teardown。需要多个各自持有 cleanup 的作用域时，用嵌套的 `gsap.context()`（见 `HomeHero` 的 `isolate()`），**不要**写 `mm.add("all", …)`：GSAP 会把字符串条件包成 `{matches: "all"}`，真的去调 `window.matchMedia("all")` 并把 context 挂上全局 `_media`，此后任何一处真实查询翻转都要把它重算一遍。带真实断点/指针查询的 matchMedia 照常使用。
- `useGSAP` 带了 `dependencies` **且回调返回 teardown** 时，必须同时给 `revertOnUpdate: true`。@gsap/react 的判据是 `deferCleanup = dependencies.length && !revertOnUpdate`：漏了它，cleanup 被推迟到卸载，依赖一变就多出一套 ScrollTrigger / tween / 监听器。反过来，**不返回 teardown 的不要加**——那会在依赖变化时把已经应用的动效 revert 掉（`Header` 的两处开合就是这种情况）。

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

**RouteTransition**：保留机制骨架（捕获阶段点击拦截 / cover-reveal 状态机 / forceClear 兜底 / `data-no-transition` 逃生口），幕布换玻璃 materialize：新页 `--panel-blur 20→0 + scale .98→1 + opacity`。locale 切换走 `document.startViewTransition` 整页 cross-fade。转场可中断、不锁 pointer-events。

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
动效：**404 数字本身即粒子彩蛋**（`components/notfound/ParticleLine`）——canvas 点阵先散后聚、指针靠近吹散、弹簧回位（≤3000 粒 2D，采样步长按屏宽分档）。原 ScrambleText 解码由此取代（ScrambleText 仍服务 Blog 标题）：两者都是「解码成型」的叙事，叠在同一个数字上只会互相打架。
实现约束：数字始终以真实 DOM 输出，触屏 / reduced-motion / JS 未落地 / 文字换行一律退回纯排印；canvas 采样该元素自身的计算字体与盒子，接管时零位移；粒子静止即停循环（§5.3「静止停在最后一帧、零持续开销」），仅指针接近、resize、切主题唤醒。
标定：收敛时长由 `settleTime` 单参数决定——离散弹簧的状态矩阵行列式恒为 friction，欠阻尼区内位移包络每帧衰减 √friction，与 ease 无关；ease 只管过冲幅度。

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

## 7. 参考材料

研究底稿（GSAP demo 拆解、apple-design 规范、趋势实勘、三份提案与评审）
产出于一次性的 session scratchpad，目录已随会话回收，不再可读。它们的结论
凡是重要的都已写进上文正文；GSAP demo 的出处编号（azmKBBJ、vYMzKZx、
gbwvbgQ……）保留在各组件的注释里，可按需去 CodePen 回看原 demo。
