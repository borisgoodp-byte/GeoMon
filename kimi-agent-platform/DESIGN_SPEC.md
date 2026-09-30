# DESIGN_SPEC · 官网 GEO 诊断与监测平台（工程契约 · 唯一事实来源）

> 所有后端/前端子代理必须严格遵守本契约。评分数学、口径、字段名一律以本文件为准。
> 技术栈：Node 20 · Vite 7.2.4 · React 19 + TS · Tailwind 3.4.19 · shadcn/ui · Hono + tRPC 11 + Drizzle ORM + MySQL · ECharts 5
> 后端特性：`--features db`（不做登录鉴权，v1 内部工具；路由全部 publicProcedure）

---

## 1. 评分引擎（contracts/scoring.ts，前后端共享）

### 1.1 四档分与等级
- 子指标只允许 `0 | 10 | 15 | 20`（20 优秀 / 15 良好 / 10 待提升 / 0 缺失），UI 与后端双重校验，禁止连续打分。
- 维度一/二/三维度分 = 该维度 5 子项求和（0–100）；维度四 = round((3 子项和 ÷ 60) × 100, 1)。
- 综合健康度 = 技术×0.25 + 页面×0.20 + 内容×0.30 + 可见度×0.25，保留 1 位小数。
- 等级：A ≥80（优秀）/ B 65–79.9（良好）/ C 45–64.9（待提升）/ D <45（亟需优化）。
- 维度四单项定档：某词类在三平台命中平台数 3→20、2→15、1→10、0→0。「命中」= 该平台该词类存在 L2 实测记录。

### 1.2 18 项指标定义（indicatorKey / 名称 / 评分关键点）
维度一 技术底座（蓝 #1a56db 系呈现，权重 25%）：
- `tech_1` AI爬虫准入与抓取健康度：robots.txt 对主流 AI 爬虫放行；HTTPS、301、404 规范
- `tech_2` 正文可提取性：不执行 JS 能否拿到完整正文（HTML 直出 vs 空壳/图片承载）
- `tech_3` 内容发现协议：sitemap.xml 完整可访问且与现网一致；llms.txt 提供 AI 索引
- `tech_4` 结构化数据覆盖度：Organization / Product|Service / FAQPage / Article / BreadcrumbList
- `tech_5` 结构化数据规范度与实体关联：JSON-LD 合规、与可见内容一致、@id 互链成图谱
维度二 页面架构（权重 20%）：
- `arch_1` 核心页面体系完备度：首页/产品服务页/blog或内容板块/案例页/FAQ页/关于/联系 七类
- `arch_2` URL语义与目录层级：语义可读、深度≤3 层、无参数乱串
- `arch_3` 内链与面包屑：面包屑、可爬导航、相关推荐、无孤岛页
- `arch_4` 页面语义标签规范：title/description 唯一、H1 唯一、canonical、图片 Alt、HTML5 语义标签
- `arch_5` 页面主题唯一性与重复控制：一页一主题、无薄页/近似重复页、canonical 归一
维度三 内容生态（权重 30%）：
- `cont_1` 决策问题覆盖度：怎么选/怎么比/多少钱/怎么用/适合谁
- `cont_2` 内容时效与作者署名：发布/更新日期 + 作者或责任部门
- `cont_3` 内容原创性与信息增量：自有经验/场景判断/案例细节 vs 转载通稿
- `cont_4` 内容可引用形态：问答式/清单式/参数表/结论先行
- `cont_5` 白皮书与深度内容资产：白皮书/行业报告/技术文档，网页可读
维度四 GEO可见度（权重 25%）：
- `vis_1` 决策词官网被引用（三平台命中数定档）
- `vis_2` 场景词官网被引用
- `vis_3` 对比词官网被引用

每项含：name、keyPoints（评分关键点文案）、anchorGood（优秀 20 锚点）、anchorBad（缺失 0 锚点）——文案从评分准则 v3 原文提取。

## 2. 引用判定与 KPI 口径（contracts/kpi.ts）

