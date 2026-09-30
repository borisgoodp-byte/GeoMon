import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedProcedure, assertProjectAccess } from "./middleware";
import { findBanned } from "@contracts/bannedWords";
import {
  assembleByDiagnostic,
  assembleByProject,
  deliverablesStatus,
} from "./services/deliverables";
import { buildClientScript } from "./services/clientScript";
import { renderReportHtml } from "./templates/report.html";
import { renderWorkbookHtml } from "./templates/workbook.html";
import { renderScheduleHtml } from "./templates/schedule.html";
import { renderQuoteHtml } from "./templates/quote.html";

/** 导出响应统一携带禁用词扫描结果（前端展示警示条） */
function withBanned(html: string, filename: string) {
  return { html, filename, banned: findBanned(html) };
}

export const deliverablesRouter = createRouter({
  /** 导出就绪状态：四项各自缺什么数据（前端按 missing 置灰） */
  status: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const s = await deliverablesStatus(input.projectId);
      if (!s)
        throw new TRPCError({ code: "NOT_FOUND", message: `项目不存在: ${input.projectId}` });
      return s;
    }),

  /** ① 诊断报告（IQAir 版式，按诊断单导出） */
  exportReport: authedProcedure
    .input(z.object({ diagnosticId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const data = await assembleByDiagnostic(input.diagnosticId);
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: `诊断单不存在: ${input.diagnosticId}` });
      assertProjectAccess(ctx, data.project.id);
      return withBanned(
        renderReportHtml(data),
        `${data.project.name}官网GEO诊断报告.html`,
      );
    }),

  /** ② 评分与依据底稿（18 项逐项表 + 9 问留档明细） */
  exportWorkbook: authedProcedure
    .input(z.object({ diagnosticId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const data = await assembleByDiagnostic(input.diagnosticId);
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: `诊断单不存在: ${input.diagnosticId}` });
      assertProjectAccess(ctx, data.project.id);
      return withBanned(
        renderWorkbookHtml(data),
        `${data.project.name}GEO诊断评分与依据底稿.html`,
      );
    }),

  /** ③ 排期总表（保研岛版式，按项目 serviceMonths 生成） */
  exportSchedule: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const data = await assembleByProject(input.projectId);
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: `项目不存在: ${input.projectId}` });
      return withBanned(
        renderScheduleHtml(data),
        `${data.project.name}官网优化项目排期总表.html`,
      );
    }),

  /** ④ 报价单（三档周期套餐 + 单项服务价） */
  exportQuote: authedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      assertProjectAccess(ctx, input.projectId);
      const data = await assembleByProject(input.projectId);
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: `项目不存在: ${input.projectId}` });
      return withBanned(
        renderQuoteHtml(data),
        `${data.project.name}GEO服务报价单.html`,
      );
    }),

  /** 五段式客户沟通话术（可编辑后复制；3 个月版不提指标） */
  clientScript: authedProcedure
    .input(z.object({ diagnosticId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const data = await assembleByDiagnostic(input.diagnosticId);
      if (!data)
        throw new TRPCError({ code: "NOT_FOUND", message: `诊断单不存在: ${input.diagnosticId}` });
      assertProjectAccess(ctx, data.project.id);
      const text = buildClientScript(data);
      return { text, banned: findBanned(text) };
    }),
});
