/**
 * 报价服务目录（前后端共享）
 * 依据 references/pricing.md（2026-09-04 用户定稿 + 2026-09-15 更正）：
 * - 周期套餐统一价：3 个月 30,000 / 6 个月 60,000 / 12 个月 120,000（含税）
 * - 考核口径：3 个月版「无指标考核，按交付物验收」；6 个月 ≥30%；12 个月 ≥50%
 * - 单项服务 A–D 四类标准价，名称已全部转写（禁出现 收录/SEO 等禁用词）
 */

/** 三档周期套餐 */
export interface PeriodPackage {
  /** 服务周期（月） */
  months: number;
  /** 套餐名：3个月版 / 6个月版 / 12个月版 */
  name: string;
  /** 套餐价（元，含税） */
  price: number;
  /** 考核口径文案（3 个月版为无指标考核） */
  kpi: string;
  /** 包含服务 */
  services: string[];
  /** 赠送 */
  gift: string;
  /** 适用场景 */
  scene: string;
}

export const PERIOD_PACKAGES: PeriodPackage[] = [
  {
    months: 3,
    name: "3个月版",
    price: 30000,
    kpi: "无指标考核，按交付物验收",
    services: ["技术诊断 1 次", "官网小幅度优化", "GEO内容优化与平台适配", "监测报告"],
    gift: "意图词监测 5 个 + 周/月数据报告",
    scene: "官网基础较好，想先短期验证 GEO 效果",
  },
  {
    months: 6,
    name: "6个月版",
    price: 60000,
    kpi: "官网引用率 ≥30%",
    services: ["技术诊断 1 次", "官网部分优化", "GEO内容优化与平台适配", "监测报告"],
    gift: "意图词监测 5 个 + 周/月数据报告",
    scene: "有一定基础但未系统优化的成长期官网",
  },
  {
    months: 12,
    name: "12个月版",
    price: 120000,
    kpi: "官网引用率 ≥50%",
    services: ["技术诊断 1 次", "官网整体改造优化", "GEO内容优化与平台适配", "监测报告"],
    gift: "意图词监测 5 个 + 周/月数据报告",
    scene: "零基础或基础薄弱，需系统改造并追求长期稳定引用",
  },
];

/** 按周期取套餐（非法周期返回 null） */
export function packageForMonths(months: number): PeriodPackage | null {
  return PERIOD_PACKAGES.find((p) => p.months === months) ?? null;
}

/** 单项服务目录行（A–D 类标准价；price 为含税价，unit 为计价单位） */
export interface SingleItem {
  group: "A" | "B" | "C" | "D";
  groupName: string;
  name: string;
  unit: string;
  /** 标准价（元）；面议项为 null */
  price: number | null;
  desc: string;
}

