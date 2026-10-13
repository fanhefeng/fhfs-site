# 私有恢复副本

公开的 `backup/` 与 `db-snapshots` 只保留已发布内容，继续用于可读历史。
私有备份另用 restic 加密，包含数据库草稿、迁移记录、序列，以及媒体文件。
只有完成下面的首次备份和恢复验证后，才能把它视为可用的恢复来源。

## 要配置什么

需要一个与 Neon、Cloudflare 媒体站分开的私有 restic 存储仓库，例如私有 S3 兼容 bucket。
存储账号、加密密码应有独立的恢复方式；密码丢失就无法解密。密码保存在密码管理器中，
不要只留在 GitHub Secrets，也不要发到聊天、Git 或 workflow artifact。

| 配置 | 用途 |
|---|---|
| `BACKUP_DATABASE_URL` | 专用只读角色的直连 Postgres URL；不用网站写入角色 |
| `RESTIC_REPOSITORY` | 私有仓库地址，例如 `s3:https://<endpoint>/<bucket>/fhfs-site` |
| `RESTIC_PASSWORD` 或本机 `RESTIC_PASSWORD_FILE` | 独立随机加密密码，至少 20 字符；文件权限 0600 |
| `AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_DEFAULT_REGION` | S3 后端需要的账号变量；按存储商实际要求 |

本机项目变量填在 `.env.local`，S3 账号变量通过当前 shell 或密码管理器注入。
脚本自动读取 `.env.local`。原生 `restic` 命令需要将同样的 restic/S3 变量注入当前 shell，
它不会自行读取 `.env.local`。使用凭据文件时用绝对路径。

备份角色在 Neon SQL Editor 中创建。下面的库名按实际修改，密码通过控制台生成：

```sql
CREATE ROLE private_backup WITH LOGIN PASSWORD '<独立随机密码>';
GRANT CONNECT ON DATABASE neondb TO private_backup;
GRANT USAGE ON SCHEMA public, drizzle TO private_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO private_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO private_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, drizzle
  GRANT SELECT ON TABLES TO private_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, drizzle
  GRANT SELECT ON SEQUENCES TO private_backup;
```

默认权限 SQL 必须由实际创建表的迁移角色执行。`pg_dump` 需要读取序列；只授表权限不够。
`login_attempts` 的结构保留、数据排除。`neon_auth` 与网站无关，不备份。

本机需要 `pg_dump`、`pg_restore`、`restic`。Postgres 客户端主版本至少与服务端相同，
当前 CI 安装 18。macOS 已装 Homebrew `libpq` 时，将 `/opt/homebrew/opt/libpq/bin`
加入 PATH（Intel Homebrew 是 `/usr/local/opt/libpq/bin`）。

```bash
pnpm backup:private check  # 检查变量与本机工具，不连接数据库或存储
pnpm backup:private:selftest # 可独立运行：临时本地仓库、合成数据、加密往返与篡改检测
restic init               # 仅在新的私有仓库运行一次，变量已注入当前 shell
pnpm backup:private create
pnpm backup:private health
pnpm backup:private verify
pnpm backup:private verify-database # 仅取回数据库和清单，适合每日校验
pnpm backup:private restore-database # 向受保护的独立演练库真实导入并逐表比对
```

`create` 使用 `pg_dump` 的一致性快照，再从该 dump 的数据中提取媒体引用，包含草稿引用。
它合并本机 `media/files/moments/`（包括尚未引用的文件）；缺少的引用从媒体站下载，
任何缺失引用都会拒绝上传。媒体站若被同时覆盖，无法承诺数据库与对象存储的跨系统原子快照，
所以正常入口 `pnpm media:deploy` 在部署前、部署后分别完成一次私有备份。
`pnpm media:deploy:safe` 保留为同一入口的兼容别名。
这个命令的第一次备份失败就不会部署；第二次失败需要立即补跑备份。

每份副本包含 `database.dump`、`media/moments/*`、`snapshot.json`。
清单逐文件记录字节数和 SHA-256；路径穿越、符号链接、缺失文件或哈希不符都会失败。
暂存目录使用 0700，文件默认 0600，结束时删除本次暂存目录；原生工具输出不会进入日志。
突然断电或 SIGKILL 仍可能留下系统临时目录 `fhfs-private-backup-*`，应在确认进程停止后清理。

`verify` 会从加密仓库恢复最新副本到临时目录，验证每个文件和 dump 的目录表，然后清理。
`verify-database` 先检查仓库，再只恢复 dump/清单并校验数据库字节和目录表，
不会重新下载全部媒体。两者都**不能代替向 Postgres 恢复的演练**。

