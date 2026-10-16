# 本地字体

构建和 OG 图生成均不请求外部字体服务。拉丁字体来自 Google Fonts 仓库的固定提交
`bd8f81ddb5c74d5c8897b36ad88b440266245103`，源文件 SHA-256、生成参数版本和产物
SHA-256 在 `tools/fonts.gen.json`，OFL 许可与产物放在同一目录。

| 用途 | 文件 | 范围 |
|---|---|---|
| 浏览器正文、点缀、元信息 | `src/app/font-files/*.woff2` | 拉丁可变字重，合计约 103 KiB；仅 Nunito 预加载 |
| OG 拉丁 | `src/lib/server/og-fonts/Nunito-{400,700}.woff` | 两个静态字重 |
| OG 中文 | `src/lib/server/og-fonts/RoundedSC-{400,600}.woff` | 资源圆体 CN 的完整中文范围；有中文才读取 |
| 浏览器中文 | `public/fonts/rounded/v1/` | 资源圆体 CN 1.910，200–900 可变字重；149 片，按需加载 |

OG 字体通过服务器文件系统读取并在进程内复用 Promise；读取失败会清除失败的 Promise，
下次可重试。完整 CJK 字集允许后来在后台新增的汉字继续生成，无需重新下载字体或重新部署。
这些文件由 Next 输出追踪纳入 OG 路由，不进入浏览器脚本。
发布后应检查中文 OG 图以及服务端包的实际大小；本机成功构建不代表已经验证线上部署。

## 拉丁字体与旧 OG 字体的更新方式

常规 `pnpm install`、`pnpm build` 不需要 Python，也不会下载字体。
只有主动升级字体时才运行以下步骤：

1. 从 `tools/fonts.gen.json` 中的固定 URL 下载四个 TTF，以 `Nunito.ttf`、
   `JosefinSans.ttf`、`GeistMono.ttf`、`NotoSansSC.ttf` 保存到临时目录。
   同一提交的各 `ofl/<family>/OFL.txt` 分别保存为 `<family>-OFL.txt`。
2. 在临时 Python venv 安装 `fonttools==4.66.1`、`brotli==1.2.0`，运行
   `python tools/vendor-fonts.py <临时源目录>`。脚本先验证全部源文件哈希和 OFL 再写产物，
   保留源时间戳，重复运行的产物应逐字节一致。
3. 升级上游时先审阅许可，再一起更新脚本的固定提交、哈希与生成清单。
4. 运行 `pnpm check`、`pnpm build`，检查两个 OG 路由的 `.nft.json` 都包含当前四个 OG 字体
   （Nunito 400 / 700、RoundedSC 400 / 600），
   并在生产服务上请求中文、英文 OG 图，确认状态和图片内容。

字体位于 `src/`，无需运行 `pnpm assets`。新增浏览器字符范围时在脚本里明确扩展，
不要把完整 CJK 文件加入 `next/font/local` 的浏览器字体配置。

## 全站中文圆体（2026-10-16）

