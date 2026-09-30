/**
 * 维度四实测台（前后端共享 · 禁止依赖 api/）
 * 依据 references/ai-platform-test.md：
 * - 固定 3 平台（豆包 / DeepSeek / 通义千问）× 3 词类（决策词/场景词/对比词）= 9 问
 * - 判定标准：回答正文给出官网地址/链接，或引用来源列表包含官网页面；仅提及品牌不计
 * - 不测品牌词（考的是品牌知名度，与官网无关）
 * - 定档：每词类按命中平台数 3/3=20、2/3=15、1/3=10、0/3=0；
 *   词类未测满 3 平台 → 该项「待实测」（null，不许手工填分）
 */

import { PLATFORMS, type Platform } from "./kpi";
import { visLevelFromHits } from "./scoring";

/** 词类：决策词 / 场景词 / 对比词（与报告速览表三列一一对应） */
export const VIS_WORD_TYPES = ["decision", "scenario", "compare"] as const;
export type VisWordType = (typeof VIS_WORD_TYPES)[number];

/** 词类标签（速览表列头逐字固定，勿改） */
export const VIS_WORD_TYPE_LABELS: Record<VisWordType, string> = {
  decision: "决策词（品类推荐）",
  scenario: "场景词（采购场景）",
  compare: "对比词（品牌对比）",
};

/** 词类 → 维度四子指标键 */
export const VIS_INDICATOR_KEYS: Record<VisWordType, "vis_1" | "vis_2" | "vis_3"> = {
  decision: "vis_1",
  scenario: "vis_2",
  compare: "vis_3",
};

/** 单问实测留档结构（diagnostics.visTests json） */
export interface VisTest {
  platform: Platform;
  wordType: VisWordType;
  /** 提问原文（模板生成，可编辑） */
  question: string;
  /** 回答全文留档 */
  answer: string;
  /** 来源清单留档 */
  sources: string;
  /** 命中判定：true 官网被引用 / false 未引用 / null 待实测 */
  hit: boolean | null;
  /** 实测日期 YYYY-MM-DD（未实测为 null） */
  testedAt: string | null;
}

/** 三平台展示顺序（报告速览表行序：DeepSeek / 豆包 / 通义千问） */
export const VIS_PLATFORM_ORDER: Platform[] = ["deepseek", "doubao", "qwen"];

/** 词类问题模板：决策词 / 场景词 / 对比词（品类=行业，可编辑） */
export function questionTemplate(
  wordType: VisWordType,
  ctx: { category: string; brand: string; rival: string },
): string {
  const category = ctx.category.trim() || "品类";
  const brand = ctx.brand.trim() || "品牌";
  const rival = ctx.rival.trim() || "主要竞品";
  switch (wordType) {
    case "decision":
      return `${category}哪个牌子好？推荐几个品牌`;
    case "scenario":
      return `网上买${category}哪个平台靠谱？`;
    case "compare":
      return `${brand}和${rival}哪个好？`;
  }
}

/** 生成 9 问模板（3 平台 × 3 词类，hit/testedAt 待实测） */
export function buildVisTestTemplate(ctx: {
  category: string;
  brand: string;
  rival: string;
}): VisTest[] {
  const out: VisTest[] = [];
  for (const platform of VIS_PLATFORM_ORDER) {
    for (const wordType of VIS_WORD_TYPES) {
      out.push({
        platform,
        wordType,
        question: questionTemplate(wordType, ctx),
        answer: "",
        sources: "",
        hit: null,
        testedAt: null,
      });
    }
  }
  return out;
}

/** 词类 → 命中平台数（仅统计已判定 hit 的格子） */
function hitsForWordType(tests: VisTest[], wordType: VisWordType) {
  const cells = tests.filter((t) => t.wordType === wordType);
  const tested = cells.filter((t) => t.hit !== null);
  const hits = tested.filter((t) => t.hit === true).length;
  return { total: cells.length, tested: tested.length, hits };
}

export interface VisScoresResult {
  /** vis_1/2/3 定档分；词类未测满 3 平台时为 null（待实测） */
  scores: Record<"vis_1" | "vis_2" | "vis_3", number | null>;
  /** 每词类命中平台数（用于界面展示与证据文案） */
  detail: Record<VisWordType, { tested: number; hits: number }>;
  /** 9 问是否全部完成实测 */
  complete: boolean;
}

/**
 * 由 9 问留档自动定档：测满 3 平台才定档（3/3=20、2/3=15、1/3=10、0/3=0），
 * 否则该词类「待实测」返回 null。
 */
export function visScoresFromTests(tests: VisTest[]): VisScoresResult {
  const scores = { vis_1: null, vis_2: null, vis_3: null } as VisScoresResult["scores"];
  const detail = {} as VisScoresResult["detail"];
  let complete = true;
  for (const wordType of VIS_WORD_TYPES) {
    const { tested, hits } = hitsForWordType(tests, wordType);
    detail[wordType] = { tested, hits };
    const key = VIS_INDICATOR_KEYS[wordType];
    if (tested >= 3) {
      scores[key] = visLevelFromHits(hits);
    } else {
      scores[key] = null;
      complete = false;
    }
  }
  return { scores, detail, complete };
}

/** 平台在三平台中的展示名（统一口径：豆包、DeepSeek、通义千问） */
export { PLATFORMS };
