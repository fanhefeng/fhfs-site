# fhf — The Quiet Issue · 安静的个人杂志

fhf 的个人网站：一本安静的个人杂志兼私人画廊——收录文章、自研软件与动效实验。
暖纸色、编辑部式排版、一盏琥珀色的灯；深色主题是「闭馆后」的同一间画廊。
完整设计语言（材质、动效语法、每页的叙事）见 `docs/DESIGN.md`。

## 版面

- **首页** —— 三幕：硬着陆时先是那块霓虹大门（每 session 一次，推门从圆环里穿过去），
  然后是一整屏纸上的宣言与站点唯一的主按钮；往下滚，滚动条开出一扇望进苔藓树根的窗
  （实验室「长出来的，不是建模的」的成品，按需拆包加载），正刊的纸再盖回来；最后是
  近期文章、软件架子与一段关于。没走大门的话，开场点灯仪式每会话一次。
- **/blog** —— 目录页式索引：按年分组的纯文字行，日期右对齐；文章页单栏
  68ch，中文标题逐行揭示、拉丁标题解码进场。
- **/software** —— keynote 式 bento 展柜，分类筛选用 Flip 重排；版本号读自各仓库
  的 GitHub 最新 release；页尾是 Mac / iPhone 设备框，逐个翻看。做过的东西都在这一页
  （原 /portfolio 已下线，308 到这里）。
- **/about** —— 「关于」：作者这一翼的门。点阵名字画布、横穿屏幕的标语（全站唯一 pin）、
  自述，接着是「同一个人，另外两种讲法」——3D 自我介绍与简历一行一页（成员与顺序读导航表
  `nav_items.nav_group = me`，印站数 / 经历条数与更新月份），然后是贴纸墙、版本履历。
- **/lab** —— 十则动效研究：滚动帧序列、溶解、融化文字、苔藓树根、苔藓里的两张纸卡、
  色散按钮、可拖拽的 3D 工作台、镜头畸变滑块、Seb's 式的霓虹招牌、翻得动的影集。
  每则按路由单独拆包。
- **/intro** —— R3F 的 3D 头像：滚动带镜头绕头飞行，每张贴纸停一站，
  即一份滚动叙事的简历（`docs/INTRO3D.md`）。
- **/resume** —— 正式的一页简历：左栏编号标签、右栏概述 / 技能 / 经历 / 开源 / 教育，
  「打印 / 存为 PDF」走浏览器打印样式；内容全在库里，公开版本已脱敏。它和 /intro 都是
  「关于」下面的页（不在灵动岛上），页首有一条回「关于」的路，打印时不印。
- **/moments** —— 「峰言疯语」（栏目名取自「疯言疯语」，头一个疯换成名字里的峰；英文名
  Peak Talk）：QQ 空间式的说说板，几行字加一个时间，按年排、按文集筛。条目本身照旧叫说说。
  头 242 条是从一言 App 搬来的两本文集（峰言疯语 / 默认文集），进这一页放 Lovely Day
  （Jurrivh）。
- **/secrets** —— 《不能说的秘密》：不属于手札的随笔与播客，目录页 + 单篇页，播客带浏览器
  原生播放器；进这一页放原声带里的《路小雨》（周杰伦），播客单篇不放。
- **/idols** —— 偶像墙，第一位科比：一尊用代码搭的 81 分铜像（R3F，可拖着转）、十二张
  Commons 授权照片、生涯节点。
- **/films** —— 电影：看了很多遍的几部，一部一页。事实条、一段简介、记得的台词、一面六列的
  剧照墙（点开进「放映厅」：原生 `<dialog>` 灯箱，方向键 / 滑动翻页）。《大话西游》
  （上下两部、片尾曲《一生所爱》）与《不能说的秘密》（原声带里的《路小雨》）；进每一页换那部片的唱片。
  旧地址 `/odyssey` 308 到 `/films/odyssey`。
- **/life** —— 「生活」：房间的目录。峰言疯语 / 偶像 / 电影 / 秘密（以及以后每一间）一行一间，
  印条数和那间房的唱片；成员与顺序读导航表（`nav_items.nav_group = rooms`），配图与唱片在
  `components/life/rooms.ts`。它是灵动岛上房间们唯一的门，自己不放唱片。
- **/admin** —— 浏览器里的编辑部：文章、说说、秘密、文案、列表全部可编辑，保存即生效。