- 判定等级：`L2` 来源命中（正文给出官网地址/链接，或来源列表含官网页面 → 计 KPI）；`L1` 品牌提及（不计、单列观察）；`L0` 未命中。
- 平台枚举：`deepseek` DeepSeek / `doubao` 豆包 / `qwen` 通义千问。
- 词类枚举：`brand` 品牌类 / `generic` 通用类 / `scenario` 业务场景类。
- 引用呈现率 = L2 记录数 ÷ 实测记录总数 × 100%（按筛选范围：项目/词池/平台/日期区间；可拓词默认单独统计不计 KPI 分母）。
- 意向词覆盖率 = 期间至少 1 次 L2 的词数 ÷ 词池生效词数 × 100%。
- 被引用页面数 = 去重 normalizeUrl(citedUrl) 计数（仅 L2）；被引用总次数 = L2 记录数。
- normalizeUrl：小写 host → 去 `www.`/`m.` 前缀 → 去 query 追踪参数（utm_*/spm/from/_t 等）→ 去 fragment → 去默认文件名（index.html/index.htm/default.aspx）→ 去尾斜杠。
- 日粒度：按 measureDate 聚合引用率，仅作监控。
- 考核达标（checkpoint）：6 个月节点目标 30%、12 个月节点目标 50%；节点当日实测引用率 ≥ 目标×0.8（24%/40%）即「验收合格」，≥ 目标即「达标」。项目服务档 KPI：初级 20% / 中级 30% / 高级 40%。
- KPI 达成状态枚举：`achieved` 达标 / `accepted` 验收合格 / `below` 未达标 / `pending` 未到节点。

## 3. 数据模型（db/schema.ts · Drizzle · MySQL）

所有表 `id: serial` 主键；FK 用 `bigint({mode:'number',unsigned:true})`；时间戳 `timestamp` default now。
- `projects`：name, company, domain, industry, serviceTier(`basic|standard|premium`), stage(`A|B|C|D`), startDate(date), owner, note, status(`active|archived`)
- `diagnostics`：projectId FK, diagnoseDate(date), status(`crawling|scoring|completed`), techScore/archScore/contentScore/visScore/compositeScore (decimal 5,1, nullable), grade(varchar nullable), verdictJson(json 可空：{tech,pages,content,visibility,core} 五段结论), directionsJson(json 可空：[{step,title,items:string[]}×4])
- `indicator_scores`：diagnosticId FK, indicatorKey(varchar), dimension(int 1-4), score(int 可空), autoScore(int 可空), autoEvidence(text 可空), evidence(text 可空 人工证据), unique(diagnosticId+indicatorKey)
- `findings`：diagnosticId FK, dimension(int), severity(`danger|warn|ok`), title, body(text), impact(text), sortOrder(int)
- `crawl_results`：diagnosticId FK, targetUrl, status(`ok|partial|failed`), summaryJson(json：变体可达性/robots/sitemap/llms/抽样页数组), createdAt
- `keyword_pools`：projectId FK, name, version(int default 1), status(`draft|locked`), lockedAt(timestamp 可空), note
- `keywords`：poolId FK, text, category(`brand|generic|scenario`), isExtended(boolean 可拓词), status(`active|removed`), addedAt
- `pool_change_logs`：poolId FK, action(`create|lock|unlock|add|remove|extend`), detail(text), operator(varchar), createdAt
- `measurements`：projectId FK, poolId FK, keywordId FK, measureDate(date), platform(`deepseek|doubao|qwen`), level(`L2|L1|L0`), citedUrl(text 可空), citedUrlNorm(varchar 可空), citedPageTitle(varchar 可空), snapshot(text 可空 回答快照/备注), isCheckpoint(boolean), checkpointTag(`m6|m12` 可空), createdAt
- `quotes`：projectId FK, title, tier, itemsJson(json [{group,name,desc,unit,price,qty}]), totalPrice(decimal 12,2), status(`draft|issued`), createdAt
- `schedules`：projectId FK, startDate(date), phasesJson(json [{phase,name,tasks:[{name,owner,startDay,endDay,deliverable}]}]), milestonesJson(json [{name,day,desc}]), createdAt
- `competitors`：projectId FK, name, domain（竞品对标扩展，v1 仅录入与展示）

## 4. tRPC 路由（api/ 下，全部 publicProcedure + zod 校验）

