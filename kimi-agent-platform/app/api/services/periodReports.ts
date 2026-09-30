/**
 * 周期报告（周报/月报/季报）数据组装服务
 * 供 period-report.html.ts 三套模板与 reportsRouter.exportPeriodHtml 使用。
 * 口径与 reportsRouter.period 完全一致：引用呈现率 = L2 ÷ 实测总数（不含可拓词），
 * 可拓词单列观察、品牌提及（L1）仅作参考；缺数据的区块由模板层写「本期暂无数据」，不编数。
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { keywordPools, keywords, projects } from "@db/schema";
import {
  aggregateByPlatform,
  aggregateDaily,
  aggregateTopPages,
  computeKpiCards,
  queryMeasurements,
  type KpiCards,
  type MeasurementRow,
} from "./measurementStats";
import { computeCalendar } from "./collectionStats";
import {
  computeHeadToHead,
  computeSov,
  computeTopPages,
  listCompetitors,
} from "./competitorStats";
import { deliverablesStatus, type DeliverablesStatus } from "./deliverables";
import {
  calcCitationRate,
  kpiTargetForMonths,
  PLATFORM_LABELS,
  type KeywordCategory,
  type Platform,
} from "@contracts/kpi";

export type PeriodType = "week" | "month" | "quarter";

/* ------------------------------------------------------------------ 周期计算 */

/** 与 reportsRouter.periodRange 同逻辑：周=refDate 起近 7 天，月=自然月，季=自然季 */
export function periodRangeOf(type: PeriodType, refDate: string): { from: string; to: string } {
  const d = new Date(`${refDate}T00:00:00Z`);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  if (type === "week") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: fmt(start), to: fmt(d) };
  }
  if (type === "month") {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { from: fmt(start), to: fmt(end) };
  }
  const q = Math.floor(d.getUTCMonth() / 3);
  const start = new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0));
  return { from: fmt(start), to: fmt(end) };
}

/** 上一等长周期（环比基线） */
export function prevRangeOf(from: string, to: string): { from: string; to: string } {
  const days =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
      86_400_000 +
    1;
  const prevTo = new Date(`${from}T00:00:00Z`);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - days + 1);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

/* ------------------------------------------------------------------ 周期标签（日期粒度纪律） */

/** 周期标签：周「2026 年 9 月 · 第 2 周」/ 月「2026 年 9 月」/ 季「2026 年 Q3」（以周期末日定月与周序） */
export function periodLabel(type: PeriodType, to: string): string {
  const y = to.slice(0, 4);
  const m = Number(to.slice(5, 7));
  if (type === "week") {
    const weekNo = Math.ceil(Number(to.slice(8, 10)) / 7);
    return `${y} 年 ${m} 月 · 第 ${weekNo} 周`;
  }
  if (type === "month") return `${y} 年 ${m} 月`;
  return `${y} 年 Q${Math.floor((m - 1) / 3) + 1}`;
}

/* ------------------------------------------------------------------ 词级行 */

export interface PeriodWordRow {
  keywordId: number;
  text: string;
  category: KeywordCategory;
  /** 本期实测数（不含可拓词行不进入此列表） */
  total: number;
  l2: number;
  /** 品牌提及（L1）仅作参考列，不参与计分 */
  l1: number;
  /** 本期引用率 = l2/total */
  rate: number;
  /** 上周期引用率（上周期无实测为 null） */
  prevRate: number | null;
  /** 趋势箭头：↑↓→（上周期无实测为 null） */
  trend: "up" | "down" | "flat" | null;
  /** 三平台命中格：该平台本期有 L2 = true；有实测但无 L2 = false；无实测 = null */
  platformHits: Record<Platform, boolean | null>;
}

