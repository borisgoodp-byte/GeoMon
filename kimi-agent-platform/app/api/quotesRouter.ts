import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { createRouter, authedProcedure, staffProcedure, assertProjectAccess } from "./middleware";
import { getDb } from "./queries/connection";
import { quotes, projects } from "@db/schema";
import {
  PERIOD_PACKAGES,
  SINGLE_ITEMS,
  computeQuoteTotal,
  packageForMonths,
  packageQuoteItem,
} from "@contracts/quote";
import { generateSchedule } from "@contracts/schedule";
import { schedules } from "@db/schema";

const quoteItemInput = z.object({
  group: z.string(),
  name: z.string().min(1),
  desc: z.string().default(""),
  unit: z.string().default("项"),
  price: z.number().nonnegative(),
  qty: z.number().positive(),
});

const monthsInput = z
  .number()
  .int()
  .refine((v) => [3, 6, 12].includes(v), "服务周期仅支持 3 / 6 / 12 个月");

export const quotesRouter = createRouter({
  /** 价格目录：三档周期套餐 + A–D 单项标准价（周期口径） */
  catalog: authedProcedure.query(() => ({
    packages: PERIOD_PACKAGES,
    singleItems: SINGLE_ITEMS,
  })),

  create: staffProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        title: z.string().min(1),
        /** 服务周期（月）；缺省取项目 serviceMonths */
        months: monthsInput.optional(),
        items: z.array(quoteItemInput).min(1).optional(),
        status: z.enum(["draft", "issued"]).default("draft"),
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
      const months = input.months ?? p.serviceMonths ?? 12;
      const pkg = packageForMonths(months);
      if (!pkg)
        throw new TRPCError({ code: "BAD_REQUEST", message: `未知服务周期: ${months}` });
      // 明细缺省 = 周期套餐单行；tier 字段记套餐名（字段保留，不再承担档位 KPI）
      const items = input.items ?? [packageQuoteItem(months)];
      const total = computeQuoteTotal(items);
      const [{ id }] = await db
        .insert(quotes)
        .values({
          projectId: input.projectId,
          title: input.title,
          tier: pkg.name,
          itemsJson: items,
          totalPrice: String(total),
          status: input.status,
        })
        .$returningId();
      const [q] = await db.select().from(quotes).where(eq(quotes.id, id));
      return q;
    }),

  update: staffProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).optional(),
        months: monthsInput.optional(),
        items: z.array(quoteItemInput).min(1).optional(),
        status: z.enum(["draft", "issued"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, items, months, ...patch } = input;
      const set: Record<string, unknown> = { ...patch };
      if (months !== undefined) {
        const pkg = packageForMonths(months);
        if (!pkg)
          throw new TRPCError({ code: "BAD_REQUEST", message: `未知服务周期: ${months}` });
        set.tier = pkg.name;
      }
      if (items) {
        set.itemsJson = items;
        set.totalPrice = String(computeQuoteTotal(items));
      }
      await db.update(quotes).set(set).where(eq(quotes.id, id));
      const [q] = await db.select().from(quotes).where(eq(quotes.id, id));
      return q;
    }),

  get: authedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const [q] = await getDb()
        .select()
        .from(quotes)
        .where(eq(quotes.id, input.id))
        .limit(1);
      if (q) assertProjectAccess(ctx, q.projectId);
      return q ?? null;
    }),

  listByProject: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      return getDb()
        .select()
        .from(quotes)
        .where(eq(quotes.projectId, input.projectId))
        .orderBy(desc(quotes.id));
    }),
});

export const schedulesRouter = createRouter({
  /** 按三阶段模型生成 phasesJson + milestonesJson 并落库（周期取项目 serviceMonths，可入参覆盖） */
  generate: staffProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        months: monthsInput.optional(),
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
      const serviceMonths = input.months ?? p.serviceMonths ?? 12;
      const { phasesJson, milestonesJson } = generateSchedule(
        input.startDate,
        serviceMonths,
      );
      const [{ id }] = await db
        .insert(schedules)
        .values({
          projectId: input.projectId,
          startDate: input.startDate,
          phasesJson,
          milestonesJson,
        })
        .$returningId();
      const [s] = await db.select().from(schedules).where(eq(schedules.id, id));
      return s;
    }),

  update: staffProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        phasesJson: z.array(z.unknown()).optional(),
        milestonesJson: z.array(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...patch } = input;
      await db
        .update(schedules)
        .set(patch as never)
        .where(eq(schedules.id, id));
      const [s] = await db.select().from(schedules).where(eq(schedules.id, id));
      return s;
    }),

  get: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const [s] = await getDb()
        .select()
        .from(schedules)
        .where(eq(schedules.projectId, input.projectId))
        .orderBy(desc(schedules.id))
        .limit(1);
      return s ?? null;
    }),
});
