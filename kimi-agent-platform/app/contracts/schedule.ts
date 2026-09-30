/**
 * 排期表生成规则（前后端共享 · 禁止依赖 api/）
 * 依据 SKILL.md 硬规则 4「三阶段模型 · 排期按实际工作量，不摊平周期」：
 * - Phase 1（约 M1）技术诊断 + 官网改造（数据包交付）
 * - Phase 2（约 M2）内容生态（内容指导、板块建设）
 * - Phase 3（M3 起）监测运营 + 持续优化，占满剩余周期，周期末验收
 * 期末里程碑按服务周期写 KPI（6 个月 ≥30% / 12 个月 ≥50%），
 * 3 个月周期写「按交付物清单验收，无指标考核」（2026-09-15 用户定稿）。
 * day 为相对 startDate 的偏移天数（每月按 30 天折算）。
 */

import { kpiTargetForMonths } from "./kpi";

export interface ScheduleTask {
  name: string;
  owner: string;
  startDay: number;
  endDay: number;
  deliverable: string;
}

export interface SchedulePhase {
  phase: "A" | "B" | "C" | "D";
  name: string;
  tasks: ScheduleTask[];
}

export interface ScheduleMilestone {
  name: string;
  day: number;
  desc: string;
}

export interface GeneratedSchedule {
  startDate: string;
  /** 服务周期（月），3 / 6 / 12 */
  serviceMonths: number;
  phasesJson: SchedulePhase[];
  milestonesJson: ScheduleMilestone[];
}

/** day 偏移 → ISO 日期（基于 startDate） */
export function dayToDate(startDate: string, day: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return d.toISOString().slice(0, 10);
}

/**
 * 生成三阶段排期：P1 技术诊断+官网改造（M1）/ P2 内容生态（M2）/ P3 监测运营占满剩余周期。
 * 期末验收里程碑：6/12 个月写 KPI 口径；3 个月写交付物验收（无指标考核）。
 */
export function generateSchedule(
  startDate: string,
  serviceMonths: number,
): GeneratedSchedule {
  const totalDays = serviceMonths * 30;
  const kpiTarget = kpiTargetForMonths(serviceMonths);

  // 期末里程碑文案：按周期口径（3 个月无指标考核）
  const finalDesc =
    kpiTarget === null
      ? "周期末验收：按交付物清单逐项验收（诊断报告、改造数据包、内容指导包、监测报告），无指标考核"
      : `周期末考核：固定词库单日实测官网引用率目标 ≥${kpiTarget}%，词库完成率 ≥80% 即 KPI 达标；达成率 ≥80%（${Math.round(kpiTarget * 0.8)}%）即验收合格`;

  const phasesJson: SchedulePhase[] = [
    {
      phase: "A",
      name: "Phase 1 · 技术诊断与官网改造",
      tasks: [
        { name: "官网技术诊断（18 项指标实测评分）", owner: "技术顾问 / GEO 分析师", startDay: 0, endDay: 5, deliverable: "《技术诊断报告》" },
        { name: "官网改造核心（页面规范、结构化数据、商业页升级）", owner: "技术顾问 / 内容策划", startDay: 5, endDay: 18, deliverable: "官网改造上线确认" },
        { name: "信息架构与板块规划", owner: "技术顾问 / 内容策划 / 项目总监", startDay: 5, endDay: 25, deliverable: "信息架构蓝图（客户确认稿）" },
        { name: "Phase 1 验收与数据包交付", owner: "项目总监", startDay: 25, endDay: 30, deliverable: "《官网改造优化数据包》" },
      ],
    },
    {
      phase: "B",
      name: "Phase 2 · 内容生态建设",
      tasks: [
        { name: "GEO 内容指导（内容战略、选题池、创作规范、FAQ 矩阵）", owner: "内容策划 / 项目总监", startDay: 30, endDay: 45, deliverable: "《GEO 内容指导包》" },
        { name: "存量内容改造指导（体检 + 重构指引）", owner: "内容策划", startDay: 38, endDay: 55, deliverable: "《存量内容改造指导包》" },
        { name: "Phase 2 验收", owner: "项目总监", startDay: 55, endDay: 60, deliverable: "Phase 2 交付确认单" },
      ],
    },
    {
      phase: "C",
      name: "Phase 3 · 监测运营与持续优化",
      tasks: [
        { name: "内容上线与持续发布（长文 / 重构稿 / FAQ 板块）", owner: "内容策划", startDay: 60, endDay: totalDays, deliverable: "上线内容（按节奏持续）" },
        { name: "监测报告（周报，每周一）", owner: "GEO 分析师", startDay: 60, endDay: totalDays, deliverable: "《监测报告》周报" },
        { name: "月数据报告（每月末）", owner: "GEO 分析师 / 项目总监", startDay: 60, endDay: totalDays, deliverable: "《月数据报告》" },
        { name: "周期末验收（同口径复测 / 交付物清点）", owner: "项目总监", startDay: totalDays - 5, endDay: totalDays, deliverable: "最终验收报告" },
      ],
    },
  ];

  const milestonesJson: ScheduleMilestone[] = [
    { name: "诊断报告交付", day: 5, desc: "四维评分与诊断报告出具并完成汇报" },
    { name: "官网改造上线", day: 30, desc: "Phase 1 官网改造完成上线，数据包交付验收" },
    { name: "内容体系就绪", day: 60, desc: "Phase 2 内容指导包交付，FAQ 矩阵与选题池确认" },
    { name: "周期末验收", day: totalDays, desc: finalDesc },
  ];

  return { startDate, serviceMonths, phasesJson, milestonesJson };
}
