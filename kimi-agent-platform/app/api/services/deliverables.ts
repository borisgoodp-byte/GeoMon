/**
 * 交付物数据组装（deliverablesRouter 与四模板共用）
 * 生成内容全部来自数据库真实数据：diagnostic 评分/证据/visTests、project、findings、competitors。
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  projects,
  diagnostics,
  indicatorScores,
  findings,
  competitors,
  type Project,
  type IndicatorScoreRow,
  type Finding,
  type Competitor,
} from "@db/schema";
import type { VerdictJson, DirectionCard } from "@contracts/types";
import type { VisTest } from "@contracts/vistest";
import { visScoresFromTests } from "@contracts/vistest";

export interface SerializedDiagnostic {
  id: number;
  projectId: number;
  diagnoseDate: string;
  status: string;
  techScore: number | null;
  archScore: number | null;
  contentScore: number | null;
  visScore: number | null;
  compositeScore: number | null;
  grade: string | null;
}

export interface DeliverableData {
  project: Project;
  diagnostic: SerializedDiagnostic;
  indicators: IndicatorScoreRow[];
  findings: Finding[];
  verdict: VerdictJson | null;
  directions: DirectionCard[] | null;
  visTests: VisTest[];
  competitors: Competitor[];
}

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

/** 按诊断单组装导出数据；诊断单不存在返回 null */
export async function assembleByDiagnostic(diagnosticId: number): Promise<DeliverableData | null> {
  const db = getDb();
  const [d] = await db.select().from(diagnostics).where(eq(diagnostics.id, diagnosticId)).limit(1);
  if (!d) return null;
  const [p] = await db.select().from(projects).where(eq(projects.id, d.projectId)).limit(1);
  if (!p) return null;
  const [scoreRows, findingRows, compRows] = await Promise.all([
    db.select().from(indicatorScores).where(eq(indicatorScores.diagnosticId, d.id)),
    db.select().from(findings).where(eq(findings.diagnosticId, d.id)).orderBy(findings.sortOrder),
    db.select().from(competitors).where(eq(competitors.projectId, d.projectId)),
  ]);
  return {
    project: p,
    diagnostic: {
      id: d.id,
      projectId: d.projectId,
      diagnoseDate: d.diagnoseDate,
      status: d.status,
      techScore: num(d.techScore),
      archScore: num(d.archScore),
      contentScore: num(d.contentScore),
      visScore: num(d.visScore),
      compositeScore: num(d.compositeScore),
      grade: d.grade,
    },
    indicators: scoreRows,
    findings: findingRows,
    verdict: d.verdictJson ?? null,
    directions: d.directionsJson ?? null,
    visTests: d.visTests ?? [],
    competitors: compRows,
  };
}

/** 按项目取最新诊断单组装（排期/报价用；无诊断单时用占位空诊断） */
export async function assembleByProject(projectId: number): Promise<DeliverableData | null> {
  const db = getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return null;
  const [d] = await db
    .select()
    .from(diagnostics)
    .where(eq(diagnostics.projectId, projectId))
    .orderBy(desc(diagnostics.id))
    .limit(1);
  if (d) return assembleByDiagnostic(d.id);
  // 无诊断单：排期/报价仍可用（基线文案降级为「未实测」）
  return {
    project: p,
    diagnostic: {
      id: 0,
      projectId,
      diagnoseDate: "",
      status: "crawling",
      techScore: null,
      archScore: null,
      contentScore: null,
      visScore: null,
      compositeScore: null,
      grade: null,
    },
    indicators: [],
    findings: [],
    verdict: null,
    directions: null,
    visTests: [],
    competitors: await db.select().from(competitors).where(eq(competitors.projectId, projectId)),
  };
}

export interface ExportStatus {
  ok: boolean;
  /** 缺数据说明（置灰提示用），ok 时为空数组 */
  missing: string[];
}

export interface DeliverablesStatus {
  serviceMonths: number;
  report: ExportStatus;
  workbook: ExportStatus;
  schedule: ExportStatus;
  quote: ExportStatus;
}

/** 导出就绪状态：缺什么写什么（前端按 missing 置灰） */
export async function deliverablesStatus(projectId: number): Promise<DeliverablesStatus | null> {
  const data = await assembleByProject(projectId);
  if (!data) return null;
  const serviceMonths = data.project.serviceMonths ?? 12;

  const reportMissing: string[] = [];
  if (data.diagnostic.id === 0) reportMissing.push("尚未创建诊断单");
  if (data.diagnostic.compositeScore === null) reportMissing.push("评分未完成");
  if (!visScoresFromTests(data.visTests).complete) reportMissing.push("维度四实测未完成");
  if (!data.verdict || !data.directions || data.directions.length === 0)
    reportMissing.push("综合结论与优化方向未填写");
  if (data.findings.length === 0) reportMissing.push("发现明细未填写");

  const workbookMissing: string[] = [];
  if (data.diagnostic.id === 0) workbookMissing.push("尚未创建诊断单");
  if (data.diagnostic.compositeScore === null) workbookMissing.push("评分未完成");
  if (data.visTests.length === 0) workbookMissing.push("维度四实测未完成（无 9 问留档）");

  const scheduleMissing: string[] = [];
  if (!data.project.startDate) scheduleMissing.push("项目未设置启动日期");

  return {
    serviceMonths,
    report: { ok: reportMissing.length === 0, missing: reportMissing },
    workbook: { ok: workbookMissing.length === 0, missing: workbookMissing },
    schedule: { ok: scheduleMissing.length === 0, missing: scheduleMissing },
    quote: { ok: true, missing: [] },
  };
}