## 每月数据库恢复演练

`restore-database` 选择性取回最新 dump/清单，先验证大小、SHA-256、归档目录和 36 小时新鲜度，
再向独立恢复项目的专用数据库导入。它比较全部 COPY 列和排序后行数据（包含草稿字段、空值、
转义文本和迁移历史），比对序列值/调用状态、表清单及空的登录限流表。媒体完整字节验证仍按季度运行。
这不是生产部署切换或完整灾难恢复 RTO 演练。

新增 Secret/本机变量 `BACKUP_RESTORE_DATABASE_URL` 仅交给恢复步骤。目标必须满足：

- 直连独立恢复项目；主机与备份源、生产以及 E2E URL 不同（池化主机归一化后比较）。
- 数据库名 `fhfs_restore_drill`，角色名 `backup_restore`，使用 TLS。
- 角色无 superuser、CREATEDB、CREATEROLE 或角色成员资格；只拥有演练库的应用对象。
- `recovery_control.guard` 恰有一行 `fhfs-private-restore-only`；角色只能读取标记，不能写入。

标记必须预先由恢复项目管理员创建；脚本不会自动创建或修复它。首次准备示例（仅在独立恢复项目）：

```sql
-- 使用独立随机密码；SQL 创建的 Neon 角色不自动取得 neon_superuser。
CREATE ROLE backup_restore LOGIN PASSWORD '<随机密码>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
-- 创建库的管理员需要目标 owner 的成员资格；反向授权不允许。
GRANT backup_restore TO neondb_owner;
CREATE DATABASE fhfs_restore_drill OWNER backup_restore;
```

连接新建的 `fhfs_restore_drill` 后由管理员执行：

```sql
REVOKE CONNECT, TEMPORARY ON DATABASE fhfs_restore_drill FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE fhfs_restore_drill TO backup_restore;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA recovery_control AUTHORIZATION neondb_owner;
REVOKE ALL ON SCHEMA recovery_control FROM PUBLIC;
CREATE TABLE recovery_control.guard (
  purpose text PRIMARY KEY CHECK (purpose = 'fhfs-private-restore-only')
);
INSERT INTO recovery_control.guard VALUES ('fhfs-private-restore-only');
GRANT USAGE ON SCHEMA recovery_control TO backup_restore;
GRANT SELECT ON recovery_control.guard TO backup_restore;
```

导入前重复检查 URL、实际库名/角色、权限与标记。归档目录只允许 public/drizzle schema 及其
受支持对象，拒绝数据库创建或第三种 schema；完整恢复这些 schema 定义，避免 `pg_restore --schema`
过滤掉 schema 本身。使用单事务和 `--clean --if-exists --no-owner --no-privileges`，不创建/删除数据库，
不恢复角色授权。命令依据：[PostgreSQL pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html)。

演练会替换专用库中属于归档的应用对象；不可把它用于日常开发或保管唯一副本。
若出现归档外的额外应用表，清单比对会失败，需要管理员确认来源后处理。
控制标记不在恢复的 schema 中，导入后再次确认它和角色权限。

本机首次真实导入和比对通过、Secret 配置后，手工运行 workflow 的 `restore-database`。
确认云端实际执行成功，再设置仓库变量 `PRIVATE_RESTORE_ENABLED=true` 启用每月北京时间
8 日 06:53 的调度；该开关只控制自然调度，便于先手工验收。GitHub 不保证准点。
该步骤与其他私有备份任务串行，明文仅在 0700 临时目录，结束清理，不上传 artifact。

## 自动化与保留

GitHub Secrets：`BACKUP_DATABASE_URL`、`RESTIC_REPOSITORY`、`RESTIC_PASSWORD`；
S3 凭据对应 `BACKUP_AWS_ACCESS_KEY_ID`、`BACKUP_AWS_SECRET_ACCESS_KEY`，仓库变量
`BACKUP_AWS_REGION`。首次手工验证后设置仓库变量 `PRIVATE_BACKUP_ENABLED=true`。

`.github/workflows/private-backup.yml` 每天北京时间 04:17 创建，并立即从异地仓库取回数据库校验；10:37、16:37、22:37
独立检查新鲜度，每年 1/4/7/10 月 2 日 05:47 完整取回并做字节验证。36 小时没有成功快照即失败。
每月 8 日 06:53 另向受保护的专用库真实恢复数据库，需要上述独立恢复 Secret。
调度避开整点，但 GitHub 不保证准点执行。
任务串行，日志不列私有行和文件名，不上传 artifact。打开 GitHub Actions 失败通知，
并检查通知确实送达；调度延迟、workflow 被停用等完全不运行的情形仍需外部监控覆盖。
首次启用可手动执行 `health` 验证空仓库报警，再执行 `create` 与 `verify` 验证恢复。
手工 `alert-test` 在接触数据库或存储之前故意失败，用于检验失败通知；它不创建或修改副本。
该演练的红色记录是预期结果，不能把真实失败或跳过的 job 当成成功。