## 技术栈

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4 · next-intl（zh/en 双语，`messages/*.json`）
- GSAP 3.15（核心 ScrollTrigger / SplitText / Flip / CustomEase 在 `src/lib/gsap.ts`
  注册；Draggable / Inertia / ScrambleText / CustomWiggle / ExpoScale 在
  `src/lib/gsap-extras.ts`，只由用到的组件引入）
- Lenis 1.3 惯性滚动，与 GSAP 时钟统一（`gsap.ticker` 驱动 `lenis.raf`）
- three.js：/intro 用 @react-three/fiber + drei，/about 工作台为命令式 three。
  `@react-three/fiber` 带一个 pnpm patch（`patches/`）：three r183 起 `THREE.Clock`
  的构造函数会打弃用警告，而 fiber 9.x 每挂载一个 Canvas 就 `new THREE.Clock()` 一次
  （pmndrs/react-three-fiber#3741，v10 才会换 `THREE.Timer`）。补丁用一份语义完全相同、
  只去掉 `warn()` 的时钟类替换它——`Timer` 不能直接换，它要每帧 `update()`，fiber 9 的
  循环不会调。fiber 升到修好的版本后删掉 `patches/` 与 `pnpm-workspace.yaml` 里的
  `patchedDependencies` 即可。
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
pnpm db:import   # 从 backup/ 恢复（按键 upsert、每表一个 batch，导入后在 /admin 保存一次刷缓存）
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
- /lab/lens-slider 的四张照片 `public/lab/lens/`（均为 Unsplash License，
  经 Lorem Picsum 取得，1440px 宽重编码）：`river.jpg` Steve Carter、
  `falls.jpg` Andrew Coelho、`sea.jpg` Anna Popović、`coffee.jpg` Karl Fredrickson。
- /lab/neon 的招牌照《爱乐之城》（2016）里 Seb's 门口那块霓虹描的：圆环、横杠、音符、S 的
  轮廓量自 Wikimedia Commons 上 Espandero 对着电影描摹的矢量 `File:Seb's.svg`（CC BY-SA 4.0，
  页面上有署名），F 由原版的 E 去掉底横而来、H 是照它的笔画新造的，不用字体；砖墙是 canvas 画的。
  同一块招牌也是首页的大门（`components/home/NeonSplash.tsx`，硬着陆时每 session 一次，
  推门是从圆环里穿过去），它的圆环与音符也是站标：favicon（`app/icon.svg`）、灵动岛和
  页脚上套着 `fhf` 的圆环（`components/neon/SignRing.tsx`）、OG 卡题头（`lib/ogMark.tsx`）
  都从同一份几何（`components/neon/geometry.ts`）画出来。音乐是全站背景音乐：播放器藏在 layout 里（`components/fx/Jukebox.tsx`，
  `lib/jukebox.ts` 是它的 store），开关是招牌本身和灵动岛上的音符。门口这首 Mia & Sebastian's
  Theme（Justin Hurwitz，《爱乐之城》原声，2016）**自托管**在
  `public/music/mia-and-sebastians-theme.mp3`——一个 `<audio loop preload="none">` 直接放，
  3 分 19 秒整首，不嵌任何第三方播放器，大陆网络照样能听。文件由本地 320kbps 源（8.0MB）经
  `pnpm media:music <源文件> <名字>`（`scripts/encode-music.mts`：去元数据、LAME `-q:a 5`、44.1kHz，
  并报告首尾静音）重编码到 2.8MB（约 112kbps VBR）；
  页面引用的是带内容 hash 的地址（`asset()`，见 `src/lib/immutable.ts`），只有它缓存一年；重编码后跑
  `pnpm assets` 即可，不必改文件名。
  六张剧照 `public/lab/neon/`（1800px JPEG）取自 TMDB 收录的片方宣传剧照，
  © 2016 Summit Entertainment / Lionsgate，仅作个人致敬之用，页面上有署名。
- 软件版本号：`apps.repo`（owner/name）+ `src/lib/github.ts` 读 GitHub 最新 release，
  `fetch` 缓存一小时；未登录配额 60 次/小时足够，设 `GITHUB_TOKEN` 可放宽。
