# GeoMon · 官网 GEO 诊断与监测平台

内部工作台：对国内品牌官网做 GEO（AI 搜索可见性）诊断、人工评分、报价排期，
并对 DeepSeek / 豆包 / 通义千问三平台做关键词引用率日常监测与竞对对比。

## 技术栈

React 19 + TypeScript + Vite 7 + Tailwind + shadcn/ui · Hono + tRPC 11 + Drizzle ORM · MySQL/MariaDB · ECharts · Vitest

## 环境要求

- Node.js ≥ 20（开发基线 22.x）
- MySQL 8+ 或 MariaDB 10.6+（开发用 MariaDB 便携版即可）

## 快速开始

```bash
npm ci

# 配置数据库连接（见「环境变量」），然后建表 + 种子
npm run db:push          # drizzle 按 schema 同步表结构（开发期）
npx tsx db/seed.ts       # 种子数据：2 项目 / 42 天监测 / 3 账号

npm run dev              # http://localhost:3000（前端 + /api 同端口）
```

种子账号（初始密码均为 `GeoMon@2026`，生产部署前请修改）：

| 账号 | 角色 | 说明 |
|---|---|---|
| `zhanglai` | admin | 项目负责人，含账号管理 |
| `chenyun` | operator | 运营执行，业务读写 |
| `hanhoo` | client | 客户只读，绑定韩后项目 |

## 环境变量（`.env`）

```env
DATABASE_URL=mysql://user:pass@127.0.0.1:3306/geomon
# PORT=3000   # 可选，生产端口
```

> 本地 `.env` 不提交到 GitHub；从 `.env.example` 复制后填写自己的配置。
> 部署时通过环境变量注入真实凭据。`APP_ID`/`APP_SECRET`/`VITE_APP_ID` 当前代码未消费，可移除。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite 开发服务器（Hono/tRPC 经 @hono/vite-dev-server 同端口挂载） |
| `npm run check` | `tsc -b` 类型检查 |
| `npm run lint` | ESLint（0 error 基线；fast-refresh 规则为 warn） |
| `npm test` | Vitest：contracts 层评分/KPI/报价/排期/实测定档单元测试 |
| `npm run build` | 前端 `vite build` + 后端 esbuild 打包 `dist/boot.js` |
| `npm start` | 生产启动（直跑入口自动识别，跨平台无需 cross-env） |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle 迁移工具链 |

`db/seed.ts` 会**清空全部业务表**：仅允许指向 localhost 的库直接执行；
其他目标须 `SEED_CONFIRM=YES npx tsx db/seed.ts` 显式确认。

## 目录结构

```
api/            Hono + tRPC 后端（router 按域拆分，middleware 提供 RBAC）
  services/     聚合统计、爬虫、交付物组装等服务
  templates/    导出 HTML 模板（诊断报告/底稿/排期/报价/周期报告）
contracts/      前后端共享契约：评分引擎、KPI 口径、报价、排期、实测定档、禁用词
db/             Drizzle schema / seed / migrations
src/pages/      16 个页面（全部路由懒加载）
src/features/   board(看板) / monitor(词池·实测) / business(报价·报告) 业务组件
```

## 关键口径（勿随意改）

- 评分：四档分 0/10/15/20；综合 = 技术25% + 架构20% + 内容30% + 可见度25%；A≥80 / B≥65 / C≥45 / D<45
- 引用等级：L2 来源命中（计 KPI）/ L1 品牌提及 / L0 未命中；可拓词不计 KPI 分母
- 服务周期：3 个月无指标考核；6 个月 ≥30%；12 个月 ≥50%（验收线 = 目标 ×0.8）
- RBAC：client 只读且仅可见绑定项目（`assertProjectAccess` 兜底，staff 不限）

## 已知待办

- `measurements.stats` 聚合仍在内存（当前数据量可接受，量大后应下推 SQL GROUP BY）
- 无 CI / Dockerfile；迁移历史需从 `db:generate` 开始累积
- 用户自助改密接口未实现（目前仅 admin 重置）
