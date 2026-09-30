/**
 * 引用判定与 KPI 口径（前后端共享 · 禁止依赖 api/）
 * 依据 DESIGN_SPEC §2 与看板规划方案原文口径。
 */

export const PLATFORMS = ["deepseek", "doubao", "qwen"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  deepseek: "DeepSeek",
  doubao: "豆包",
  qwen: "通义千问",
};

export const KEYWORD_CATEGORIES = ["brand", "generic", "scenario"] as const;
export type KeywordCategory = (typeof KEYWORD_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<KeywordCategory, string> = {
  brand: "品牌类",
  generic: "通用类",
  scenario: "业务场景类",
};

/** 判定等级：L2 来源命中（计 KPI）/ L1 品牌提及（单列观察）/ L0 未命中 */
export const MEASURE_LEVELS = ["L2", "L1", "L0"] as const;
export type MeasureLevel = (typeof MEASURE_LEVELS)[number];

export const LEVEL_LABELS: Record<MeasureLevel, string> = {
  L2: "来源命中",
  L1: "品牌提及",
  L0: "未命中",
};

/** KPI 达成状态 */
export const KPI_STATUSES = ["achieved", "accepted", "below", "pending"] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  achieved: "达标",
  accepted: "验收合格",
  below: "未达标",
  pending: "未到节点",
};

/**
 * 服务周期口径（2026-09-15 用户定稿，取代旧「初级/中级/高级」档位 KPI）：
 * - 3 个月版：无指标考核，只按交付物清单验收 → 返回 null
 * - 6 个月版：官网引用率 ≥30%
 * - 12 个月版：官网引用率 ≥50%
 */
export const SERVICE_PERIODS = [3, 6, 12] as const;
export type ServiceMonths = (typeof SERVICE_PERIODS)[number];

/** 兼容旧代码的服务档类型（projects.serviceTier 字段保留但不再承担 KPI 目标） */
export type ServiceTier = "basic" | "standard" | "premium";

/** 服务周期 → KPI 目标（3 个月无考核返回 null） */
export function kpiTargetForMonths(serviceMonths: number): number | null {
  if (serviceMonths >= 12) return 50;
  if (serviceMonths >= 6) return 30;
  return null;
}

/** KPI 目标文案（考核区/看板/报价单共用） */
export function kpiTargetLabel(serviceMonths: number): string {
  const target = kpiTargetForMonths(serviceMonths);
  if (target === null) return "按交付物清单验收，无指标考核";
  return `官网引用率 ≥${target}%`;
}

/** 周期套餐名（3个月版 / 6个月版 / 12个月版） */
export function periodPackageName(serviceMonths: number): string {
  return `${serviceMonths}个月版`;
}

/** 考核节点：6 个月目标 30% / 12 个月目标 50%；验收线 = 目标 × 0.8（24% / 40%） */
export const CHECKPOINTS = {
  m6: { tag: "m6", label: "6个月考核节点", target: 30, acceptRate: 24 },
  m12: { tag: "m12", label: "12个月考核节点", target: 50, acceptRate: 40 },
} as const;
export type CheckpointTag = keyof typeof CHECKPOINTS;

/** 验收折扣口径：核心 KPI 达成率 ≥80% 即验收合格 */
export const ACCEPTANCE_FACTOR = 0.8;

/** 追踪参数黑名单（normalizeUrl 时剔除） */
const TRACKING_PARAMS = new Set([
  "spm",
  "from",
  "_t",
  "ref",
  "source",
  "timestamp",
  "fbclid",
  "gclid",
]);

/**
 * URL 归一：小写 host → 去 www./m. 前缀 → 去 query 追踪参数（utm_ 前缀、spm、from、_t 等）
 * → 去 fragment → 去默认文件名（index.html/index.htm/default.aspx）→ 去尾斜杠。
 * 解析失败时返回小写 trim 后的原文。
 */
export function normalizeUrl(raw: string): string {
  const input = raw.trim();
  if (!input) return "";
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return input.toLowerCase();
  }
  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  else if (host.startsWith("m.")) host = host.slice(2);

  const kept: [string, string][] = [];
  url.searchParams.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") || TRACKING_PARAMS.has(k)) return;
    kept.push([key, value]);
  });
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = kept
    .map(([k, v]) => (v ? `${k}=${v}` : k))
    .join("&");

  let path = url.pathname.replace(/\/(index\.html?|default\.aspx?)$/i, "");
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  if (path === "/") path = "";

  return `${host}${path}${query ? `?${query}` : ""}`;
}

/** 引用呈现率 = L2 记录数 ÷ 实测记录总数 × 100%（保留 1 位小数；总数 0 时返回 0） */
export function calcCitationRate(total: number, l2: number): number {
  if (total <= 0) return 0;
  return Math.round((l2 / total) * 1000) / 10;
}

/** 意向词覆盖率 = 期间至少 1 次 L2 的词数 ÷ 词池生效词数 × 100%（保留 1 位小数） */
export function calcCoverageRate(activeWords: number, hitWords: number): number {
  if (activeWords <= 0) return 0;
  return Math.round((hitWords / activeWords) * 1000) / 10;
}

/**
 * 考核达标判定：实测引用率 ≥ 目标 → achieved（达标）；
 * ≥ 目标 × 0.8 → accepted（验收合格）；否则 below（未达标）。
 */
export function judgeCheckpoint(measuredRate: number, target: number): KpiStatus {
  if (measuredRate >= target) return "achieved";
  if (measuredRate >= target * ACCEPTANCE_FACTOR) return "accepted";
  return "below";
}

/**
 * 按服务周期判定 KPI 达成状态。
 * 3 个月周期无指标考核 → 返回 null（调用方按「按交付物清单验收」呈现）；
 * 有考核周期（6/12 个月）按周期目标判定。
 */
export function judgePeriodKpi(
  measuredRate: number,
  serviceMonths: number,
): KpiStatus | null {
  const target = kpiTargetForMonths(serviceMonths);
  if (target === null) return null;
  return judgeCheckpoint(measuredRate, target);
}