默认不自动删除任何旧快照。先完成恢复演练并观察容量，再设每日 30、每周 12、每月 12
的保留策略；删除权限与常规备份凭据分开。应用保留策略时先使用 `forget --dry-run`，
明确 `--tag fhfs-private --host fhfs-site --group-by host,tags`，避免临时目录路径把快照分成
不同组。由受控维护凭据进行清理，不把带删除权的长期账号直接交给定时任务。

## 真正的恢复演练

1. 在独立空 Postgres 项目中演练。不要使用生产 URL，也不要将私有 dump 导入公开仓库。
2. 在私有工作目录恢复所选快照，`restic restore latest --tag fhfs-private --host fhfs-site --target <私有目录>`；
   目录权限 0700。通过 `snapshot.json` 找到对应的 `database.dump`。
3. 核对主机属于刚创建的独立恢复项目。先在该库 SQL Editor 检查应用 schema 没有对象，结果必须为 0：

   ```sql
   SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname IN ('public', 'drizzle') AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f');
   ```

   非 0 时停止，不清理已有库。新 Neon 库预建了 `public` schema，直接恢复会报它已存在；
   仅在上述空库检查通过后使用 `--clean --if-exists`。使用恢复库 owner 和交互密码提示导入，
   变量 `PGSSLMODE=require` 已在当前 shell 设置：

   ```bash
   pg_restore --clean --if-exists --exit-on-error --single-transaction --no-owner --no-privileges \
     --host=<恢复库主机> --username=<恢复库owner> --dbname=neondb --password \
     <私有目录中的database.dump>
   ```

4. 用 SQL Editor 比对每张应用表行数、草稿行数、迁移记录和序列；确认草稿正文与媒体存在。
   然后用恢复库配置构建站点，检查登录、草稿预览、公开页、媒体播放和 Range 请求。
   导入后缺少原来的角色授权是预期行为，按恢复环境重新授予只读角色权限。
5. 将 `media/moments/` 复制回 `media/files/moments/`，按需重建媒体站。
   不要在演练时向生产 Worker 部署。`media/sizes.gen.json` 从代码仓库恢复，真正迁移时再由部署脚本重算。
6. 在此记录日期、快照 ID、逐表校验结果、实际 RPO/RTO，再处理生产切换与缓存刷新。

目标 RPO 不超过 24 小时，告警容忍到 36 小时；RTO 需首次实测后确定。
2026-10-12 已配置生产库的 `private_backup` 专用角色与本机 `BACKUP_DATABASE_URL`，
确认可读取 public/drizzle 的 17 张表、无表写入权限、无提权角色成员资格。
使用原生 PostgreSQL 18 客户端成功导出 137,490 字节的自定义格式 dump，并通过目录表检查；
该临时 dump 已删除。凭据仅存于被忽略的本机 `.env.local`（0600）。
2026-10-13 已配置 B2 私有 bucket（`ca-east-006`），默认 SSE-B2 加密、保留全部版本。
常规应用密钥只允许该 bucket 的 `fhfs-site/` 前缀，能力为 `listBuckets`、`readBuckets`、
`listFiles`、`readFiles`、`writeFiles`，不含 `deleteFiles` 或密钥管理权限。临时配置密钥已撤销，
旧密钥认证实测返回 401。独立 restic 随机密码与 S3 凭据仅存本机私有配置和 GitHub Secrets，
本机恢复凭据另保存在被忽略、权限 0600 的 `.private-backup-recovery/credentials.json`；
用户还需将它安全保存在独立密码管理器或离线介质。

首次 `create`、`health`、`verify` 全部成功：含草稿、一致性 dump 与 281 个媒体文件，
取回 282 个文件并验证大小、SHA-256 和 dump 目录。空仓库健康检查曾按预期失败。
使用一次性合成文件实测：允许上传与隐藏，永久删除和前缀外上传均返回 401；
这不会把常规凭据变成不可隐藏快照的 WORM 凭据，保留全部版本是恢复旧版本的前提。
restic 锁清理已实际完成，不能把 B2 的隐藏操作误当成永久版本删除。

