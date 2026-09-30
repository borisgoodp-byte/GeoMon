import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { createRouter, authedProcedure, staffProcedure, assertProjectAccess } from "./middleware";
import { getDb } from "./queries/connection";
import { keywordPools, keywords, poolChangeLogs } from "@db/schema";

const wordInput = z.object({
  text: z.string().min(1),
  category: z.enum(["brand", "generic", "scenario"]),
  isExtended: z.boolean().default(false),
});

async function writeLog(
  poolId: number,
  action: "create" | "lock" | "unlock" | "add" | "remove" | "extend",
  detail: string,
  operator: string,
) {
  await getDb().insert(poolChangeLogs).values({ poolId, action, detail, operator });
}

async function getPoolOrThrow(poolId: number) {
  const [pool] = await getDb()
    .select()
    .from(keywordPools)
    .where(eq(keywordPools.id, poolId))
    .limit(1);
  if (!pool)
    throw new TRPCError({ code: "NOT_FOUND", message: `词池不存在: ${poolId}` });
  return pool;
}

/** 锁定池发生词变更：版本号 +1（v 追踪考核基准的演进） */
async function bumpVersion(poolId: number) {
  await getDb()
    .update(keywordPools)
    .set({ version: sql`${keywordPools.version} + 1` })
    .where(eq(keywordPools.id, poolId));
}

