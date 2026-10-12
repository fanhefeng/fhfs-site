# 验证与关键流程

`pnpm check` 是类型、lint、格式、单元测试和覆盖率下限的门禁。覆盖率只统计
`vite.config.ts` 明确选中的有测试的辅助模块，不代表 React 组件、数据库、页面或整个项目覆盖率。

## 不写数据库的验证

先停止 dev / start，运行 `pnpm build`，成功后 `pnpm start`。
构建期间不要同时跑 dev、start 或另一个构建，它们共用 `.next`。

```bash
pnpm e2e:public       # 本机 Chrome：桌面与移动视口，中英文首页、搜索、降级和 404
pnpm smoke           # 每个模板的资源、异常、控制台/CSP、脚本预算，默认端口 3000
```

公开 E2E 可通过 `E2E_BASE_URL=http://localhost:<端口>` 指向本机服务。
它还验证未登录页面重定向与 Server Action 请求的入口行为，不调用有效写入 action。
移动项目是 Chromium 的触摸/视口模拟，不等同于 iOS Safari 真机。

如需 WebKit：`pnpm exec playwright install webkit` 后，
`pnpm exec playwright test public.spec.ts --project=webkit`。Safari 的媒体行为仍需真机验证。
生产 CSP 包含 `upgrade-insecure-requests`，本机 HTTP 下 WebKit 会将资源请求升级成 HTTPS，
导致资源加载失败；跨浏览器验证需先提供可访问的本机 HTTPS 服务，再设置
`E2E_BASE_URL`。不要为通过测试移除生产 CSP。

2026-10-13 已通过本机 HTTPS 反向代理完成 WebKit 的 5 项公开流程验证。
本次使用临时自签名证书，仅在临时 Playwright 配置中允许该测试证书；生产 CSP 未修改。
此结果验证 WebKit 引擎的公开流程，不代表 Safari / iOS 真机媒体播放已验证。

本机代理若把媒体站域名解析到 `198.18.0.0/15` 等非公网地址，Next 图片优化器会拒绝请求，
`smoke` 将报告媒体图片 400。应在代理的 fake-IP 过滤配置中排除媒体站域名，确认 DNS
返回公网地址后再测；不要开启 `images.dangerouslyAllowLocalIP` 绕过保护。

## 后台写入测试：先隔离，再运行

**创建独立 Neon 测试 project**，不要从生产复制包含草稿的库，不使用生产 branch 或连接地址。
`pnpm e2e` 会迁移、导入公开 `backup/` 固定数据、写入测试行并生成生产构建；
`db:import` 会替换部分表，所以测试项目不保存有价值的数据。

在该测试项目的 SQL Editor 手工创建标记：

```sql
CREATE TABLE public.fhfs_e2e_guard (marker text PRIMARY KEY);
INSERT INTO public.fhfs_e2e_guard VALUES ('fhfs-e2e-only');
```

将 owner 的直连 URL 填入本机 `.env.local` 的 `TEST_DATABASE_URL`。
脚本有两层保护：拒绝与本机生产 pooled/direct URL 相同的主机端点；在迁移和任何写入前，
只读检查上述标记。脚本不会自动创建标记。CI 没有生产 URL，可依赖专用 Secret 与标记，
因此不要在生产项目创建此表。

```bash
pnpm e2e:prepare  # 可选：只迁移、导入并准备固定数据，仍需专用标记
pnpm e2e          # 准备 → 独立生产构建 → 3100 端口启动 → 浏览器流程 → 清理本次新建行
```

测试密码与签名密钥由运行器随机生成，仅覆盖子进程环境；不会读取生产后台密码。
临时会话在被忽略的 `.e2e/session.json` 中，权限 0600，正常结束即删除。
`.e2e/lock` 防止本机并行写入；若进程被强制杀死，先确认运行已停止，才删除遗留 lock。
测试占用 3100 端口，已有服务会拒绝开始。
运行器仅对子进程设置 `E2E_BUILD=true`，使用 `.e2e/next` 和 `tsconfig.e2e.json`。
构建前后只清理该测试目录的缓存，避免跨次测试混用固定数据；正常 `.next` 不被替换或清理。
Next 仍会改写根目录的 `next-env.d.ts`，运行器保存并在结束时恢复它。因此仍不要同时运行
本项目的 dev、typegen/typecheck 或另一个构建。`E2E_BUILD` 不应配置到生产环境。
SIGINT / SIGTERM 会终止并等待本次子进程退出，清理会话、测试缓存和锁；强杀或断电
无法运行清理，遗留状态须在确认进程停止后处理。

