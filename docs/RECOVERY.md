# 库没了怎么办

站点的内容全在 Postgres 里，而 Postgres 在别人手上。这份文档是那一天的操作单：
从「手滑删错一行」到「Neon 账号整个没了」，每一级该怎么走。

读这份文档的人多半正在着急，所以每一级都是可以照着敲的命令，解释放在后面。

## 备份都在哪

| 副本                                | 位置                            | 多久更新一次                       |
| ----------------------------------- | ------------------------------- | ---------------------------------- |
| `backup/`（main 分支）              | GitHub + 你本机的 clone         | 每个改内容的 PR，跟着代码走        |
| `backup/`（`db-snapshots` 分支）    | GitHub                          | 每天 03:00 自动，内容有变才提交    |
| Neon 自己的 history / branch restore | Neon                            | 连续，但只保留很短一段时间         |

前两份是同一个 `backup/db.json`，`pnpm db:import` 读的就是它。第三份是 Neon 的
point-in-time restore，**只在情形一里有用**：它和库存在同一个账号里，账号没了它
一起没。它的保留期去 Neon console 的 Settings → History retention 看（Free 计划
通常是 6 小时），过了就回不去了。

**没有备份、也不需要备份的东西**：`AUTH_SECRET` 和 `ADMIN_PASSWORD_HASH` 丢了
跑 `pnpm admin:password` 重新生成一对，填回 Vercel 就是了——它们不锁任何数据。
`public/` 下的音乐、模型、照片都在 git 里。`messages/*.json` 是全部文案的默认值，
也在 git 里：就算 `copy_blocks` 整张表没了，站点照文件显示，不会白屏。

真正只存在于数据库、丢了就没有第二份的，只有 `backup/db.json` 里那 12 张表。

## 情形一：删错了、改错了，库还在

最常见的一种，也最好救。两条路，选快的那条：

**如果是刚刚发生的**（在 Neon 的保留期内），去 Neon console 从事故之前的时间点
建一个 branch，确认数据对，再把它 promote 成主分支。这条路连没备份的那几分钟
编辑也一起救回来。

**如果已经过了保留期**，或者你只想退回上一次快照：

```bash
git fetch origin db-snapshots
git checkout db-snapshots -- backup/     # 取最新的自动快照
pnpm db:import
git checkout main -- backup/             # 别把快照混进工作区
```

`db:import` 对有主键的表是 upsert，**不会删掉**备份之后新建的行——真要干净回滚，
多出来的行自己去 `/admin` 删。`chips`、`nav_items`、`copy_blocks` 三张表是整表
替换，会精确回到备份的样子。