export const SINGLE_ITEMS: SingleItem[] = [
  // A 类 · 技术诊断与评估（打包 3,000 元）
  { group: "A", groupName: "技术诊断与评估", name: "官网技术底座诊断", unit: "次", price: 500, desc: "全面检测：页面速度、TDK 配置、H 标签结构、图片 ALT、nofollow、站点地图、AI Agent 访问策略等核心指标" },
  { group: "A", groupName: "技术诊断与评估", name: "AI平台可见性检测", unit: "平台", price: 500, desc: "检测官网在各 AI 平台（DeepSeek、豆包、通义千问、元宝等）的可见情况与表现" },
  { group: "A", groupName: "技术诊断与评估", name: "竞品 GEO 分析", unit: "个", price: 500, desc: "竞品官网在 AI 平台的表现、官网代码、架构与内容策略、意图词布局是否符合 GEO 策略" },
  { group: "A", groupName: "技术诊断与评估", name: "技术问题修复指导", unit: "次", price: 1500, desc: "技术修复方案文档，含优先级排序与实施建议" },
  // B 类 · 官网改造优化（打包 30,000 元）
  { group: "B", groupName: "官网改造优化", name: "官网页面 GEO 改造", unit: "30 个页面内", price: 10000, desc: "TDK 部署、URL 规范、面包屑导航、H 标签结构、图片 ALT、nofollow、站点地图、AI Agent 访问策略等核心指标" },
  { group: "B", groupName: "官网改造优化", name: "数据结构化标记", unit: "全站", price: 5000, desc: "Schema 标记、FAQ 标记等结构化数据，提升 AI 理解度" },
  { group: "B", groupName: "官网改造优化", name: "产品/服务页优化", unit: "10 个页面", price: 5000, desc: "产品详情页、解决方案页等现有页面的 GEO 格式优化" },
  { group: "B", groupName: "官网改造优化", name: "板块布局", unit: "页", price: 10000, desc: "新板块全方位布局：板块/列表/详情/标签页等模板的原型设计与布局规划" },
  // C 类 · GEO 内容优化（价格面议，按需报）
  { group: "C", groupName: "GEO 内容优化", name: "GEO 文章撰写", unit: "篇", price: null, desc: "基于 GEO 优化原则的长文创作，含意图词布局、结构优化、AI 友好格式，3,000–5,000 字" },
  { group: "C", groupName: "GEO 内容优化", name: "GEO 文章深度优化", unit: "篇", price: null, desc: "现有文章的 GEO 优化重构，提升 AI 平台理解度与引用表现" },
  { group: "C", groupName: "GEO 内容优化", name: "FAQ 内容创作", unit: "组", price: null, desc: "围绕核心意图词创作 FAQ 内容，适配 AI 问答场景" },
  { group: "C", groupName: "GEO 内容优化", name: "GEO 内容策划案", unit: "份", price: null, desc: "月度/季度内容选题规划，含意图词策略、内容框架、发布节奏" },
  // D 类 · 数据监测与报告（打包 1,000/月）
  { group: "D", groupName: "数据监测与报告", name: "AI平台可见性监测", unit: "月", price: 500, desc: "持续监测官网在各 AI 平台的可见页面数量变化" },
  { group: "D", groupName: "数据监测与报告", name: "官网内容引用量统计", unit: "月", price: 500, desc: "监测官网各内容在各平台的引用量数据" },
  { group: "D", groupName: "数据监测与报告", name: "周/月/季度数据报告", unit: "份", price: 0, desc: "周数据摘要 / 月度 GEO 效果分析（含环比）/ 季度策略报告" },
];

export interface QuoteItem {
  group: string;
  name: string;
  desc: string;
  unit: string;
  price: number;
  qty: number;
}

/** 周期套餐 → 报价明细首行（套餐作为主行，单项可追加） */
export function packageQuoteItem(months: number): QuoteItem {
  const pkg = packageForMonths(months);
  if (!pkg) throw new Error(`未知服务周期: ${months}`);
  return {
    group: "套餐",
    name: `官网 GEO 优化服务 · ${pkg.name}`,
    desc: `${pkg.services.join(" + ")}；赠送：${pkg.gift}；考核：${pkg.kpi}`,
    unit: `${pkg.months} 个月`,
    price: pkg.price,
    qty: 1,
  };
}

/** 报价单总价 = Σ price × qty，保留 2 位小数 */
export function computeQuoteTotal(items: QuoteItem[]): number {
  const total = items.reduce((acc, it) => acc + it.price * it.qty, 0);
  return Math.round(total * 100) / 100;
}

/** 付款方式（50/30/20，pricing.md 原文口径） */
export const PAYMENT_TERMS = [
  "首付 50%（合同签订后 3 个工作日内，启动项目）",
  "中期款 30%（服务满一个月后 5 个工作日内）",
  "尾款 20%（服务周期验收通过后 5 个工作日内结清）",
] as const;

/** 服务承诺（pricing.md 原文口径） */
export const SERVICE_PROMISES = [
  "工作时间 4 小时内响应（超时按比例退还服务费）；紧急 2 小时内响应（6 个月及以上周期，每月限 2 次）",
  "内容免费修改 2 次/篇，超出按单项收费",
  "技术问题 48 小时内给出方案（超时按天延长服务）",
  "按时提交数据报告（超时可申请延期 1 次）；服务变更提前 3 天书面通知，未经同意不得变更",
] as const;