后台用真实浏览器验证：

- 随机密码登录。
- 新建并保存文章；匿名浏览器读取正文、搜索 JSON、RSS、sitemap，验证即时失效。
- 非法日期保存失败后保留标题和正文。
- 会话过期保存失败后保留输入。
- 请求失败后保留输入，并能重试保存。
- 草稿匿名 404、授权预览可读、会话过期/退出预览后恢复 404。
- 重复 slug 拒绝覆盖，错误后保留输入，原文仍可读取。
- 文案覆盖后立即出现在公开页；另一语言不变；清空恢复文件默认值。
- ICU 新增参数被拒绝，未保存文本仍在，重新加载保持原值。
- 不受静态资源清单管理的本地媒体地址被拒绝，正文保留。
- 电影台词行重排后文本不丢失；保存、重载和草稿预览保持顺序；删除先确认并可取消。

除登录外，测试用本次随机密钥签名 cookie 减少重复登录，权限由站点实际验证。
失败 trace、截图和报告可能含草稿或授权信息，只保留本机/受信 CI runner，均已忽略，
不要上传到公开 artifact。测试创建的文章、电影和说说使用专用 `e2e-created-*` 标识，
正常结束时删除；下次运行也先清理遗留的新建行。固定测试文章保留供检查，并在下次运行重置。

GitHub 配置 `TEST_DATABASE_URL` Secret，首次本机完整运行成功后再设置
`E2E_ENABLED=true` 仓库变量。workflow 在可信 main push、每天北京时间 05:23 或手工触发，串行写测试库，
不接受外部 PR 输入，不上传授权报告。

2026-10-12 已在独立 Neon 项目 `fhfs-site-e2e` 配置直连 URL 与手工标记，
完整生产构建、6 项后台流程和桌面/移动视口的 10 项公开流程均通过。
已确认临时会话、锁文件和测试新建文章清理。2026-10-13 在修复依赖后再次完整运行，
16 项通过；GitHub `TEST_DATABASE_URL` Secret 已配置。
PR #19 合并上线后设置了 `E2E_ENABLED=true`，首次云端运行
[38304671450](https://github.com/fanhefeng/fhfs-site/actions/runs/38304671450) 的 21 项流程全部通过。


2026-10-13 后续批次：独立构建目录下 21 项流程全部通过（11 项后台、10 项公开）。
媒体校验测试首先复现未管理的本地路径被保存，补齐校验后通过；正常构建的 BUILD_ID、
预渲染清单及两份 tsconfig 在测试前后保持一致，根 next-env.d.ts 恢复，会话与锁清除。
SIGINT（迁移阶段）和 SIGTERM（服务启动后）实际中断均通过：退出码分别为 130 / 143，
3100 端口释放、会话与锁删除、正常构建及类型入口保持原样。


后续批次新增两个公开浏览器回归：介绍页在 JavaScript/3D 尚未加载时已能阅读，
说说日历的日期链接具备可访问名称和键盘 Enter 激活。对应 Chrome 桌面/移动视口均通过。
生产 HTTPS 上 WebKit 公开流程、视频解码、拖动和播放器互斥已验证；音视频样本的
首段/尾段 Range 为 206，越界为 416。WebKit 不等同于真实 iOS 设备。

无障碍检查覆盖中英文首页、介绍、说说、Kobe 页的浅/深主题。等待字体与入场动画完成后
扫描，避免把透明度过渡中的瞬间当成最终颜色；人工键盘流程与自动扫描分别记录。
介绍页已有首屏文字渲染回归，但 3D 主线程负载仍需按 Lighthouse 实测继续优化。