- `projects`：list / get(id) / create / update / remove；get 时联表最新 diagnostic 摘要与近 30 日引用率
- `diagnostics`：listByProject / get(id) / create(projectId) / saveScores(diagId, scores[])（ upsert 18 行并重算维度分/综合分/等级写回）/ saveFindings(diagId, findings[])（整体替换）/ saveVerdict(diagId, verdictJson, directionsJson) / complete(diagId) / reportData(id)（报告页聚合：项目+分数+发现+速览九格+结论+方向）
- `crawl`：run(diagnosticId)（执行抓取→写 crawl_results→写 indicator_scores.autoScore/autoEvidence→返回摘要）；crawl 失败不阻塞，状态置 partial
- `pools`：create(projectId, name, words[]) / get(projectId) / lock(poolId, operator) / addKeyword(poolId, text, category, isExtended, operator)（锁定池加词须记录变更日志）/ removeKeyword / changeLogs(poolId)
- `measurements`：create / bulkCreate(rows[])（服务端做 normalizeUrl）/ list(filters: projectId, from, to, platform, category, level, keywordId) / stats(projectId, from, to, platform?) → {kpi 卡五项, daily[], byPlatform[], byCategory[], topPages[], matrix 平台×词类, calendar[]}
- `quotes`：create / update / get / listByProject；价格目录常量 QUOTE_CATALOG 放 contracts/quote.ts（占位价可编辑）
- `schedules`：generate(projectId, startDate)（按 §6 规则生成 phasesJson+milestonesJson 落库）/ update / get
- `reports`：period(projectId, type:`week|month|quarter`, refDate) → 汇总对象（KPI 达成、环比、趋势数组、词级明细、空白词清单、建议）

## 5. 抓取器（api/services/crawler.ts，Node fetch + cheerio）

流程：域名归一 → 探测 4 个入口变体（https/http × 裸域/www）状态码与跳转链 → 取可达入口抓 robots.txt / sitemap.xml / llms.txt / 首页 → 从首页提取站内链接（≤15 页样本，优先导航与产品/内容页）→ 逐页解析：http 状态、title、meta description、H1/H2 数、canonical、img alt 比例、JSON-LD 块（解析 @type 集合、语法错误、@id 互链）、可见纯文本字数（去 script/style）、面包屑痕迹、导航 a[href] 可爬性、URL 深度与语义性。
自动建议分映射（证据写入 autoEvidence）：
- tech_1：主入口不可达或 robots 明确拦截 AI 爬虫（GPTBot/ClaudeBot/Bytespider/PerplexityBot 等）→0；入口单点+跳转不规范→10；基本规范→15；全规范→20
- tech_2：样本页可见文本中位数 <200 字→0；200–500→10；500–1200→15；>1200→20
- tech_3：sitemap 与 llms.txt 均无→0；其一→10（sitemap 存在且可解析→15）；两者齐全→20
- tech_4：无 JSON-LD→0；仅 1 类→10；2–3 类→15；≥4 类（含 Organization+Product/Service）→20
- tech_5：无 JSON-LD→0；解析错误→10；合规但无 @id 互链→15；合规且互链→20
- arch_1：按识别页型数（首页/产品/内容/案例/FAQ/关于/联系）≥6→20；4–5→15；2–3→10；≤1→0
- arch_2：URL 平均深度 ≤3 且语义化→15/20；深度 4 或编号式→10；乱码参数→0
- arch_3：导航为真实链接且发现面包屑→15–20；无可爬导航→0；无面包屑其他 OK→10
- arch_4：按 title 唯一率/H1 存在率/canonical 覆盖/alt 完整率综合定档
- arch_5：重复 title 比例 >50% 或近似页成簇→10；严重重复→0；基本唯一→15/20
- cont_1–cont_5：机器仅给证据（日期/署名关键词检出、问答形态检出、白皮书/PDF 链接检出、内容页字数分布），autoScore 一律保守（有检出 10、无检出 0），由人工复核定档
- vis_1–3：由 measurements 最近一轮（近 30 天）三类词命中平台数自动定档，无实测→0 并提示「待实测」
抓取整体失败：crawl_results.status=failed，18 项 autoScore 全空，UI 引导人工评分。

## 6. 排期表生成规则（contracts/schedule.ts）