账户控制台实际限制为存储 10 GB、每日下载 1 GB，费用上限 $0，邮件提醒已选中。
本次完整字节验证仅下载一次全部媒体；数据库演练再按同一快照 ID 选择性取回 dump 和清单，
避免重复全量下载越过每日限额。后续演练与批量恢复也先核对控制台剩余额度。
GitHub 所需五项 Secret 和区域变量已配置；PR #19 已合并并上线，
`PRIVATE_BACKUP_ENABLED=true` 已启用。首次云端创建运行
[38304663153](https://github.com/fanhefeng/fhfs-site/actions/runs/38304663153) 成功，
包含 281 个媒体文件；云端 health 确认快照时间为 2026-10-13 04:32:49 +08:00。
PR #21 已发布每日数据库取回校验、错峰调度和告警演练。main 的
[38310197460](https://github.com/fanhefeng/fhfs-site/actions/runs/38310197460) 创建/数据库取回/health 全部通过。
受控告警 [38307835631](https://github.com/fanhefeng/fhfs-site/actions/runs/38307835631) 的 GitHub 站内通知
及现有 QQ 收件箱邮件均已确认；后续 health 成功。Codex 每 12 小时的只读巡检已启用（ACTIVE），
独立于 GitHub workflow 调度器，检查任务停用、跳过与过期；依赖本机 Codex 在线，不能当作全天候托管监控。

本次快照 ID：`f62a87db0fbaff22b6094f69f0c18dff7c3cdbce6e85fa85d0adae90d194af5a`，
时间 2026-10-13 03:35:57 +08:00。恢复到独立新建的 PostgreSQL 18 Neon 项目
`fhfs-site-restore-20261013`，项目 ID `still-butterfly-02854351`，未使用生产或 E2E 数据库。
恢复前确认 public/drizzle 没有应用表，单事务导入后 17 张表存在；16 张备份数据表逐表行数与
排序后 COPY 数据 SHA-256 一致，草稿字段、迁移历史和 14 个序列值/调用状态一致。
登录限流表保留结构、数据排除，恢复为空。

选择性下载 dump/清单、数据库导入及 SQL 验证共 190 秒；这不是包含部署切换的完整 RTO。
快照在本次数据库校验完成时约 11 分钟；这不是包含持续运行历史的 24 小时 RPO 保证；定时任务现已启用，仍须观察每日运行。
恢复库的生产构建生成 155/155 个静态页面，10 项 Chrome 桌面/移动视口公开测试通过；
使用临时随机密码完成后台登录，5 个后台页面可读取，中英文 OG 图片正常。快照没有草稿行，
逐表数据比较仍包括 draft 字段；草稿匿名隐藏和授权预览由独立测试库的合成样本验证。
验收后停止恢复库站点，删除本机临时明文 dump、会话凭据及包含恢复内容的测试构建。
独立恢复项目仍留在用户 Neon 账号下，未向生产部署或切换数据库。

2026-10-13 补充：在同一独立恢复项目内新建 `fhfs_restore_drill`，原 `neondb` 恢复副本保留。
SQL 创建的 `backup_restore` 无提权成员资格、CREATEDB/CREATEROLE/superuser，控制标记由管理员拥有。
`pnpm backup:private restore-database` 已真实导入并比较 17 张表、14 个序列，数据/列/迁移一致。
另暂时撤销标记 SELECT，命令按预期失败，存储与恢复命令未被调用，17 张应用表不变；随后恢复权限。
归档范围与数据比较新增 7 项测试，含空表/空字符串、重复行、转义、草稿、序列变化和异常归档拒绝。
审查补充了 Postgres 主机大小写与 DNS 尾点归一化；E2E 的生产隔离也用真实失败回归补齐相同边界。
首次原生命令发现 `--schema` 会漏掉 schema 创建；修复为先校验完整归档范围再完整恢复，真实重跑通过。
云端首次执行与重复恢复结果记录在对应 PR；定时触发的成功仍应独立观察。

原理与命令依据：[PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)、
[restic backup](https://restic.readthedocs.io/en/stable/040_backup.html)、
[restic restore](https://restic.readthedocs.io/en/stable/050_restore.html)。

B2 权限依据：[应用密钥能力](https://www.backblaze.com/docs/cloud-storage-application-key-capabilities)、
[S3 与 B2 权限映射](https://www.backblaze.com/docs/cloud-storage-map-iam-policies-and-s3-acls-to-backblaze-b2-access-controls)。

云端巡检和独立超时告警的配置、权限、检测窗口与迁移回退见 [CLOUD-MONITORING.md](CLOUD-MONITORING.md)。
