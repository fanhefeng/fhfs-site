# WebMCP

fhfs-site 的公开页面通过浏览器原生 `document.modelContext` 暴露三个工具：

| 工具 | 参数 | 行为 |
| --- | --- | --- |
| `fhfs_search` | `query`；可选 `locale`、`kind`、`limit`（1–20，默认 10） | 复用站内搜索索引、匹配和排序，返回标题、摘要、类型和本地化路径。 |
| `fhfs_list_sections` | 可选 `locale` | 列出当前公开导航中的栏目及路径。 |
| `fhfs_open_page` | `path` | 在当前标签页打开索引中的公开页面；路径必须与前两个工具返回的一致。 |

`locale` 为 `zh` 或 `en`，默认使用当前页面语言。`kind` 与搜索面板一致：`page`、`post`、`secret`、`app`、`lab`、`film`、`idol`、`moment`。`secret` 是现有公开索引中的已发布内容类型，不代表管理后台的私有内容。

工具只在公开页面挂载，管理员页面和草稿预览不注册。语言切换和组件卸载时通过 `AbortSignal` 注销。注册本身不加载索引；实际查询通过匿名 GET 请求读取既有 `/{locale}/search.json`，不携带管理会话，也不增加长期客户端缓存。工具输入在运行时校验；导航拒绝站外 URL、后台、API、查询参数和索引中不存在的地址。

此接入不需要新增依赖、MCP 服务端或模型密钥。它为支持 WebMCP 的 AI 客户端提供工具，不会自动添加站内聊天助手。不支持此 API 的浏览器跳过注册，普通搜索和网页操作照常工作。

## 本地验证

1. 使用项目要求的 Node 24 / pnpm 11，运行 `pnpm dev`。
2. 使用支持 WebMCP 的浏览器。Chrome 本地测试可在 `chrome://flags/#enable-webmcp-testing` 开启实验功能并重启；页面须为 HTTPS 或 localhost 安全上下文。
3. 打开 `/zh`，在 DevTools 的 WebMCP 面板或 Model Context Tool Inspector 中确认三个 `fhfs_` 工具。
4. 调用 `fhfs_list_sections({})`；再调用 `fhfs_search({"query":"React","kind":"post"})`，确认结果来自公开内容。
5. 将返回的 `path` 传给 `fhfs_open_page`，确认当前网页完成导航；使用 `locale: "en"` 可获取英文路径。
6. 输入 `/admin`、站外地址或未知路径，确认工具返回 `INVALID_INPUT` 且未导航。索引暂不可用时返回 `UNAVAILABLE`；取消中的操作返回 `CANCELLED`。
7. 切换语言后仍只有三个工具；进入 `/admin/login` 或草稿预览时没有 fhfs 工具。关闭实验功能后检查普通页面与搜索仍可使用。

浏览器中也可使用原生 API 检查（Chrome 155+ 接收对象参数）：

```js
const tools = await document.modelContext.getTools();
const sections = tools.find((tool) => tool.name === "fhfs_list_sections");
await document.modelContext.executeTool(sections, {});
```

完整检查使用 `pnpm check`、`pnpm build` 和本地公开页面 `pnpm smoke`。测试不向生产数据库写入。

## 参考

- [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [WebMCP 草案](https://webmachinelearning.github.io/webmcp/)
