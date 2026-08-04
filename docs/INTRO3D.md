# /intro · 3D 贴纸头像页

`/[locale]/intro`：一个 GLB 头像，脸上贴满代表技能的贴纸（运行时贴花），滚动时相机依次环绕聚焦每张贴纸并展开对应的简历卡片。是 `/about` 的另一种讲法——同一个人，一边是读的，一边是转着看的。

原型来自独立项目 `intro3d-me`（Next.js + R3F 单页应用），2026-08 并入本站。并入时做的改造见 §5。

## 1. 三个文件决定一切

| 要改什么 | 改哪里 |
|---|---|
| 文案（标题/正文/要点/kicker） | `messages/{zh,en}.json` 的 `intro` 段 |
| 贴纸位置、大小、配色、图标、机位距离 | `src/lib/intro/stickers.ts` |
| 模型本身 | `public/models/head.glb` + `src/lib/intro/stickers.ts` 顶部的常量 |

配置与文案是分开的：`lib/intro/stickers.ts` 只放与语言无关的几何，页面（Server Component）把两者按 `id` 拼起来再传给客户端。这样切语言不会重渲染 Canvas。

新增/删除一张贴纸 = 在 `INTRO_STICKERS` 加一项 + 在两个 messages 文件的 `intro.nodes` 里加同名 `id`。滚动轨道长度（`(贴纸数 + 3) × 100dvh`，为什么是 +3 见 §6）会自己跟上。

`intro.nodes.<id>` 里只有 `kicker` / `title` / `body` / `bullets` 是必填的；`period` 可有可无，页面用 `t.has()` 判在不在，**不要为了「补齐结构」写一个空字符串进去**。

## 2. 贴纸定位：方向角，不是坐标

内容里只写方向角 `dir: { theta, phi }`（从哪个方向看过去）。运行时 `src/lib/intro/surface.ts` 的 `projectToSurface()` 从该方向朝模型中心打射线，命中点 = 贴花位置，命中面法线 = 贴花朝向，再由 `DecalGeometry` 实时投影。**换模型不用重调坐标**，这是整套设计的前提。

贴纸图案由 `src/lib/intro/stickerTexture.ts` 用 Canvas 程序化生成（零图片素材）：改字、改色、改 emoji 都只动 `lib/intro/stickers.ts`。

**不要手算坐标。** 在 `pnpm dev` 下带 `?edit=1` 打开页面（如 `/zh/intro?edit=1`）：

- 拖拽旋转视角，在脸上点击 → 当前选中的贴纸移到该处
- 右侧 leva 面板调 theta/phi/尺寸/自转/机位距离
- 点「导出 JSON」，把数值粘回 `src/lib/intro/stickers.ts`

编辑面板通过 `next/dynamic` 加载，leva 不进普通访客的包。**这套装置只在开发环境认 `?edit=1`**：线上带这个参数进来只会看到正常页面。它是校准仪器不是功能，线上开着等于把一个可以随手改脸的面板挂在公网上，还会让一条带参数的链接被当成页面坏了。

## 3. 换模型

1. 生成新的 `head.glb`，用 `gltf-transform` 压到 < 1 MB、< 10 万三角面（`gltf-transform draco … --quantize-position 16`；量化位数别调低，贴纸角度是照着当前表面手调的），放到 `public/models/head.glb`。
2. **重新校准 `MODEL_ANCHOR_FROM_TOP`**（`src/lib/intro/stickers.ts`）：用 `tools/head-preview.html`（正交四视图 + anchorFromTop 刻度线），读出脸中心位于模型总高的百分之几。**别靠猜**——配错的话所有贴纸会跑到下巴以下。当前这个含肩胸像是 0.44（眼 0.40 / 鼻 0.48 / 下巴 0.63），纯头部模型约 0.5。

   这个工具在 `public/` 外面，因为它从 esm.sh 现取 three.js，留在 `public/` 就等于把一个外部 CDN 入口发布到线上。跑法是在仓库根目录起个静态服务器（`python3 -m http.server 8000`），开 `http://localhost:8000/tools/head-preview.html`。红色那条线画的是 `MODEL_ANCHOR_FROM_TOP` 的当前值，改了配置记得同步改文件顶部的 `ANCHOR`，否则这把尺子下次会把人带偏。
3. **重新测量眼镜常量**（`GLASSES`）：眼镜是程序化生成的几何（模型是摘镜重建的，单图重建镜片会糊成一片阴影）。量法是解析 GLB 顶点、复现 `normalizeModel()` 后取切片，读出眼高、脸最前点 z、太阳穴 x。
4. 逐张贴纸用 `?edit=1` 复核，导出，粘回。

`normalizeModel()`（`src/lib/intro/surface.ts`）把模型烘焙成「脸中心在原点、总高为 2」的标准姿态——直接改 geometry 顶点而不是加 transform，之后世界坐标 == 局部坐标，贴花和相机计算都不用管矩阵换算。

