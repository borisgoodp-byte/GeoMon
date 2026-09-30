# GeoMon 平台

官网 GEO 诊断与监测平台的项目源码。应用入口位于 `kimi-agent-platform/app/`，技术栈为 React、TypeScript、Vite、Hono、tRPC、Drizzle ORM 和 MySQL/MariaDB。

## 项目结构

- `kimi-agent-platform/app/`：前后端源码、共享业务契约、数据库表结构与迁移脚本。
- `kimi-agent-platform/DESIGN_SPEC.md`：产品设计说明。
- `kimi-agent-platform/geo-platform/`：规划材料。
- `启动GeoMon.ps1` / `启动GeoMon.bat`：原本机环境的一键启动脚本。
- `verify.py`：原项目的端到端验证脚本；会创建和修改测试业务记录，请只对测试环境执行。

## 本地开发

1. 准备 Node.js 22 和 MySQL 8+ 或 MariaDB 10.6+。
2. 进入应用目录并安装依赖：

   ```powershell
   cd kimi-agent-platform/app
   npm ci
   Copy-Item .env.example .env
   ```

3. 编辑 `.env`，填写自己的 `DATABASE_URL` 等配置。
4. 在空的开发数据库中初始化表结构，再启动应用：

   ```powershell
   npm run db:push
   npm run dev
   ```

如需演示数据，可参考 [应用说明](kimi-agent-platform/app/README.md)。`db/seed.ts` 会清空业务表，只能对专用测试数据库执行。项目包含演示账号的默认密码及自动登录页面，公开部署前需移除自动登录入口并更换默认密码。

## 构建与检查

在 `kimi-agent-platform/app/` 下执行：

```powershell
npm test
npm run check
npm run build
```

`npm start` 启动构建后的应用。

## 仓库与本机运行环境的区别

本仓库保留源码、依赖锁定文件、配置示例和数据库迁移脚本。以下内容只留在本机，不上传 GitHub：

- `.env` 等真实环境配置和密钥文件。
- `mariadb/`、`mariadb-data/` 和 `mariadb.zip`。
- 数据库导出及备份文件，包括 `dump_recovered.sql` 和 `db/geomon_dump.sql`。
- `node_modules/`、`dist/`、日志和缓存。

因此，克隆仓库不会携带现有业务数据。需要恢复现有数据时，请通过独立的安全备份渠道处理。

根目录的一键启动脚本依赖原本机的便携数据库目录及路径。新机器请按上面的开发步骤配置，或根据实际安装路径调整启动脚本。
