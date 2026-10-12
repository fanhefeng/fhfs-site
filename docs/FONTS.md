# 本地字体

构建和 OG 图生成均不请求 Google Fonts。字体来自 Google Fonts 仓库的固定提交
`bd8f81ddb5c74d5c8897b36ad88b440266245103`，源文件 SHA-256、生成参数版本和产物
SHA-256 在 `tools/fonts.gen.json`，OFL 许可与产物放在同一目录。

| 用途 | 文件 | 范围 |
|---|---|---|
| 浏览器正文、点缀、元信息 | `src/app/font-files/*.woff2` | 拉丁可变字重，合计约 103 KiB；仅 Nunito 预加载 |
| OG 拉丁 | `src/lib/server/og-fonts/Nunito-{400,700}.woff` | 两个静态字重 |
| OG 中文 | `src/lib/server/og-fonts/NotoSansSC-{400,600}.woff` | 完整字集，合计约 12.1 MiB；有中文才读取 |
| 浏览器中文 | `public/fonts/yozai/` | 现有分片保持不变 |

OG 字体通过服务器文件系统读取并在进程内复用 Promise；读取失败会清除失败的 Promise，
下次可重试。完整 CJK 字集允许后来在后台新增的汉字继续生成，无需重新下载字体或重新部署。
这些文件由 Next 输出追踪纳入 OG 路由，不进入浏览器脚本。部署体积增加约 12.2 MiB，
发布后应检查中文 OG 图以及服务端包的实际大小；本机成功构建不代表已经验证线上部署。

## 更新方式

常规 `pnpm install`、`pnpm build` 不需要 Python，也不会下载字体。
只有主动升级字体时才运行以下步骤：

1. 从 `tools/fonts.gen.json` 中的固定 URL 下载四个 TTF，以 `Nunito.ttf`、
   `JosefinSans.ttf`、`GeistMono.ttf`、`NotoSansSC.ttf` 保存到临时目录。
   同一提交的各 `ofl/<family>/OFL.txt` 分别保存为 `<family>-OFL.txt`。
2. 在临时 Python venv 安装 `fonttools==4.66.1`、`brotli==1.2.0`，运行
   `python tools/vendor-fonts.py <临时源目录>`。脚本先验证全部源文件哈希和 OFL 再写产物，
   保留源时间戳，重复运行的产物应逐字节一致。
3. 升级上游时先审阅许可，再一起更新脚本的固定提交、哈希与生成清单。
4. 运行 `pnpm check`、`pnpm build`，检查两个 OG 路由的 `.nft.json` 都包含四个 OG 字体，
   并在生产服务上请求中文、英文 OG 图，确认状态和图片内容。

字体位于 `src/`，无需运行 `pnpm assets`。新增浏览器字符范围时在脚本里明确扩展，
不要把完整 CJK 文件加入 `next/font/local` 的浏览器字体配置。
