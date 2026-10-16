# 内容与模型从哪来

站上不是自己写、自己拍、自己画的东西，出处和许可都在这里；页面上也各有署名。
许可的总原则见仓库根目录的 `LICENSE`：代码 MIT，文字与他人的媒体不授权。

## 文字

- 那几篇 `note-*` 手札 —— 从旧 VitePress 知识库（fanhefeng/fhf）精选改写
  （OSI 七层、macOS 主机名、JS 三则、简历方法论、《数字僧侣》）。
- /moments 的说说：头 242 条来自「一言 YAN」App（com.jhyan.yan）里的两本文集（峰言峰语 /
  默认文集）。App 没有导出功能，全文、发布时间（北京时间）、所属文集与出处是在安卓模拟器里
  登录后读它的本地数据库得到的；`key` 为 `yiyan-<卡片 id>`，`source` 标 `yiyan`。
  其后 336 条是我在另一个 App 上发过的动态（网页版逐页导出，洗掉了内嵌标签与表情码，不标
  `source`、不归文集），其中带的图片、语音和视频放在媒体站（Cloudflare Worker `fhfs-media`）上。

## 模型与照片

- /lab/workstation 的工作台
  ["Gaming Desktop PC" by Yolala1232](https://sketchfab.com/3d-models/gaming-desktop-pc-d1d8282c9916438091f11aeb28787b66)
  （CC-BY-4.0，画布下方署名）；原模型 8.5MB 经 `gltf-transform optimize`（Draco + 1024px WebP）
  压到 1.1MB，Draco 解码器（Apache-2.0）自托管于 `public/draco/`。
- /lab/lens-slider 的四张照片 `public/lab/lens/`（均为 Unsplash License，经 Lorem Picsum 取得，
  1440px 宽重编码）：`river.jpg` Steve Carter、`falls.jpg` Andrew Coelho、`sea.jpg` Anna Popović、
  `coffee.jpg` Karl Fredrickson。
- /intro 的头像 `head.glb` 由单张照片重建（TRELLIS 风格化 v3），眼镜为程序几何补回——重建会把
  镜片糊成阴影（`docs/INTRO3D.md`）。
- /idols/kobe 的十二张照片取自 Wikimedia Commons（2005 – 2024），每张的作者与许可（公有领域 /
  CC BY 2.0 / CC BY-SA 2.0、3.0 / CC0）写在 `idols` 表那一行的 `photos` 里（后台「偶像」），
  印在图下并链接回 Commons 的文件页；1600px 长边重编码放在 `public/idols/kobe/`。
  铜像是程序化几何（胶囊体 + 球体，一种青铜材质），照的是 2024 年 Star Plaza 那尊 81 分雕像的
  姿势（8 号球衣、右手指天），不是它的扫描或复制。

## 招牌

/lab/neon 的招牌照《爱乐之城》（2016）里 Seb's 门口那块霓虹描的：圆环、横杠、音符、S 的轮廓
量自 Wikimedia Commons 上 Espandero 对着电影描摹的矢量 `File:Seb's.svg`（CC BY-SA 4.0，页面上
有署名），F 由原版的 E 去掉底横而来、H 是照它的笔画新造的，不用字体；砖墙是 canvas 画的。

同一块招牌也是首页的大门（`components/home/NeonSplash.tsx`），它的圆环与音符也是站标：favicon
（`app/icon.svg`）、灵动岛和页脚上套着 `fhf` 的圆环（`components/neon/SignRing.tsx`）、OG 卡题头
（`lib/server/ogMark.tsx`）都从同一份几何（`lib/neon/geometry.ts`）画出来。

## 手写动画

/lab/hello 的英文 hello 与中文「你好」采用 macOS 系统 Hello 欢迎动画的原始中心线路径，
字体数据标识为 **Macintosh Skeletal 2.0**，© Apple, Inc. 2025. All rights reserved。
字形属于 Apple，不属于本项目的 MIT 授权；这里只用于个人网站的动画实验。

来源是本机 `/System/Library/PrivateFrameworks/SetupAssistantSupportUI.framework/Versions/A/Resources/Hello/`
中的 `en.json` 和 `zh_CN.json`，不是 `HelloText/` 中较早的 Macintosh 3D 1.1.0 版本。
原文件的 SHA-256：

- `en.json`：`cffcce1326962c6d35515cd052ecc496a210e47a3ee55acc19feebf34d4cdb0a`
- `zh_CN.json`：`889f7290b7d1e5c33b98011f54fbb00b14d84a405c820218821e0159a00aa026`

转换结果在 `src/lib/hello.ts`。每个原始 stroke 保留为一条 SVG 路径（英文 2 条、中文 13 条），
首段的 `p0` 对应 `M`，各段的 `p1`、`p2`、`p3` 对应三次贝塞尔 `C`，不再手工重画。
以所有控制点的 x/y 边界中点为 `(cx, cy)`，统一映射为
`x′ = 340 + 0.24 × (x − cx)`、`y′ = 160 − 0.24 × (y − cy)`，保留四位小数。
二维等宽描边取各控制点第四维半径的算术平均值乘以 `2 × 0.24`；未还原原动画的三维光照与材质。
GSAP 时间轴和播放控制由本项目实现，不加载或分发完整字体文件。

## 剧照

三部电影的剧照都仅作个人致敬之用，版权归各自的片方，页面上有署名；清单与尺寸在 `films` 表
各行的 `stills` 里（后台「电影」）。

- **/films/odyssey** —— 十二张取自 TMDB 收录的两部《大话西游》（1995）的剧照（`月光宝盒`
  id 13345、`大圣娶亲` id 21835），© 1995 彩星电影公司 / 西安电影制片厂；1800px 宽重编码放在
  `public/films/odyssey/`（三张原图只有 1280px，保持原尺寸）。
- **/films/secret** —— TMDB 上《不能说的秘密》（id 20342）只有六张 backdrop，其中四张是同一个
  单车镜头的不同裁法，撑不起一面墙，所以主体取自豆瓣电影条目（id 2124724）「官方剧照」分类：
  八张官方剧照 + 两张 TMDB backdrop（单车、父亲的吉他）+ 两帧电影截图（课桌上的字、琴谱上的
  话，裁掉了上下黑边；有内嵌字幕的帧一律不用）。© 2007 安乐影片 / 杰威尔音乐；保持原尺寸
  （1500–1800px）。
- **/films/lala** —— 六张取自 TMDB 收录的片方宣传图（16:9，1800px 宽，栈桥那张原图只有
  1403px），其中灯柱下的吻和琴键之路是海报画、不是片中镜头，图注照实标「海报」；另六张取自豆瓣
  电影条目「官方剧照」分类（3:2 的片场照片，保持原尺寸 1620px 宽）。© 2016 Summit Entertainment
  / Lionsgate。/lab/neon 招牌下那面墙读的也是这份。

## 音乐

背景音乐的唱片登记在 `src/lib/tracks.ts`，**全部自托管**在 `public/music/`，不嵌任何第三方
播放器，大陆网络照样能听。都由本地源（无损 / 320kbps，科比那张见下）经 `pnpm media:music <源文件> <名字>`
（`scripts/encode-music.mts`：去元数据、LAME `-q:a 5`、44.1kHz，并报告首尾静音）重编码到约
110–125kbps VBR：

| 唱片 | 放在哪 | 长度 | 大小 |
|---|---|---|---|
| Mia & Sebastian's Theme（Justin Hurwitz，《爱乐之城》原声，2016） | 大门、/lab/neon、/films/lala | 3:19 | 2.8MB |
| Lovely Day（Jurrivh） | /moments | 4:01 | 3.7MB |
| 《一生所爱》（卢冠廷 1995 原版） | /films/odyssey | 4:28 | 4.0MB |
| 《路小雨》（周杰伦，《不能说的秘密》原声带里的钢琴曲） | /secrets、/films/secret | 1:37 | 1.3MB |
| That's the Dream · Mamba Out（科比·布莱恩特的两段讲话） | /idols/kobe | 1:10 | 1.0MB |

《路小雨》的源 flac 尾部 3.2 秒静音已裁掉并加 0.8 秒淡出，否则循环时会空一拍。房间里印的
曲名一律是实际在放的那份录音——所以《不能说的秘密》那间房写的是《路小雨》，不是同名主题曲。

科比那张不是音乐，是两场讲话剪在一起，现场声都留着：前 61 秒取自湖人官方 YouTube 频道的
「Kobe Bryant's Jersey Retirement Ceremony」（`NjqYkhg9bdQ`，2017-12-18 球衣退役仪式，12:56–13:58，
从 "And lastly, our daughters, Natalia, Gianna and Bianca" 到 "I love you"）；掌声里 1.5 秒交叉淡化接上
ESPN 频道「'Mamba out' - Remembering Kobe Bryant's farewell speech after his last NBA game」
（`Eg0mxPXIpLY`，2016-04-13 告别战，2:34–2:43，"What can I say? Mamba out." 和随后的欢呼，取英文原声轨，
不是那条视频自带的 AI 配音轨）。后一段人声比前一段轻 5 dB，先补齐，再整体提到 -16 LUFS、限幅到
-1.4 dBFS，和其他几张放在一起不至于忽大忽小。源是 YouTube 的 opus 音轨（约 135kbps），不是无损。
© NBA / Los Angeles Lakers / ESPN。

播放器因此只有一条路：一个 `<audio loop preload="none">`，页面引用的是带内容 hash 的地址
（`asset()`），重编码后跑 `pnpm assets` 即可，不必改文件名。**Spotify iFrame API + 网易云外链
退路那一整套已于 2026-09-16 退役**——要放回没有文件的歌，得把两条路一起请回来。

## 字体

全站中文与 OG 图片自 2026-10-16 使用
[Resource Han Rounded CN 1.910](https://github.com/CyanoHao/Resource-Han-Rounded/releases/tag/v1.910)
（资源圆体，Cyano Hao，基于 Adobe / Google 的思源黑体，SIL OFL 1.1）。
衍生分片家族名为 `FHFS Rounded SC`，固定完整圆角与 200–900 可变字重，
完整 OFL 在 `public/fonts/rounded/v1/LICENSE.txt` 及
`src/lib/server/og-fonts/rounded-OFL.txt`。来源、工具链与产物哈希见 `tools/rounded.gen.json`，
重建方法见 [`FONTS.md`](FONTS.md)。英文的三套字体保持原样。

旧中文 [Yozai 0.868](https://github.com/lxgw/yozai-font/releases/tag/v0.868) 的字形，
可复现 Web 子集的内部名为 FHFS Round CJK（CSS 别名 Yozai），遵循 SIL OFL 1.1，原作者信息保留。
许可全文在 `public/fonts/yozai/frequency-v1/LICENSE.txt`；两个字重各 86 片按 `unicode-range`
加载，自托管（`src/app/yozai.css`）。旧分片与原许可保留供缓存兼容。拉丁字是 Nunito、Josefin Sans（2026-10-03 起替换
Lora）与 Geist Mono（均为 OFL，通过 `next/font/local` 读取已提交的 WOFF2，`src/app/fonts.ts`）。
OG 拉丁沿用 Nunito 400 / 700；原 Noto Sans SC 400 / 600 文件保留为旧配方产物，当前不再读取。
这些拉丁与旧 OG 字体来自 Google Fonts 仓库固定提交 `bd8f81ddb5c74d5c8897b36ad88b440266245103`，
各自的 OFL 全文保留在 `src/app/font-files/` 与 `src/lib/server/og-fonts/`；
源 URL、源哈希和产物哈希在 `tools/fonts.gen.json`，生成方法见 [`FONTS.md`](FONTS.md)。

## 软件版本号

`/software` 每个应用的版本号读自它仓库的 GitHub 最新 release（`apps.repo` +
`src/lib/server/github.ts`，`fetch` 缓存一小时；未登录配额 60 次/小时足够，设 `GITHUB_TOKEN`
可放宽）。