### 已知坑

- 用 `gltf-transform --compress quantize` 时，顶点是 Int16 normalized。`applyMatrix4` 读时解量化、写回却直接塞进整数数组，浮点被截断、模型碎成一坨。烘焙前必须先 `dequantizeForBaking()`（已在 `surface.ts` 里，换压缩方式时别删）。
- 真实照片纹理 + 自阴影会出 shadow acne 条纹，主光上的 `shadow-normalBias={0.06}` 是压它的。
- **`MODEL_ANCHOR_FROM_TOP` 写的是 0.44，实际生效的是 0.470。** `normalizeModel()` 用世界坐标量包围盒、却把矩阵烘进局部 geometry，而这颗头的 mesh 节点自己带着 `quantize` 留下的 0.4990 缩放——没有被折进去。总高精确是 2（这半边没问题），但脸锚点落在 y=+0.0601 而不是 0。

  **所以第 2 步用尺子读出来的数，和渲染器实际摆出来的姿态是两回事。** 现有七个角度和 `GLASSES` 全是照着 0.470 那套姿态手调出来的，把锚点改对会让七个贴花命中点移动 0.014–0.030、眼镜也得重量——两半必须一起做，单独落任何一半都是视觉回归。要动就整轮重调，别只改 `surface.ts`。

  另外它**不是幂等的**：`useGLTF` 按 URL 缓存场景，同一批 geometry 每次重挂载都会再烘一遍，误差每次减半（+0.0601 → +0.0301 → +0.0151…）。眼镜是按固定常量建在原点、不跟着头动的，所以 about → intro → about → intro 走一轮，镜框就往脸上爬了一格。`surface.ts` 里的 `baked` WeakSet 把姿态锁在第一次烘焙上——**锁的是生产环境一直以来渲染的那个姿态**，顺带让 dev（StrictMode 会烘两遍）和线上终于一致，也就是让 `?edit=1` 标出来的角度和线上看到的是同一套。
- `projectToSurface()` 是会打空的：贴纸角度指到模型外面（比如后脑勺方向、或者新模型比旧的窄），射线就命中不了，这张贴纸没有停靠点。**所以相机停靠点自己带 `index` 字段，不靠它在数组里的下标**（`AvatarScene.tsx` 的 `Stop`）——靠下标的话，中间掉一张贴纸会让它之后的每张卡片都配错贴纸、最后一张永远不出现、尾屏提前一屏到达。掉的那张只是没有自己的停靠点，其余全部照常。

## 4. 模型资产链路（不在本仓库）

当前这颗头的来路：本人照片 → FLUX Kontext 图生图风格化 → TRELLIS 单图三维重建 → gltf-transform 压缩。全链路脚本（`photo-to-3d.py` / `rebuild-v3.py`）跑在 HuggingFace ZeroGPU 免费 Space 上，**配额按账号算，免费账号一天约够一轮**，风格化满意后重跑必须加 `--skip-stylize` 省配额。

这些脚本和中间产物（25 MB 的历次生成图）**留在原型仓库 `intro3d-me`，没有并进来**——本站是纯前端仓库，不该背 Python 环境和几十 MB 的素材。要再生成一版模型时回那边跑。

> ⚠️ **这条链路没进任何版本控制，随时会没。** 上一段里的两个脚本名、跑它需要的 ZeroGPU 账号、以及 `--skip-stylize` 之所以写在这儿，就是为了原型仓库万一找不到了还能照着重建一遍——文档留得住，目录留不住。
>
> `intro3d-me` 最后一次见到是在某个 `~/Desktop/temp/<日期>/` 下面。**temp 路径不算归档。** 要留住这条链路，就得把它挪进一个真正的仓库或备份；等到发现它不在了，那 25 MB 的中间产物也就一起没了。

未完的事（并入时从原型带过来的待办）：模型的三个风格变体还没微调完；眼镜是按印象做的，等一张戴眼镜的正脸照片后重调。

## 5. 并入本站时改了什么

原型是一个 `fixed inset-0` 的全屏应用，本站有自己的 Header / Footer / Lenis / 主题系统，所以：

- **舞台从 `fixed` 改成 `sticky`**：一条 `(n+3) × 100dvh` 的轨道（多出来那一屏的来历见 §6），里面一个 `sticky top-0 h-dvh` 的舞台。这样 3D 留在文档流里，Footer 自然接在后面，Header 灵动岛照常浮在上面。
- **Canvas 透明**，不再自己画背景：页面的纸、极光、颗粒直接透过来，亮暗主题的过渡完全交给 CSS。真正跟着主题走的只剩灯光强度，按帧阻尼逼近，切主题不会闪。

  雾也按同样的方式接了 `--bg`，但**目前一个像素都没染到**：three 的雾按视深度算，而 `buildStops` 给出的每一个机位下模型最远角只到 5.45（竖屏顶到 `nodeDistanceScale` 上限时 5.82），`fog.near` 是 6。想让它生效就是把 `near` 降到 4.5 左右——那是个要拿眼睛定的效果，不是顺手改掉的 bug，所以线留在那儿没动。