输入：startDate + serviceTier。输出 phasesJson + milestonesJson（day 为相对工作日偏移）：
- A 战略诊断（day 0–5）：资料收集与词池商定(0-2) → 网站实测与四维评分(1-4) → 诊断报告出具与汇报(4-5)。里程碑：诊断报告交付(day 5)
- B 官网重构（day 6–25）：语义重构方案(6-10) → 结构化数据部署(8-18) → 商业页升级与架构调整(12-25)（与客户技术团队协同）。里程碑：重构上线(day 25)
- C 内容运营（day 15–75，与 B 尾段并行）：内容战略与选题(15-20) → FAQ 体系搭建(18-30) → 深度长文持续产出(20-75，每周 2 篇) → 存量内容重构(30-60)
- D 数据洞察（day 10–180+）：词池锁定与基准线实测(10-12) → 日常监测周报(12 起每周) → 6 个月考核节点(day ~130) → 12 个月考核节点(day ~260)。里程碑：基准线报告(day 12)、6 个月考核、12 个月考核
考核目标按档：basic=20%、standard=30%、premium=40%（6 个月节点沿用 30%/50% 双线的呈现仅在高级档）。

## 7. 种子数据（db/seed.ts）

1. 项目「韩后 Hanhoo」（company 广州中妆美业化妆品有限公司，domain hanhoo.com，行业 化妆品（护肤品），tier standard，stage A，诊断日期 2026-09）：
   - 子分：tech [10,10,0,0,0]=20；arch [15,10,15,0,10]=50；cont [0,0,10,10,0]=20；vis [0,0,0]=0 → 综合 21.0 · D
   - 14 条发现：技术 4（严重：裸域不可达+双入口未归一 / 严重：无 sitemap 无结构化数据 / 待优化：首页品牌页图片承载 / 亮点：准入宽松 404 规范）；页面 4（严重：全站同标题无 H1 无 canonical / 待优化：四层编号 URL / 待优化：文化六页近似重复无面包屑 / 亮点：产品体系完整导航真实链接）；内容 4（严重：决策问题零承接 / 严重：无日期无署名无栏目 / 严重：无深度资产 / 亮点：茶系成分原创叙事三段式结构）；可见度 2（严重：九次提问零引用 / 严重：对比词下同行官网已被引用）。正文与业务影响文案直接采用韩后报告原文
   - verdictJson 五段采用报告「综合结论」原文；directionsJson 采用「固本/立信/扩声/占位」四卡原文
   - 速览九格（2026-09-01 实测）：三平台 × 三类词全 L0 → 对应 9 条 measurements（isCheckpoint=false）
2. 项目「臻选保险集团（演示）」（domain demo-insure.example.cn，行业 保险，tier standard，stage D）：
   - 15 词锁定词池（品牌 5/通用 5/场景 5）+ 2 个可拓词 + 完整变更日志（创建→锁定→拓词）
   - 近 42 天 measurements：每词每平台每日 1 条，L2 概率从 ~26% 逐日线性爬升至 ~54%（用确定性伪随机 seed 生成），L1 另 ~20%，L2 记录带 citedUrl（8–10 个典型页：产品页/理赔指南/FAQ 等）；m6 考核节点标记在第 30 天
3. 报价单与排期表：为臻选保险各生成 1 份示例。

## 8. 前端契约

- 路由 12 页见 info.md §信息架构；全部页面数据来自 tRPC（禁前端硬编码业务数据）。
- 共享组件：Layout（左侧导航 + 顶栏）、Navbar、ScoreGauge、RadarChart、KpiCard、LevelBadge(L2/L1/L0)、GradeBadge(A-D)、SeverityBadge、EmptyState、PageHeader。
- 报告页 `/projects/:id/diagnosis/:dId/report`：视觉 1:1 还原韩后模板（Apple 风），打印友好（@media print）。
- 看板页图表用 ECharts（npm i echarts，按看板规划方案的线框：趋势双虚线 30%/50%、日历格子、平台分组柱、词类环图、TOP10 横条、矩阵热力）。
- 视觉基调：工作台用商务蓝白（#1a56db 体系），报告页用 Apple 浅灰体系；避免蓝紫渐变滥用与 Google 风。
- 中文文案为主；数字与 KPI 口径标注来源（如「L2 口径」）。