export const poolsRouter = createRouter({
  create: staffProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        name: z.string().min(1),
        words: z.array(wordInput).min(1),
        note: z.string().optional(),
        operator: z.string().default("系统"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const db = getDb();
      const [{ id }] = await db
        .insert(keywordPools)
        .values({
          projectId: input.projectId,
          name: input.name,
          note: input.note,
        })
        .$returningId();
      await db.insert(keywords).values(
        input.words.map((w) => ({
          poolId: id,
          text: w.text,
          category: w.category,
          isExtended: w.isExtended,
        })),
      );
      await writeLog(
        id,
        "create",
        `创建词池「${input.name}」，共 ${input.words.length} 词（品牌 ${input.words.filter((w) => w.category === "brand").length} / 通用 ${input.words.filter((w) => w.category === "generic").length} / 场景 ${input.words.filter((w) => w.category === "scenario").length}）`,
        input.operator,
      );
      return { id };
    }),

  get: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const db = getDb();
      const [pool] = await db
        .select()
        .from(keywordPools)
        .where(eq(keywordPools.projectId, input.projectId))
        .orderBy(desc(keywordPools.id))
        .limit(1);
      if (!pool) return null;
      const words = await db
        .select()
        .from(keywords)
        .where(eq(keywords.poolId, pool.id));
      return { ...pool, keywords: words };
    }),

  lock: staffProcedure
    .input(
      z.object({
        poolId: z.number().int().positive(),
        operator: z.string().default("系统"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const pool = await getPoolOrThrow(input.poolId);
      if (pool.status === "locked") {
        throw new TRPCError({ code: "CONFLICT", message: "词池已处于锁定状态" });
      }
      await db
        .update(keywordPools)
        .set({ status: "locked", lockedAt: new Date() })
        .where(eq(keywordPools.id, input.poolId));
      await writeLog(input.poolId, "lock", "词池确认锁定，服务周期内变更须审批并记录", input.operator);
      return { ok: true };
    }),

  /** 解锁回草稿态：用于锁错/重建基准场景，留痕且版本 +1 */
  unlock: staffProcedure
    .input(
      z.object({
        poolId: z.number().int().positive(),
        operator: z.string().default("系统"),
        reason: z.string().min(1, "解锁须填写说明"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const pool = await getPoolOrThrow(input.poolId);
      if (pool.status !== "locked") {
        throw new TRPCError({ code: "CONFLICT", message: "词池未锁定，无需解锁" });
      }
      await db
        .update(keywordPools)
        .set({ status: "draft", lockedAt: null })
        .where(eq(keywordPools.id, input.poolId));
      await bumpVersion(input.poolId);
      await writeLog(input.poolId, "unlock", `词池解锁回草稿态：${input.reason}`, input.operator);
      return { ok: true };
    }),

  addKeyword: staffProcedure
    .input(
      z.object({
        poolId: z.number().int().positive(),
        text: z.string().min(1),
        category: z.enum(["brand", "generic", "scenario"]),
        isExtended: z.boolean().default(false),
        operator: z.string().default("系统"),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const pool = await getPoolOrThrow(input.poolId);
      const [{ id }] = await db
        .insert(keywords)
        .values({
          poolId: input.poolId,
          text: input.text,
          category: input.category,
          isExtended: input.isExtended,
        })
        .$returningId();
      // 锁定池加词须记录变更日志并推进版本
      if (pool.status === "locked") {
        await bumpVersion(input.poolId);
        await writeLog(
          input.poolId,
          input.isExtended ? "extend" : "add",
          `${input.isExtended ? "新增可拓词" : "新增考核词"}「${input.text}」（${input.category}）${input.reason ? `：${input.reason}` : ""}`,
          input.operator,
        );
      }
      return { id };
    }),

  removeKeyword: staffProcedure
    .input(
      z.object({
        keywordId: z.number().int().positive(),
        operator: z.string().default("系统"),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [kw] = await db
        .select()
        .from(keywords)
        .where(eq(keywords.id, input.keywordId))
        .limit(1);
      if (!kw)
        throw new TRPCError({ code: "NOT_FOUND", message: `关键词不存在: ${input.keywordId}` });
      await db
        .update(keywords)
        .set({ status: "removed" })
        .where(eq(keywords.id, input.keywordId));
      const [pool] = await db
        .select()
        .from(keywordPools)
        .where(eq(keywordPools.id, kw.poolId))
        .limit(1);
      if (pool?.status === "locked") {
        await bumpVersion(kw.poolId);
        await writeLog(
          kw.poolId,
          "remove",
          `移除关键词「${kw.text}」（标记 removed，历史数据保留）${input.reason ? `：${input.reason}` : ""}`,
          input.operator,
        );
      }
      return { ok: true };
    }),

  /** 可拓词转正式词：原子操作（置 isExtended=false），区别于先删后加的两步法 */
  promoteKeyword: staffProcedure
    .input(
      z.object({
        keywordId: z.number().int().positive(),
        operator: z.string().default("系统"),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [kw] = await db
        .select()
        .from(keywords)
        .where(eq(keywords.id, input.keywordId))
        .limit(1);
      if (!kw)
        throw new TRPCError({ code: "NOT_FOUND", message: `关键词不存在: ${input.keywordId}` });
      if (!kw.isExtended || kw.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "仅活跃可拓词可转正" });
      }
      await db
        .update(keywords)
        .set({ isExtended: false })
        .where(eq(keywords.id, input.keywordId));
      const [pool] = await db
        .select()
        .from(keywordPools)
        .where(eq(keywordPools.id, kw.poolId))
        .limit(1);
      if (pool?.status === "locked") {
        await bumpVersion(kw.poolId);
      }
      // 转正改变 KPI 分母，草稿/锁定态均留痕
      await writeLog(
        kw.poolId,
        "add",
        `可拓词「${kw.text}」转为正式考核词（${kw.category}）${input.reason ? `：${input.reason}` : ""}`,
        input.operator,
      );
      return { ok: true };
    }),

  changeLogs: authedProcedure
    .input(z.object({ poolId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      // 项目隔离：经词池反查 projectId 后校验
      const [pool] = await getDb()
        .select({ projectId: keywordPools.projectId })
        .from(keywordPools)
        .where(eq(keywordPools.id, input.poolId))
        .limit(1);
      if (pool) assertProjectAccess(ctx, pool.projectId);
      return getDb()
        .select()
        .from(poolChangeLogs)
        .where(eq(poolChangeLogs.poolId, input.poolId))
        .orderBy(poolChangeLogs.createdAt);
    }),
});
