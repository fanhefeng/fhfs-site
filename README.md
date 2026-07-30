# FHF'S — 深夜小馆

La La Land 霓虹爵士俱乐部风格的个人网站：博客、手札、作品与软件展示。
母题是「一场深夜演出」——滚动条即唱片播放头（左下角 `SIDE A · 000%` 读数），
每个区块是一支曲目。

## 这场演出的节目单（首页）

| 幕 | 区块 | 技术 |
|---|---|---|
| 序 | 电影式开场：圆环填充 → 逐字浮现 → 斜向刀切揭幕（每会话一次） | GSAP timeline + CustomEase + clip-path 逐帧 polygon |
| TRACK 01 | 霓虹灯牌逐管点亮（接力：刀切完成后才通电），背后星空缓转 | SplitText + three.js Points |
| TRACK 01½ | 推门进店：隔窗看见店内，镜头推进穿过窗户 | pin + scrub，`box-shadow: 0 0 0 60vmax` 挖窗，三层速率差 |
| TRACK 02 | 深夜手札：笔记以 3D 切牌呈现，滚动驱动、松手吸附 | ScrollTrigger pin+scrub+snap，三态距离插值（单实例驱动全场） |
| TRACK 03 | 诗歌幕间《程序员》：切片蒙版逐行揭示 | 遮罩优于淡入（S1） |
| TRACK 04 | 作品滑块：无缝无限、跟手拖拽、惯性衰减、空闲自转 | 取模环 + pointer 惯性（0.94 衰减） |
| FINALE | 全站页脚：站名实时转 ASCII 字符画，光标扫过成簇高亮 | Canvas 亮度采样（getImageData 仅 resize 时一次） |

全局：Lenis 惯性滚动与 GSAP 时钟统一（`ScrollTrigger.update` 挂 lenis scroll、
`gsap.ticker` 驱动 `lenis.raf`）。站内换页时同一把金色刀刃斜切幕布
（`RouteTransition`，捕获阶段接管站内链接点击）。所有动效都有
`prefers-reduced-motion` 降级，信息不丢；SSR 输出完整内容，无 JS 也可读。

两个踩过的坑，改动相关代码前先读：

- **窗洞不能加 `will-change`**。`ClubWindow` 靠 `box-shadow: 0 0 0 60vmax` 把窗外
  涂成舱壁色，一旦该元素被提升为合成层，图层按 border-box 裁剪，60vmax 的扩散
  会整个消失，画面变成"没有墙、直接看到店内"。
- **`html` 必须留 `scrollbar-gutter: stable`**。开场遮罩会锁 `overflow`，那一刻
  没有滚动条；ScrollTrigger 若在此时测量被 pin 的段落，会把 pin-spacer 宽度
  写死成含滚动条的宽度，遮罩撤走后整页就能横向滚动 15px。

## 技术栈

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4 · next-intl（zh/en 双语，`messages/*.json`）
- GSAP 3.15（ScrollTrigger / SplitText / CustomEase，统一从 `src/lib/gsap.ts` 导入）
- Lenis 1.3 · three.js（星空为唯一 3D 场景，命令式、无 R3F）
- content-collections + MDX（`content/` 下博客、手札、软件、时间线均为内容文件）

## 开发

```bash
pnpm dev     # 开发
pnpm build   # 生产构建（含 content-collections 编译）
pnpm start   # 预览生产构建
```

## 内容从哪来

- `content/blog/note-*.zh.mdx` —— 从旧 VitePress 知识库（fanhefeng/fhf）精选改写的手札
  （OSI 七层、macOS 主机名、JS 三则、简历方法论、《数字僧侣》）。
- 动效方法论移植自本地 MOTION LAB 研究项目（三态插值、刀切转场、ASCII 采样、无限环）。
- 星空与两个 3D 模型移植自旧作品集 fhf-portfolio。行星
  ["Stylized planet" by cmzw](https://sketchfab.com/3d-models/stylized-planet-789725db86f547fc9163b00f302c3e70)
  （CC-BY-4.0，页脚署名）是首页的 ENCORE 大模型展示区（可拖拽转动，
  懒加载、非 Save-Data 时才下载）。
  工作台
  ["Gaming Desktop PC" by Yolala1232](https://sketchfab.com/3d-models/gaming-desktop-pc-d1d8282c9916438091f11aeb28787b66)
  （CC-BY-4.0，画布下方署名）在关于页，可拖拽旋转；原模型 8.5MB 经
  `gltf-transform optimize`（Draco + 1024px WebP）压到 1.1MB，Draco 解码器
  自托管于 `public/draco/`。

部署：Vercel（push 即发布）。
