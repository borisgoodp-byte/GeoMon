# GeoMon v1.3 计划：账号权限体系（RBAC）+ 诊断流程嵌入（待压缩包）

## 背景
- 平台后期开放给客户后台查看监测数据 → 需要多账号 + 角色权限 + 按角色呈现不同页面
- 功能逐个落地，本轮优先级：①权限体系完整落地（已确认）②诊断流程嵌入（等用户重新上传压缩包）
- GEO 可见度/采集词监测等维持现状，后续有解决方案再动

## Stage 1 — RBAC 设计契约（Orchestrator 输出 design/rbac-spec.md）
- 角色定义：
  - `admin` 项目负责人（张磊）：全部页面 + 账号管理
  - `operator` 内部执行（陈云）：全部业务页面（诊断/报价/排期/词池/录入/采集/看板/竞对/报告），无账号管理
  - `client` 客户：只读 + 仅自己项目 → 项目总览、监测看板、竞对对比、周期报告、诊断报告（终版）；隐藏：新建诊断/评分复核/报价单/排期/词池/实测录入/采集中心
- 数据模型：users 表（username/passwordHash(scrypt)/displayName/role/projectId/status）
- 认证：Hono+tRPC，login 颁 token（httpOnly cookie + Authorization 兜底），scrypt 密码哈希（node:crypto，零新依赖）
- tRPC 中间件：authedProcedure / roleProcedure；client 角色强制只读 + 强制 projectId 过滤
- 种子账号：张磊(admin) / 陈云(operator) / 韩后客户(client→projectId=韩后)

## Stage 2 — 后端实现（coder 子代理，worktree rbac-be）
- db/schema users 表 + seed；api/authRouter（login/logout/me/users CRUD for admin）
- tRPC context 解析 token；各业务 router 挂载权限守卫（client 只读 + 项目隔离）
- 验收：curl 三角色登录、越权访问被拒、client 跨项目访问被拒

## Stage 3 — 前端实现（coder 子代理，worktree rbac-fe，依赖 Stage 1 契约可并行）
- Login 页（品牌风）、auth store（token+user 持久化）、路由守卫（未登录→/login；角色无权→403 页）
- Layout 按角色过滤导航；Navbar 显示当前用户+退出；client 端隐藏项目切换/编辑类按钮
- 账号管理页（admin）：用户列表 + 新建/停用
- 验收：三角色分别登录截图核对菜单差异

## Stage 4 — 集成验证 + 版本（Orchestrator）
- 合并 → tsc/build → 浏览器三角色走查 → build_version

## Stage 5 — 诊断流程嵌入（压缩包已到，子代理C 施工中）
- 契约 design/diag-embed-spec.md；维度四实测台 + 四类产出物导出 + 周期口径切换
- ⚠️ 2026-09-15 用户更正：3 个月版无指标考核，只按交付物验收；KPI 仅 6 个月 ≥30% / 12 个月 ≥50%

## Stage 6 — 周期报告固定模板（Wave 2，子代理D，契约 design/report-templates-spec.md）
- 周报/月报/季报三份固定模板（IQAir 版式语言），内容口径按技能 schedule-template §03
- 时序：C 先落地（C 动 Reports.tsx 验收口径）→ D 再开工，与 B 并行（文件不冲突）
- Wave 1：A(rbac-be) + C(diag-embed) 并行 → 合并 → Wave 2：B(rbac-fe) + D(report-templates) 并行 → 集成验证 → 版本