function buildWordRows(rows: MeasurementRow[], prevRows: MeasurementRow[]): PeriodWordRow[] {
  const kpiRows = rows.filter((r) => !r.isExtended && r.keywordStatus === "active");
  const prevKpi = prevRows.filter((r) => !r.isExtended && r.keywordStatus === "active");
  const prevByWord = new Map<number, MeasurementRow[]>();
  for (const r of prevKpi) {
    const arr = prevByWord.get(r.keywordId) ?? [];
    arr.push(r);
    prevByWord.set(r.keywordId, arr);
  }
  const map = new Map<number, MeasurementRow[]>();
  for (const r of kpiRows) {
    const arr = map.get(r.keywordId) ?? [];
    arr.push(r);
    map.set(r.keywordId, arr);
  }
  return [...map.entries()]
    .map(([keywordId, rs]) => {
      const l2 = rs.filter((r) => r.level === "L2").length;
      const rate = calcCitationRate(rs.length, l2);
      const prev = prevByWord.get(keywordId) ?? [];
      const prevL2 = prev.filter((r) => r.level === "L2").length;
      const prevRate = prev.length > 0 ? calcCitationRate(prev.length, prevL2) : null;
      const trend: PeriodWordRow["trend"] =
        prevRate === null ? null : rate > prevRate + 0.05 ? "up" : rate < prevRate - 0.05 ? "down" : "flat";
      const platformHits = {
        deepseek: null,
        doubao: null,
        qwen: null,
      } as Record<Platform, boolean | null>;
      for (const p of ["deepseek", "doubao", "qwen"] as const) {
        const cell = rs.filter((r) => r.platform === p);
        if (cell.length === 0) platformHits[p] = null;
        else platformHits[p] = cell.some((r) => r.level === "L2");
      }
      return {
        keywordId,
        text: rs[0]!.keywordText,
        category: rs[0]!.category,
        total: rs.length,
        l2,
        l1: rs.filter((r) => r.level === "L1").length,
        rate,
        prevRate,
        trend,
        platformHits,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}

/* ------------------------------------------------------------------ 采集健康（周报异常 / 月报完成率） */

export interface CollectionHealth {
  /** 期内计划采集天数 */
  plannedDays: number;
  /** 计划日中完成率 100% 的天数 */
  fullDays: number;
  /** 计划日平均完成率（无计划日为 null） */
  avgRate: number | null;
  /** 期内最长连续缺采天数（计划日完成率 <100%） */
  longestMissStreak: number;
  /** 期内有实测记录的天数 */
  activeDays: number;
}

async function collectionHealth(
  projectId: number,
  from: string,
  to: string,
  rows: MeasurementRow[],
): Promise<CollectionHealth> {
  const cal = await computeCalendar(projectId, from, to);
  const planned = cal.filter((c) => c.planned);
  let longest = 0;
  let cur = 0;
  for (const c of planned) {
    if (c.rate !== null && c.rate < 100) {
      cur += 1;
      longest = Math.max(longest, cur);
    } else {
      cur = 0;
    }
  }
  const rates = planned.filter((c) => c.rate !== null).map((c) => c.rate!);
  return {
    plannedDays: planned.length,
    fullDays: planned.filter((c) => c.rate === 100).length,
    avgRate: rates.length
      ? Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 10) / 10
      : null,
    longestMissStreak: longest,
    activeDays: new Set(rows.map((r) => r.measureDate)).size,
  };
}

/* ------------------------------------------------------------------ 异常与预警（周报 04） */

function buildAlerts(args: {
  daily: { date: string; rate: number; total: number }[];
  byPlatform: { platform: Platform; label: string; total: number; rate: number; prevRate: number | null }[];
  health: CollectionHealth;
  delta: number;
}): string[] {
  const alerts: string[] = [];
  const { daily, byPlatform, health, delta } = args;
  // ① 连续缺采
  if (health.longestMissStreak >= 2) {
    alerts.push(`期内出现连续 ${health.longestMissStreak} 天采集未满格，请优先补齐采集排班，避免趋势断档。`);
  }
  if (health.plannedDays > 0 && health.activeDays === 0) {
    alerts.push("本周期内无任何实测记录，数据链路疑似中断，请立即核查采集任务。");
  }
  // ② 引用率骤降：环比 ≤ -10pt，或相邻两日跌幅 ≥ 15pt
  if (delta <= -10) {
    alerts.push(`本期引用呈现率环比 ${delta.toFixed(1)}pt，降幅较大，建议逐词回查命中明细定位下滑词。`);
  }
  for (let i = 1; i < daily.length; i++) {
    const drop = daily[i]!.rate - daily[i - 1]!.rate;
    if (daily[i - 1]!.total > 0 && daily[i]!.total > 0 && drop <= -15) {
      alerts.push(
        `${daily[i]!.date} 引用率较前一实测日下降 ${Math.abs(Math.round(drop * 10) / 10)}pt，建议复核当日各平台判定。`,
      );
      break; // 只报最早一次骤降
    }
  }
  // ③ 平台异常：某平台整期无实测，或环比跌幅 ≥ 15pt
  const totalAll = byPlatform.reduce((s, p) => s + p.total, 0);
  for (const p of byPlatform) {
    if (totalAll > 0 && p.total === 0) {
      alerts.push(`${p.label} 本期无实测记录，请核查该平台采集任务是否正常。`);
    } else if (p.prevRate !== null && p.rate - p.prevRate <= -15) {
      alerts.push(`${p.label} 引用率环比 ${(p.rate - p.prevRate).toFixed(1)}pt，平台侧波动需关注。`);
    }
  }
  return alerts;
}

/* ------------------------------------------------------------------ 竞对区块 */

export interface CompeteBlock {
  sov: Awaited<ReturnType<typeof computeSov>>;
  /** 本期失守词（竞对率 > 我方率） */
  losingWords: { text: string; category: KeywordCategory; ownRate: number; rivalName: string; rivalRate: number }[];
  /** 收复词（上周期失守、本期不再失守）——仅季报使用 */
  regainedWords: { text: string; category: KeywordCategory; ownRate: number }[];
  rivalTopPages: { competitorName: string; url: string; count: number }[];
  /** 我方声量份额环比变化（pt；上季度无竞对数据为 null）——仅季报使用 */
  ownShareDelta: number | null;
}

async function buildCompeteBlock(
  projectId: number,
  range: { from: string; to: string },
  prevRange: { from: string; to: string } | null,
): Promise<CompeteBlock | null> {
  const comps = await listCompetitors(projectId);
  if (!comps.some((c) => c.recordCount > 0)) return null;
  const [sov, h2h] = await Promise.all([
    computeSov({ projectId, ...range }),
    computeHeadToHead({ projectId, ...range }),
  ]);
  const nameOf = (id: number) => comps.find((c) => c.id === id)?.name ?? "";
  // 失守词：任一竞对率 > 我方率，按差距降序取前 10
  const losing: (CompeteBlock["losingWords"][number] & { gap: number })[] = [];
  const losingWordIds = new Set<number>();
  for (const row of h2h) {
    if (row.own.rate === null) continue;
    for (const rival of row.rivals) {
      if (rival.rate !== null && rival.rate > row.own.rate) {
        losing.push({
          text: row.text,
          category: row.category,
          ownRate: row.own.rate,
          rivalName: nameOf(rival.competitorId),
          rivalRate: rival.rate,
          gap: rival.rate - row.own.rate,
        });
        losingWordIds.add(row.keywordId);
      }
    }
  }
  losing.sort((a, b) => b.gap - a.gap);

  // 收复词与 SOV 环比：需要上周期竞对数据
  let regainedWords: CompeteBlock["regainedWords"] = [];
  let ownShareDelta: number | null = null;
  if (prevRange) {
    const [prevSov, prevH2h] = await Promise.all([
      computeSov({ projectId, ...prevRange }),
      computeHeadToHead({ projectId, ...prevRange }),
    ]);
    const prevLosingIds = new Set<number>();
    for (const row of prevH2h) {
      if (row.own.rate === null) continue;
      if (row.rivals.some((r) => r.rate !== null && r.rate > row.own.rate!)) {
        prevLosingIds.add(row.keywordId);
      }
    }
    const curById = new Map(h2h.map((r) => [r.keywordId, r]));
    regainedWords = [...prevLosingIds]
      .filter((id) => !losingWordIds.has(id))
      .map((id) => {
        const row = curById.get(id);
        return {
          text: row?.text ?? prevH2h.find((r) => r.keywordId === id)?.text ?? "",
          category: (row?.category ?? prevH2h.find((r) => r.keywordId === id)?.category ?? "generic") as KeywordCategory,
          ownRate: row?.own.rate ?? 0,
        };
      })
      .filter((w) => w.text !== "");
    const ownNow = sov.find((s) => s.brandKey === "own")?.share ?? 0;
    const ownPrev = prevSov.find((s) => s.brandKey === "own");
    ownShareDelta = ownPrev && ownPrev.l2 + ownPrev.l1 > 0
      ? Math.round((ownNow - ownPrev.share) * 10) / 10
      : null;
  }

  // 竞对被引页面 TOP（全部竞对合并）
  const perCompPages = await Promise.all(
    comps.map(async (c) =>
      (await computeTopPages({ projectId, ...range, competitorId: c.id })).map((p) => ({
        competitorName: c.name,
        url: p.url,
        count: p.count,
      })),
    ),
  );
  return {
    sov,
    losingWords: losing.slice(0, 10).map(({ gap: _gap, ...rest }) => rest),
    regainedWords,
    rivalTopPages: perCompPages.flat().sort((a, b) => b.count - a.count).slice(0, 10),
    ownShareDelta,
  };
}

/* ------------------------------------------------------------------ 建议生成（主语永远是官网） */

function buildSuggestions(args: {
  type: PeriodType;
  words: PeriodWordRow[];
  byPlatform: { platform: Platform; label: string; total: number; rate: number }[];
  kpi: KpiCards;
  serviceMonths: number;
}): string[] {
  const { type, words, byPlatform, kpi, serviceMonths } = args;
  const out: string[] = [];
  const blanks = words.filter((w) => w.l2 === 0);
  const nextLabel = type === "week" ? "下周" : type === "month" ? "下月" : "下季度";
  if (blanks.length > 0) {
    out.push(
      `官网在本期 ${blanks.length} 个词上零引用（${blanks
        .slice(0, 5)
        .map((b) => `「${b.text}」`)
        .join("、")}${blanks.length > 5 ? " 等" : ""}），建议${nextLabel}围绕这些词补齐官网对应内容。`,
    );
  }
  const withData = byPlatform.filter((p) => p.total > 0);
  const weakest = [...withData].sort((a, b) => a.rate - b.rate)[0];
  const strongest = [...withData].sort((a, b) => b.rate - a.rate)[0];
  if (weakest && strongest && weakest.platform !== strongest.platform && weakest.rate < strongest.rate) {
    out.push(
      `官网在 ${weakest.label} 的引用率 ${weakest.rate}% 低于 ${strongest.label} ${strongest.rate}%，建议${nextLabel}优先面向该平台补强短板词类内容。`,
    );
  }
  const target = kpiTargetForMonths(serviceMonths);
  if (target === null) {
    out.push("本项目为 3 个月服务周期，按交付物清单验收、无指标考核；建议保持官网内容产出与监测节奏。");
  } else if (kpi.citationRate < target) {
    out.push(
      `官网引用呈现率 ${kpi.citationRate}% 低于考核目标 ${target}%（验收线 ${Math.round(target * 0.8)}%），建议${nextLabel}加快官网 FAQ 与深度内容产出节奏。`,
    );
  } else {
    out.push(`官网引用呈现率 ${kpi.citationRate}% 已达考核目标 ${target}%，建议保持现有官网内容产出与监测节奏。`);
  }
  return out.slice(0, 4);
}

/* ------------------------------------------------------------------ 主装配 */

export interface PeriodReportData {
  type: PeriodType;
  project: {
    id: number;
    name: string;
    company: string;
    domain: string;
    industry: string;
    serviceMonths: number;
    startDate: string | null;
    owner: string | null;
  };
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** 周期标签（周「2026 年 9 月 · 第 2 周」/ 月「2026 年 9 月」/ 季「2026 年 Q3」） */
  label: string;
  /** 编制日期（精确到月） */
  compiledMonth: string;
  pool: { active: number; extended: number };
  kpi: KpiCards & { prevRate: number; prevTotal: number; prevL2: number; delta: number };
  /** 逐日聚合（仅计划内有实测的日期） */
  daily: { date: string; rate: number; total: number; l2: number }[];
  byPlatform: { platform: Platform; label: string; total: number; l2: number; rate: number; prevRate: number | null }[];
  words: PeriodWordRow[];
  /** 可拓词观察（不计 KPI 分母） */
  extendedWords: { text: string; category: KeywordCategory; total: number; l2: number; rate: number }[];
  /** 月报：周均值柱 */
  weeklyAvg: { label: string; rate: number }[];
  /** 季报：季度内逐月聚合 */
  monthly: { label: string; monthKey: string; rate: number; total: number; l2: number; delta: number | null }[];
  health: CollectionHealth;
  alerts: string[];
  suggestions: string[];
  topPages: { url: string; title: string | null; count: number; share: number }[];
  compete: CompeteBlock | null;
  /** 季报：服务周期进度（第 N 月 / 共 M 月）与是否周期末季 */
  service: { monthIndex: number; totalMonths: number; isFinalQuarter: boolean };
  /** 交付物验收清单（3 个月周期季报 01 节与验收对齐用） */
  deliverables: DeliverablesStatus | null;
  /** 达标词数（KPI 口径，有考核目标时有效） */
  targetMetWords: number | null;
}

/** 组装周期报告数据；项目不存在返回 null */
export async function assemblePeriodReport(
  projectId: number,
  type: PeriodType,
  refDate: string,
): Promise<PeriodReportData | null> {
  const db = getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return null;

  const range = periodRangeOf(type, refDate);
  const prev = prevRangeOf(range.from, range.to);
  const [rows, prevRows, [pool]] = await Promise.all([
    queryMeasurements({ projectId, ...range }),
    queryMeasurements({ projectId, ...prev }),
    db
      .select()
      .from(keywordPools)
      .where(eq(keywordPools.projectId, projectId))
      .orderBy(desc(keywordPools.id))
      .limit(1),
  ]);
  const serviceMonths = p.serviceMonths ?? 12;
  const [cards, prevCards, health] = await Promise.all([
    computeKpiCards(rows, serviceMonths, range),
    computeKpiCards(prevRows, serviceMonths, prev),
    collectionHealth(projectId, range.from, range.to, rows),
  ]);

  // 词池规模（生效词 / 可拓词）
  let poolActive = 0;
  let poolExtended = 0;
  if (pool) {
    const ws = await db.select().from(keywords).where(eq(keywords.poolId, pool.id));
    poolActive = ws.filter((w) => w.status === "active" && !w.isExtended).length;
    poolExtended = ws.filter((w) => w.isExtended && w.status === "active").length;
  }

  // 平台对比（含上周期率）
  const prevPlat = aggregateByPlatform(prevRows);
  const byPlatform = aggregateByPlatform(rows).map((pl) => ({
    ...pl,
    label: PLATFORM_LABELS[pl.platform],
    prevRate: prevPlat.find((x) => x.platform === pl.platform)?.rate ?? null,
  }));

  const words = buildWordRows(rows, prevRows);
  // 可拓词观察
  const extRows = rows.filter((r) => r.isExtended);
  const extMap = new Map<number, MeasurementRow[]>();
  for (const r of extRows) {
    const arr = extMap.get(r.keywordId) ?? [];
    arr.push(r);
    extMap.set(r.keywordId, arr);
  }
  const extendedWords = [...extMap.entries()].map(([, rs]) => {
    const l2 = rs.filter((r) => r.level === "L2").length;
    return {
      text: rs[0]!.keywordText,
      category: rs[0]!.category,
      total: rs.length,
      l2,
      rate: calcCitationRate(rs.length, l2),
    };
  });

  const daily = aggregateDaily(rows).map((d) => ({ date: d.date, rate: d.rate, total: d.total, l2: d.l2 }));

  // 月报：按 ISO 周（周一至周日）求周均值柱
  const weeklyAvg: PeriodReportData["weeklyAvg"] = [];
  if (type === "month") {
    const weekBuckets = new Map<string, { total: number; l2: number }>();
    for (const d of daily) {
      const dt = new Date(`${d.date}T00:00:00Z`);
      const day = dt.getUTCDay() || 7; // 周一=1
      const monday = new Date(dt);
      monday.setUTCDate(monday.getUTCDate() - (day - 1));
      const key = monday.toISOString().slice(0, 10);
      const cur = weekBuckets.get(key) ?? { total: 0, l2: 0 };
      cur.total += d.total;
      cur.l2 += d.l2;
      weekBuckets.set(key, cur);
    }
    let i = 0;
    for (const [, v] of [...weekBuckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      i += 1;
      weeklyAvg.push({ label: `第 ${i} 周`, rate: calcCitationRate(v.total, v.l2) });
    }
  }

  // 季报：季度内逐月聚合 + 环比
  const monthly: PeriodReportData["monthly"] = [];
  if (type === "quarter") {
    const startM = Number(range.from.slice(5, 7));
    const y = range.from.slice(0, 4);
    for (let i = 0; i < 3; i++) {
      const m = startM + i;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const mRows = rows.filter((r) => !r.isExtended && r.measureDate.startsWith(key));
      const l2 = mRows.filter((r) => r.level === "L2").length;
      const rate = calcCitationRate(mRows.length, l2);
      const prevM = monthly[i - 1];
      monthly.push({
        label: `${m} 月`,
        monthKey: key,
        rate,
        total: mRows.length,
        l2,
        delta: prevM && prevM.total > 0 && mRows.length > 0
          ? Math.round((rate - prevM.rate) * 10) / 10
          : null,
      });
    }
  }

  const target = kpiTargetForMonths(serviceMonths);
  const targetMetWords = target === null ? null : words.filter((w) => w.rate >= target).length;

  // 竞对区块（季报带上季度对照）
  const compete = await buildCompeteBlock(projectId, range, type === "quarter" ? prev : null);

  // 服务周期进度：以季度末月相对启动月计算第 N 月 / 共 M 月
  let monthIndex = 1;
  if (p.startDate) {
    const [sy, sm] = p.startDate.split("-").map(Number);
    const [ey, em] = range.to.split("-").map(Number);
    monthIndex = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
  }
  const service = {
    monthIndex: Math.min(monthIndex, serviceMonths),
    totalMonths: serviceMonths,
    isFinalQuarter: monthIndex >= serviceMonths,
  };

  const deliverables = target === null || service.isFinalQuarter ? await deliverablesStatus(projectId) : null;

  return {
    type,
    project: {
      id: p.id,
      name: p.name,
      company: p.company,
      domain: p.domain,
      industry: p.industry,
      serviceMonths,
      startDate: p.startDate,
      owner: p.owner,
    },
    from: range.from,
    to: range.to,
    prevFrom: prev.from,
    prevTo: prev.to,
    label: periodLabel(type, range.to),
    compiledMonth: `${new Date().toISOString().slice(0, 4)} 年 ${Number(new Date().toISOString().slice(5, 7))} 月`,
    pool: { active: poolActive, extended: poolExtended },
    kpi: {
      ...cards,
      prevRate: prevCards.citationRate,
      prevTotal: prevCards.total,
      prevL2: prevCards.l2,
      delta: Math.round((cards.citationRate - prevCards.citationRate) * 10) / 10,
    },
    daily,
    byPlatform,
    words,
    extendedWords,
    weeklyAvg,
    monthly,
    health,
    alerts: buildAlerts({ daily, byPlatform, health, delta: Math.round((cards.citationRate - prevCards.citationRate) * 10) / 10 }),
    suggestions: buildSuggestions({ type, words, byPlatform, kpi: cards, serviceMonths }),
    topPages: aggregateTopPages(rows, 10),
    compete,
    service,
    deliverables,
    targetMetWords,
  };
}