- **不再自己注册 GSAP 插件**：`@/lib/gsap` 是全站唯一注册点，ScrollTrigger 已经和 Lenis 接好了。
- **原型顶部的四角信息删掉了**：Header 的滚动渐变会把它洗掉，且身份标识与灵动岛重复。相关信息并进了首屏。
- **文字层整体 `aria-hidden`**，语义交给同页那份 `sr-only` 的完整简历（`IntroResume variant="seo"`）——canvas 里的东西爬虫和读屏都读不到，两份都可见则会被读两遍。
- **整个 WebGL 子树挂在 `next/dynamic` 后面**：R3F、drei 和那颗 GLB 只在确定要渲染 3D 之后才开始下载，降级路径拿到的是 `IntroResume variant="visible"`（站点窄栏排版的一份正常简历）。实测降级路径 475 KB / 3D 路径 561 KB，模型和 fiber+drei 那个 chunk 确实一个字节都没取。

  但**three 核心那 ~184 KB 照样会下**，且跟本页无关：App Router 会预取 `/about`，而 `/about` 的 `Workstation` 是静态 import 的 `three`——随便开一个 `/zh/blog` 也会拉到同样两个 chunk。要把这段也省掉得去改 `Workstation` 的加载方式，不在本页范围内。
- **三种情况直接走简历**：没有 WebGL、`prefers-reduced-motion: reduce`、以及浏览器报了 Save-Data。Save-Data 是明说「我在省流量」，一个几百 KB 的模型加上整套 3D 运行时正好是它指的那种东西。

  判定发生在客户端 effect 里（服务端猜不到），`mode` 的初始值是 `probing`，**这一态什么都不画**。所以首屏 HTML 是一条 `1000dvh` 的空轨道加一份 `sr-only` 的简历：给爬虫和读屏是全的，给眼睛是空的。JS 没跑起来（禁用、或包挂了）就一直是这个样子——已知的降级缺口，要补得让 `probing` 直接渲染可见简历再换成 3D，代价是所有人首屏闪一下。
- **模型加载失败不再把页面带走**：GLB 取不到（网断了、CDN 挂了、文件被换坏了）时 error boundary 接住，落回同一份可见简历。信息本来就是同一套，3D 只是它的一种讲法，讲不了就换一种，而不是给一片空白。
- 配色、字号、玻璃层级全部换成站点 token，不再有 stone-\* 硬编码。

## 6. 其他

- 滚动进度不走 React state（每帧都变，进 state 会把整棵树重渲染到卡死）：走 `src/lib/intro/store.ts` 的模块级 `scrollState`，ScrollTrigger 往里写，`useFrame` 从里读。改动画相关代码时维持这条规则。
- **轨道比停靠点多一屏**：轨道高 `(贴纸数 + 3) × 100dvh`，而 ScrollTrigger 的 progress 在倒数第二屏就跑满（`end: "+=轨道高 - 2屏"`）。多出来的那一屏是尾屏自己的停留位——没有它的话，progress 刚到 1、尾屏刚成形，Footer 立刻把舞台顶出视口，然后就到底了，用户永远停在一张被推歪的画面上（并且会以为是「滚不动了」）。
  改这里时**别用 `end: "bottom bottom-=100%"` 这种对齐写法**：它的含义是「更晚才结束」，会把结束点推到文档滚不到的位置，progress 永远到不了 1，最后一张贴纸就成了终点、尾屏根本不出现。用 `+=像素` 的行程写法。
- 相机走球面插值（直线会穿过头部），且不完全对着贴纸法线——仰角压到 45%，否则额头的贴纸会让镜头变成俯视头顶。注视点还会往文案卡的对侧偏，给卡片让位。
- 舞台滚出视口后 `frameloop` 停掉，不空烧 GPU。
- 进度条只盖住舞台那一屏，不铺满视口：Header 灵动岛在它上面，模型还在下载的时候也得点得到。它读的是 drei 的 `useProgress`，只有走 3D 那条路才会出现——降级路径直接就是成品简历，没有「正在加载」这一说。
- **代码分包和模型都是晚到的**，轨道量完之后长度还会变（字体也一样），所以 3D 挂上来之后要 `ScrollTrigger.refresh()`，否则最后一个停靠点对不上文档真正的底部。
- 本页与 `/about` 互相链接：about 页头部有入口 chip，intro 页尾屏有回链。