导完看[收尾](#每次恢复完都要做的事)。

## 情形二：库或项目没了，Neon 账号还在

Neon 项目被删、分支被误删、或者欠费清理掉了。账号还能登录，所以只是重建一个空库。

```bash
# 1. Neon console 新建 project，拿两个连接串写进 .env.local：
#    DATABASE_URL           （带 -pooler 的）
#    DATABASE_URL_UNPOOLED  （直连的，迁移和脚本用它）

# 2. 空库建表 —— 12 个迁移都在 drizzle/ 里
pnpm db:migrate

# 3. 灌内容。先确认手上这份 backup/ 是最新的：
git fetch origin db-snapshots
git log --oneline origin/db-snapshots | head -3    # 最后一次自动快照是哪天
git checkout db-snapshots -- backup/               # 比 main 的新就用它
pnpm db:import

# 4. 对一下行数
pnpm db:check
git checkout main -- backup/
```

然后把新的 `DATABASE_URL` 填进 Vercel 的环境变量（Production / Preview /
Development 三个环境都要），重新部署一次。GitHub 那个叫 `DATABASE_URL` 的
secret 也要换成新库的只读角色，否则每天的自动备份会一直失败——那正是它该失败
的方式，别忽略它。

别忘了在新库上重建只读角色，CI 的 build 和每日备份都用它：

```sql
CREATE ROLE ci_readonly WITH LOGIN PASSWORD '…';
GRANT CONNECT ON DATABASE neondb TO ci_readonly;
GRANT USAGE ON SCHEMA public TO ci_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ci_readonly;
REVOKE SELECT ON login_attempts FROM ci_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ci_readonly;
```

## 情形三：Neon 账号整个没了

账号被封、注销、或者哪天 Neon 这家公司不在了。PITR、分支、项目一起消失，
`backup/db.json` 是唯一剩下的东西——它在 GitHub 上，也在你本机的 clone 里。

好消息是代码对 Neon 的绑定很浅：**Neon 专有的代码只有三个文件**，schema、12 个
迁移、所有查询、`drizzle.config.ts`（`dialect: "postgresql"`）、`src/lib/env.ts`
的校验（只认 `postgres://`）全都不用动。

换成任意一家标准 Postgres（Supabase、Railway、Render、自己的机器都行），改这三处：

1. **`src/db/index.ts`** — `drizzle-orm/neon-http` 换成 `drizzle-orm/postgres-js`，
   删掉 `neonConfig.fetchFunction` 那段。`withConnectionRetry` 包的是 HTTP fetch，
   换了驱动就没有 fetch 可包了，重连交给驱动自己。
2. **`scripts/connect.mts`** — 同上。它的 `DATABASE_URL_UNPOOLED ?? DATABASE_URL`
   回退本来就在，别家没有「unpooled」这个概念也能跑。
3. **`scripts/db-import.mts`** — `db.batch()` 是 neon-http 专有的，换成
   `db.transaction()`。换过去之后反而更强：真事务，不再有「一张表一个请求」的限制。

包也要换：`@neondatabase/serverless` 出，`postgres` 进。

改完就是情形二的流程：`pnpm db:migrate` → `pnpm db:import` → 改 Vercel 环境变量
→ 部署。

顺带一提，`src/db/index.ts` 的注释写着「没有多语句事务」是设计前提——标签用数组
列、保存永远是单条 upsert。换到真驱动之后这条约束就没了，但**别急着依赖它**：
`src/lib/retryFetch.ts` 的连接级重试之所以安全，正是因为每条语句都幂等。

## 每次恢复完都要做的事

站点是静态预渲染的，页面挂在 `unstable_cache` 的标签上。**库变了，页面不会自己
知道**——它会继续端着老内容，一直到有什么东西调用 `updateTag`。

所以：**去 `/admin` 随便找个东西按一次保存**。任何一次保存都会刷掉相关缓存。

本地 dev 另说，dev 的数据缓存在 `.next/dev` 下（Next 16 的位置变了）：

```bash
rm -rf .next/dev/cache/fetch-cache && pnpm dev
```

## 每日自动备份是怎么跑的

`.github/workflows/backup.yml`，每天 03:00（北京时间），跑 `pnpm db:export`，
内容有变就往 `db-snapshots` 分支提交一个 commit。那个分支只装 `backup/` 和这份
文档的副本，不带 main 的历史。

中间隔着一道 `scripts/db-snapshot-guard.mts`：**任何一张有行的表变成空表，这次
快照就被拒绝、整个 job 失败。** 理由在 `src/lib/backup.ts` 里写着——一个没人看的
定时任务最危险的失效方式，是它成功地把一份空备份盖在好备份上面。

所以 backup 这个 workflow 变红了要去看，那通常不是 CI 抽风。

要临时手动跑一次：Actions → backup → Run workflow。

## 演练记录

一份没验证过的备份不算备份。这条路径最后一次走通是：

- **2026-09-20** —— 在 Neon 建沙箱分支，`DROP SCHEMA public CASCADE` 清成空库，
  走 `pnpm db:migrate` + `pnpm db:import`，逐表比对行数一致。（情形二全程）