正文、元信息、点缀文字以及后台所有字段统一为自托管的资源圆体
[Resource Han Rounded CN v1.910](https://github.com/CyanoHao/Resource-Han-Rounded/releases/tag/v1.910)。
采用开源字体而不是仅依赖 Apple 本机的 Yuanti SC，使不同设备得到相同字形。
浏览器内部家族名为 `FHFS Rounded SC`，三套 Latin 字体之后共享 `--font-stack-cjk`；
英文仍分别用 Nunito、Geist Mono、Josefin Sans。后台原有的 Nunito 界面元信息和
Geist Mono 技术字段也保留原来的英文分工。

冻结官方 CN 字体 cmap 中 U+2E80 起的全部 29,758 个码点，排除拉丁字符。
按记录的 messages、公开 backup、后台源码字频分组，每片最多 200 字。
分组冻结在配方中，不随内容更新重切；新文章也能按需取到已有完整中文范围。
固定 `ROND=100`，保留 `wght=200–900`；点缀文字的 300 轴也使用真实字重。
分片仍是 WOFF2，首次进入页面只请求出现的字符所在片，不加载整套字库。

源压缩包、解压 OTF、完整 OFL、固定工具版本、字符计划和所有产物哈希在
`tools/rounded.gen.json`。原作者、版权和许可元数据保留，衍生家族名独立。
常规 install/build 不下载字体，不需要 Python。

复现时从配方 URL 下载官方 `.7z`，解压得到 `ResourceHanRoundedCN-VF.otf`，
并将官方 OFL 保存为 `LICENSE.txt`；先对照配方核对源文件与许可 SHA-256。
在临时 venv 安装 `fonttools==4.66.1`、`brotli==1.2.0` 后运行：

```bash
python tools/vendor-rounded.py <源目录> <新的空暂存目录>
```

工具先检查输入，再逐一核对生成字节。审阅后，将暂存的 `fonts/` 放入
`public/fonts/rounded/v1/`，`rounded.css` 放入 `src/app/`，`og/*.woff` 放入
`src/lib/server/og-fonts/`，OG 的 `LICENSE.txt` 保存为 `rounded-OFL.txt`。
OG 使用同一字形的 400 / 600 静态 CFF1 WOFF，因为 Satori 不支持可变 CFF2。
然后运行 `pnpm assets`、`pnpm check`、`pnpm build`，核对页面及中文 OG 图片。
升级源、工具或分组时创建新目录版本，并显式更新配方及预期产物。

首次接入已完成两次全量生成，149 个网页分片和两个 OG 字重均逐字节一致；
逐文件检查了实际 cmap、可变轴及作者/许可元数据。固定语料中的 2,255 个汉字全部覆盖。
Chrome 实际渲染字体检查确认正文、元信息、点缀与后台中文使用同一家族，英文仍使用原字体；
WebKit 加载、移动端布局以及中英文 OG 图片也已验证。

旧 Yozai 文件及 CSS 保留，供仍持有旧 CSS 的缓存浏览器取字；新全局样式不再导入它。
旧 Noto OG 字体由原 `tools/vendor-fonts.py` 配方保留，当前 OG 不读取它们。

## 旧 Yozai 中文分片的可复现构建

源文件固定为 [Yozai v0.868](https://github.com/lxgw/yozai-font/releases/tag/v0.868) 的
`Yozai-Regular.ttf`、`Yozai-Medium.ttf`，以及同一 tag 的 `OFL.txt`。
官方下载的 SHA-256、工具版本、字符分组、输出字节哈希均在 `tools/yozai.gen.json`。
不依赖原先未留参数的 cn-font-split，也不会在 install/build 时下载源字体。

计划冻结了每个字重原有的 8,542 个码点，未扩大或删减 CSS 字符范围。
频率来自记录的公开提交中的 messages、公开 backup 与后台 UI 字串，权重分别为 10/1/20；
按频率降序、同频码点升序，每组最多 100 字。完整分组作为输入提交，内容修改不会自动重切字体。
子集内部家族名为 `FHFS Round CJK`，CSS `Yozai` 别名保持现有字体栈，原作者、版权和许可元数据保留；
新目录附完整 OFL。命名依据：[OFL Webfonts](https://openfontlicense.org/webfonts-and-reserved-font-names/)。

在临时 venv 安装 `fonttools==4.66.1`、`brotli==1.2.0`，将上述三个原始文件放入临时源目录：

```bash
python tools/vendor-yozai.py <源目录> <新的暂存目录>
```

工具不联网，先核对工具版本、源文件/许可哈希与完整字符计划，再生成到新/空目录，
逐个核对 172 个 WOFF2 的预期字节哈希。错误源文件在创建输出前就会被拒绝。
完成后先审阅暂存结果，将其中 `fonts/` 的内容放入 `public/fonts/yozai/frequency-v1/`，
将 `yozai.css` 放入 `src/app/yozai.css`，运行 `pnpm assets` 和 `pnpm check`。
常规复现应逐字节相同；升级来源/工具/字符分组必须开新目录版本并更新配方，不能覆盖旧版本。

旧 `400/`、`500/` 的 174 个分片保留原字节，使仍持有旧 CSS 的浏览器能够继续取到对应文件；
测试校验旧文件集合摘要、新文件哈希、完整字符分组、CSS 映射、两个字重和许可。
原有字形对源字体的检查为零差异；新输出的 17,088 个编码字形（含 bidi 镜像闭包）、字宽、行高及作者/许可元数据检查均通过。
CSS 有效范围仍为每字重 8,542 字，两个镜像编码不额外暴露到 CSS。

两次独立生成以及正式工具重建的文件哈希一致。五页浏览器原型中，字体请求/字节分别从
首页 35/1,071,772 到 20/594,032、介绍 42/1,442,680 到 27/818,240、关于 43/1,508,836 到
30/885,836、文章列表 32/959,660 到 20/590,860、后台登录 11/246,840 到 7/200,740；
登录截图逐像素一致。原型通过响应拦截比较请求量，**不是 LCP 测量**；正式构建、线上与限速结果另行验收。
