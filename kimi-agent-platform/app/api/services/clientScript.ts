/**
 * 五段式客户沟通话术生成（一条消息内完整走完，依据 references/sales-script.md）
 * ① 亮点（ok 发现）→ ② 短板（danger/warn 发现）→ ③ 因果句（现状 + 需要做什么）→
 * ④ 套餐+周期 → ⑤ 报价（3 个月版不提指标，只说按交付物验收）。
 * 内容生成自平台数据，不编造新事实；前端 Dialog 可编辑后复制。
 */

import { packageForMonths } from "@contracts/quote";
import type { DeliverableData } from "./deliverables";

/** 取首句（句号截断） */
function firstSentence(text: string): string {
  const idx = text.indexOf("。");
  return idx >= 0 ? `${text.slice(0, idx)}。` : text;
}

/** 生成五段式话术（纯文本，段间空行） */
export function buildClientScript(data: DeliverableData): string {
  const { project, findings, verdict } = data;
  const months = project.serviceMonths ?? 12;
  const pkg = packageForMonths(months);

  // ① 亮点：severity=ok 的发现，取前 2 条
  const highlights = findings.filter((f) => f.severity === "ok").slice(0, 2);
  const seg1 =
    highlights.length > 0
      ? `① 亮点：${highlights.map((f) => f.title).join("；")}，这是不错的底子。`
      : "① 亮点：官网已具备基本的信息呈现，为后续优化提供了底子。";

  // ② 短板：danger 优先，取前 3 条标题
  const gaps = [
    ...findings.filter((f) => f.severity === "danger"),
    ...findings.filter((f) => f.severity === "warn"),
  ].slice(0, 3);
  const seg2 =
    gaps.length > 0
      ? `② 短板：${gaps.map((f) => f.title).join("；")}。`
      : "② 短板：官网在 AI 搜索生态中的可见性仍有几处关键短板。";

  // ③ 因果句：现状（实测可见度首句）+ 需要做什么 + 达到什么
  const current = verdict
    ? firstSentence(verdict.visibility)
    : "目前在各 AI 平台的回答与引用来源中官网均未被引用。";
  const seg3 = `③ 因果：${current}需要对官网进行全链路的系统优化，让 AI 平台能够发现、读懂并信任官网内容，才能在用户决策场景中获得稳定的可见性与引用。`;

  // ④ 套餐+周期
  const seg4 = `④ 套餐：对应我们的${pkg?.name ?? `${months}个月版`}，服务周期为 ${months} 个月，包含${pkg?.services.join("、") ?? "诊断、改造、内容与监测"}，并赠送${pkg?.gift ?? "监测报告"}。`;

  // ⑤ 报价：3 个月不提指标；6/12 个月带考核口径
  const priceWan = pkg ? pkg.price / 10000 : null;
  const seg5 =
    months === 3
      ? `⑤ 报价：官网 GEO 优化服务费用为人民币 ${priceWan ?? "—"} 万元/${months} 个月。本周期按交付物清单逐项验收，无指标考核。`
      : `⑤ 报价：官网 GEO 优化服务费用为人民币 ${priceWan ?? "—"} 万元/${months} 个月。考核口径：${pkg?.kpi ?? ""}（固定词库单日实测，词库完成率 ≥80% 即达标），按服务周期末验收。`;

  return [seg1, seg2, seg3, seg4, seg5].join("\n\n");
}