- /moments 的头 242 条说说来自用户在「一言 YAN」App（com.jhyan.yan，深圳宜言网络）里
  的两本文集。App 没有导出功能：在安卓模拟器里登录后读它的本地数据库
  `MY_TEXT_CARD_DBITEM` 表得到全文、发布时间（北京时间）、所属文集、是否原创与出处，
  写进 `backup/db.json` 的 `moments` 后 `db:import`。`key` 为 `yiyan-<卡片 id>`，
  `source` 标 `yiyan`。
- 背景音乐的四张唱片登记在 `src/lib/tracks.ts`，**全部自托管**在 `public/music/`，都由本地
  无损 / 320kbps 源经 `ffmpeg -map_metadata -1 -c:a libmp3lame -q:a 5 -ar 44100` 重编码
  （约 110–125kbps VBR）：门口的 Mia & Sebastian's Theme（3:19，2.8MB）、/moments 的
  Lovely Day（Jurrivh，4:01，3.7MB）、/films/odyssey 的《一生所爱》（卢冠廷 1995 原版，
  4:28，4.0MB）、/secrets 与 /films/secret 的《路小雨》（周杰伦，《不能说的秘密》原声带里的
  钢琴曲，1:37，1.3MB；源 flac 尾部 3.2 秒静音已裁掉并加 0.8 秒淡出，否则循环时会空一拍）。
  播放器因此只有一条路：一个 `<audio loop preload="none">`。**Spotify iFrame API + 网易云
  外链退路那一整套已于 2026-09-16 退役**（连同《你不知道的事》这张唱片、`fallback` 状态和
  `RoomMusic` 的替身署名）——要放回没有文件的歌，得把两条路一起请回来。房间里印的曲名一律是
  实际在放的那份录音——所以《不能说的秘密》那间房写的是《路小雨》，不是同名主题曲。
- /idols/kobe 的十二张照片取自 Wikimedia Commons（2005 – 2024），每张的作者与许可
  （公有领域 / CC BY 2.0 / CC BY-SA 2.0、3.0 / CC0）列在 `src/components/idols/kobePhotos.ts`
  并印在图下，链接回 Commons 的文件页；1600px 长边重编码放在 `public/idols/kobe/`。
  铜像是程序化几何（胶囊体 + 球体，一种青铜材质），照的是 2024 年 Star Plaza 那尊
  81 分雕像的姿势（8 号球衣、右手指天），不是它的扫描或复制。
- /films/odyssey 的十二张剧照取自 TMDB 收录的两部《大话西游》（1995）的剧照（`月光宝盒` id 13345、
  `大圣娶亲` id 21835），© 1995 彩星电影公司 / 西安电影制片厂，仅作个人致敬之用，页面上有
  署名；1800px 宽重编码放在 `public/films/odyssey/`（三张原图只有 1280px，保持原尺寸），清单与
  尺寸在 `src/components/films/odysseyStills.ts`。音乐是《一生所爱》1995 年的原版录音，
  自托管在 `public/music/a-lifetime-of-love.mp3`。
- /films/secret 的十二张剧照：TMDB 上《不能说的秘密》（id 20342）只有六张 backdrop，其中四张是同一
  个单车镜头的不同裁法，撑不起一面墙，所以主体取自豆瓣电影条目（id 2124724）「官方剧照」分类
  （42 张，3:2 的片场照片）：十张官方剧照 + 两张 TMDB backdrop（单车、父亲的吉他）+ 两帧电影
  截图（课桌上的字、琴谱上的话，裁掉了上下黑边；有内嵌字幕的帧一律不用）。© 2007 安乐影片 /
  杰威尔音乐，仅作个人致敬之用，页面上有署名。豆瓣的列表页对脚本会跳 `sec.douban.com` 验证，
  要用真浏览器（chrome-devtools MCP 的隔离上下文）打开一次拿到图 id，图片本身
  `img9.doubanio.com/view/photo/raw/public/p<id>.jpg` 带 Referer 就能下；保持原尺寸
  （1500–1800px），清单在 `src/components/films/secretStills.ts`。音乐是原声带里的《路小雨》，
  自托管在 `public/music/lu-xiaoyu.mp3`，与 /secrets 共用 `tracks.secret`。
- /intro 的头像 `head.glb` 由单张照片重建（TRELLIS 风格化 v3），眼镜为程序
  几何补回——重建会把镜片糊成阴影（`docs/INTRO3D.md`）。

部署：Vercel（push 即发布）。
