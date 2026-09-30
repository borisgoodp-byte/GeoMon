import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { createRouter, authedProcedure, staffProcedure, assertProjectAccess } from "./middleware";
import { getDb } from "./queries/connection";
import {
  projects,
  diagnostics,
  indicatorScores,
  findings,
  crawlResults,
  keywords,
  measurements,
} from "@db/schema";
import {
  INDICATORS,
  computeDimensionScore,
  computeComposite,
  computeGrade,
  isAllowedScore,
  visLevelFromHits,
} from "@contracts/scoring";
import {
  VIS_WORD_TYPES,
  VIS_INDICATOR_KEYS,
  VIS_WORD_TYPE_LABELS,
  visScoresFromTests,
  type VisTest,
} from "@contracts/vistest";
import { findBanned } from "@contracts/bannedWords";
import {
  aggregateNineGrid,
  queryMeasurements,
} from "./services/measurementStats";
import type { VerdictJson, DirectionCard } from "@contracts/types";

/** 维度四 单项 → 词类映射：vis_1 决策词→通用类 / vis_2 场景词→业务场景类 / vis_3 对比词→品牌类 */
const VIS_CATEGORY_MAP = {
  vis_1: "generic",
  vis_2: "scenario",
  vis_3: "brand",
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

function serializeDiagnostic(d: typeof diagnostics.$inferSelect) {
  return {
    ...d,
    techScore: num(d.techScore),
    archScore: num(d.archScore),
    contentScore: num(d.contentScore),
    visScore: num(d.visScore),
    compositeScore: num(d.compositeScore),
  };
}

/** 近 30 天（以项目最近一次实测日为锚）各词类命中平台数 → vis_1-3 定档 */
async function computeVisScores(projectId: number) {
  const db = getDb();
  const [latest] = await db
    .select({ d: measurements.measureDate })
    .from(measurements)
    .where(eq(measurements.projectId, projectId))
    .orderBy(desc(measurements.measureDate))
    .limit(1);
  const result: Record<string, { score: number; evidence: string }> = {};
  for (const key of Object.keys(VIS_CATEGORY_MAP)) {
    result[key] = { score: 0, evidence: "待实测：近 30 天无实测记录" };
  }
  if (!latest) return result;

  const anchor = new Date(`${latest.d}T00:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - 29);
  const from = anchor.toISOString().slice(0, 10);

  const rows = await db
    .select({
      platform: measurements.platform,
      category: keywords.category,
    })
    .from(measurements)
    .innerJoin(keywords, eq(measurements.keywordId, keywords.id))
    .where(
      and(
        eq(measurements.projectId, projectId),
        eq(measurements.level, "L2"),
        gte(measurements.measureDate, from),
      ),
    );

  for (const [key, category] of Object.entries(VIS_CATEGORY_MAP)) {
    const platforms = new Set(
      rows.filter((r) => r.category === category).map((r) => r.platform),
    );
    const hits = platforms.size;
    result[key] = {
      score: visLevelFromHits(hits),
      evidence:
        hits === 0
          ? `近 30 天（${from} ~ ${latest.d}）该类词在三平台均无 L2 命中`
          : `近 30 天（${from} ~ ${latest.d}）该类词命中平台数 ${hits}/3：${[...platforms].join("、")}`,
    };
  }
  return result;
}

/**
 * 维度四定档：优先取诊断单 visTests 留档（9 问实测），
 * 无留档时退回近 30 天 measurements 命中平台数口径。
 * 返回 { visKey: { score: number|null, evidence: string } }。
 */
async function resolveVisScores(d: { id: number; projectId: number; visTests: VisTest[] | null }) {
  if (d.visTests && d.visTests.length > 0) {
    const { scores, detail } = visScoresFromTests(d.visTests);
    const result: Record<string, { score: number | null; evidence: string }> = {};
    for (const wt of VIS_WORD_TYPES) {
      const key = VIS_INDICATOR_KEYS[wt];
      const det = detail[wt];
      result[key] =
        scores[key] === null
          ? { score: null, evidence: `待实测：${VIS_WORD_TYPE_LABELS[wt]}未测满 3 平台（已实测 ${det.tested}/3）` }
          : {
              score: scores[key],
              evidence: `9 问实测留档：${VIS_WORD_TYPE_LABELS[wt]}命中平台数 ${det.hits}/3，定档 ${scores[key]} 分`,
            };
    }
    return result;
  }
  const legacy = await computeVisScores(d.projectId);
  const result: Record<string, { score: number | null; evidence: string }> = {};
  for (const [k, v] of Object.entries(legacy)) result[k] = { score: v.score, evidence: v.evidence };
  return result;
}

/** 按最新评分行重算维度分/综合分/等级并写回 diagnostics */
async function recomputeAndPersist(diagnosticId: number, prevStatus: string) {
  const db = getDb();
  const finalRows = await db
    .select()
    .from(indicatorScores)
    .where(eq(indicatorScores.diagnosticId, diagnosticId));
  const scoreMap: Record<string, number> = {};
  for (const r of finalRows) scoreMap[r.indicatorKey] = r.score ?? 0;
  const dims = computeDimensionScore(scoreMap);
  const composite = computeComposite(dims);
  const grade = computeGrade(composite);
  await db
    .update(diagnostics)
    .set({
      techScore: String(dims.tech),
      archScore: String(dims.arch),
      contentScore: String(dims.content),
      visScore: String(dims.vis),
      compositeScore: String(composite),
      grade,
      status: prevStatus === "completed" ? "completed" : "scoring",
    })
    .where(eq(diagnostics.id, diagnosticId));
  return { dims, composite, grade, finalRows };
}

export const diagnosticsRouter = createRouter({
  listByProject: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const rows = await getDb()
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.projectId, input.projectId))
        .orderBy(desc(diagnostics.id));
      return rows.map(serializeDiagnostic);
    }),

  get: authedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [d] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.id))
        .limit(1);
      if (!d) return null;
      assertProjectAccess(ctx, d.projectId);
      const [scores, findingRows, crawls] = await Promise.all([
        db
          .select()
          .from(indicatorScores)
          .where(eq(indicatorScores.diagnosticId, d.id)),
        db
          .select()
          .from(findings)
          .where(eq(findings.diagnosticId, d.id))
          .orderBy(findings.sortOrder),
        db
          .select()
          .from(crawlResults)
          .where(eq(crawlResults.diagnosticId, d.id))
          .orderBy(desc(crawlResults.id)),
      ]);
      return {
        ...serializeDiagnostic(d),
        indicators: INDICATORS.map((def) => ({
          ...def,
          scoreRow: scores.find((s) => s.indicatorKey === def.key) ?? null,
        })),
        findings: findingRows,
        crawlResults: crawls,
      };
    }),

  create: staffProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        diagnoseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [p] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!p)
        throw new TRPCError({ code: "NOT_FOUND", message: `项目不存在: ${input.projectId}` });
      const [{ id }] = await db
        .insert(diagnostics)
        .values({
          projectId: input.projectId,
          diagnoseDate: input.diagnoseDate ?? today(),
          status: "crawling",
        })
        .$returningId();
      // 预置 18 行空评分，供抓取器写入 autoScore、人工评分 upsert
      await db.insert(indicatorScores).values(
        INDICATORS.map((def) => ({
          diagnosticId: id,
          indicatorKey: def.key,
          dimension: def.dimension,
        })),
      );
      const [d] = await db.select().from(diagnostics).where(eq(diagnostics.id, id));
      return serializeDiagnostic(d!);
    }),

  /**
   * 保存人工评分：upsert 18 行（vis_1-3 由近 30 天实测命中平台数自动定档），
   * 重算维度分/综合分/等级写回 diagnostics。
   */
  saveScores: staffProcedure
    .input(
      z.object({
        diagnosticId: z.number().int().positive(),
        scores: z.array(
          z.object({
            indicatorKey: z.string().min(1),
            score: z.number().int(),
            evidence: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [d] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.diagnosticId))
        .limit(1);
      if (!d)
        throw new TRPCError({ code: "NOT_FOUND", message: `诊断单不存在: ${input.diagnosticId}` });

      // 四档分校验
      const invalid = input.scores.filter((s) => !isAllowedScore(s.score));
      if (invalid.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `非法分值（只允许 0/10/15/20）：${invalid.map((s) => `${s.indicatorKey}=${s.score}`).join(", ")}`,
        });
      }
      const unknown = input.scores.filter(
        (s) => !INDICATORS.some((def) => def.key === s.indicatorKey),
      );
      if (unknown.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `未知指标：${unknown.map((s) => s.indicatorKey).join(", ")}`,
        });
      }

      const existing = await db
        .select()
        .from(indicatorScores)
        .where(eq(indicatorScores.diagnosticId, input.diagnosticId));
      const inputMap = new Map(input.scores.map((s) => [s.indicatorKey, s]));
      // 维度四优先取 visTests 留档定档，无留档退回近 30 天 measurements 口径
      const visScores = await resolveVisScores(d);

      for (const def of INDICATORS) {
        const isVis = def.dimension === 4;
        const provided = inputMap.get(def.key);
        const prev = existing.find((r) => r.indicatorKey === def.key);
        const score = isVis
          ? visScores[def.key]!.score
          : (provided?.score ?? prev?.score ?? null);
        const evidence = isVis
          ? visScores[def.key]!.evidence
          : (provided?.evidence ?? prev?.evidence ?? null);
        await db
          .insert(indicatorScores)
          .values({
            diagnosticId: input.diagnosticId,
            indicatorKey: def.key,
            dimension: def.dimension,
            score,
            evidence,
          })
          .onDuplicateKeyUpdate({ set: { score, evidence } });
      }

      const { finalRows } = await recomputeAndPersist(input.diagnosticId, d.status);

      const [updated] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.diagnosticId));
      return { diagnostic: serializeDiagnostic(updated!), scores: finalRows };
    }),

  /**
   * 保存维度四 9 问实测留档：
   * 留档 → 自动定档 vis_1/2/3（测满 3 平台才定档，否则待实测 null）→
   * 重算综合分写回 → 禁用词警示（命中词列表随响应返回）。
   */
  saveVisTests: staffProcedure
    .input(
      z.object({
        diagnosticId: z.number().int().positive(),
        tests: z
          .array(
            z.object({
              platform: z.enum(["deepseek", "doubao", "qwen"]),
              wordType: z.enum(["decision", "scenario", "compare"]),
              question: z.string().min(1),
              answer: z.string().default(""),
              sources: z.string().default(""),
              hit: z.boolean().nullable(),
              testedAt: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .nullable(),
            }),
          )
          .length(9, "实测留档必须为 9 问（3 平台 × 3 词类）"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [d] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.diagnosticId))
        .limit(1);
      if (!d)
        throw new TRPCError({ code: "NOT_FOUND", message: `诊断单不存在: ${input.diagnosticId}` });

      // 1) 留档写入 visTests
      const tests = input.tests as VisTest[];
      await db
        .update(diagnostics)
        .set({ visTests: tests })
        .where(eq(diagnostics.id, input.diagnosticId));

      // 2) 自动定档 vis_1/2/3 并写入评分行
      const { scores: visScores, detail, complete } = visScoresFromTests(tests);
      for (const wt of VIS_WORD_TYPES) {
        const key = VIS_INDICATOR_KEYS[wt];
        const score = visScores[key];
        const det = detail[wt];
        const evidence =
          score === null
            ? `待实测：${VIS_WORD_TYPE_LABELS[wt]}未测满 3 平台（已实测 ${det.tested}/3）`
            : `9 问实测留档：${VIS_WORD_TYPE_LABELS[wt]}命中平台数 ${det.hits}/3，定档 ${score} 分`;
        await db
          .insert(indicatorScores)
          .values({
            diagnosticId: input.diagnosticId,
            indicatorKey: key,
            dimension: 4,
            score,
            evidence,
          })
          .onDuplicateKeyUpdate({ set: { score, evidence } });
      }

      // 3) 重算综合分（维度四 = 三项和 ÷ 60 × 100）
      const { composite, grade } = await recomputeAndPersist(input.diagnosticId, d.status);

      // 4) 禁用词警示（问题/回答/来源全文扫描）
      const banned = [
        ...new Set(
          tests.flatMap((t) => findBanned(`${t.question}\n${t.answer}\n${t.sources}`)),
        ),
      ];

      const [updated] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.diagnosticId));
      return {
        diagnostic: serializeDiagnostic(updated!),
        visScores,
        detail,
        complete,
        composite,
        grade,
        banned,
      };
    }),

  /** 整体替换发现列表 */
  saveFindings: staffProcedure
    .input(
      z.object({
        diagnosticId: z.number().int().positive(),
        findings: z.array(
          z.object({
            dimension: z.number().int().min(1).max(4),
            severity: z.enum(["danger", "warn", "ok"]),
            title: z.string().min(1),
            body: z.string(),
            impact: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .delete(findings)
        .where(eq(findings.diagnosticId, input.diagnosticId));
      if (input.findings.length > 0) {
        await db.insert(findings).values(
          input.findings.map((f, i) => ({
            ...f,
            diagnosticId: input.diagnosticId,
            sortOrder: i,
          })),
        );
      }
      return db
        .select()
        .from(findings)
        .where(eq(findings.diagnosticId, input.diagnosticId))
        .orderBy(findings.sortOrder);
    }),

  saveVerdict: staffProcedure
    .input(
      z.object({
        diagnosticId: z.number().int().positive(),
        verdictJson: z.object({
          tech: z.string(),
          pages: z.string(),
          content: z.string(),
          visibility: z.string(),
          core: z.string(),
        }) satisfies z.ZodType<VerdictJson>,
        directionsJson: z.array(
          z.object({
            step: z.number().int(),
            title: z.string(),
            items: z.array(z.string()),
          }),
        ) satisfies z.ZodType<DirectionCard[]>,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(diagnostics)
        .set({
          verdictJson: input.verdictJson,
          directionsJson: input.directionsJson,
        })
        .where(eq(diagnostics.id, input.diagnosticId));
      const [d] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.diagnosticId));
      return serializeDiagnostic(d!);
    }),

  complete: staffProcedure
    .input(z.object({ diagnosticId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [d] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.diagnosticId))
        .limit(1);
      if (!d)
        throw new TRPCError({ code: "NOT_FOUND", message: `诊断单不存在: ${input.diagnosticId}` });
      if (d.compositeScore === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "尚未完成评分，无法结单（请先 saveScores）",
        });
      }
      await db
        .update(diagnostics)
        .set({ status: "completed" })
        .where(eq(diagnostics.id, input.diagnosticId));
      return { ok: true };
    }),

  /** 报告页聚合：项目 + 分数 + 发现 + 速览九格 + 结论 + 方向 */
  reportData: authedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const [d] = await db
        .select()
        .from(diagnostics)
        .where(eq(diagnostics.id, input.id))
        .limit(1);
      if (!d) return null;
      assertProjectAccess(ctx, d.projectId);
      const [p] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, d.projectId))
        .limit(1);

      const [scoreRows, findingRows, crawlRows] = await Promise.all([
        db
          .select()
          .from(indicatorScores)
          .where(eq(indicatorScores.diagnosticId, d.id)),
        db
          .select()
          .from(findings)
          .where(eq(findings.diagnosticId, d.id))
          .orderBy(findings.sortOrder),
        db
          .select()
          .from(crawlResults)
          .where(eq(crawlResults.diagnosticId, d.id))
          .orderBy(desc(crawlResults.id))
          .limit(1),
      ]);

      // 速览九格：项目最近一轮 measurements（最新 measureDate）按 平台×词类 聚合 L2 命中
      const [latest] = await db
        .select({ d: measurements.measureDate })
        .from(measurements)
        .where(eq(measurements.projectId, d.projectId))
        .orderBy(desc(measurements.measureDate))
        .limit(1);
      let nineGrid: ReturnType<typeof aggregateNineGrid> = [];
      let nineGridDate: string | null = null;
      if (latest) {
        nineGridDate = latest.d;
        const rows = await queryMeasurements({
          projectId: d.projectId,
          from: latest.d,
          to: latest.d,
        });
        nineGrid = aggregateNineGrid(rows);
      }

      return {
        project: p ?? null,
        diagnostic: serializeDiagnostic(d),
        indicators: INDICATORS.map((def) => ({
          ...def,
          scoreRow: scoreRows.find((s) => s.indicatorKey === def.key) ?? null,
        })),
        findings: findingRows,
        nineGrid,
        nineGridDate,
        verdict: d.verdictJson ?? null,
        directions: d.directionsJson ?? null,
        crawl: crawlRows[0] ?? null,
      };
    }),
});
