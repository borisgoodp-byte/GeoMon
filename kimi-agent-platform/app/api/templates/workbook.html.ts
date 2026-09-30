/**
 * 《<品牌>GEO诊断评分与依据底稿.html》模板（只 HTML 不 PDF）
 * 18 项逐项表（子指标/档位/得分/关键证据，每维度末行小计）+
 * 维度四附 9 问实测留档明细（平台/词类/问题原文/回答全文/来源清单/命中判定/实测日期）。
 * 底稿可写术语细节（报告正文用平实话）。
 */

import { esc, fmtMonth, REPORT_CSS } from "./_shared";
import {
  DIMENSION_INDICATOR_KEYS,
  DIMENSION_NAMES,
  INDICATOR_MAP,
  type DimensionKey,
} from "@contracts/scoring";
import { VIS_WORD_TYPE_LABELS } from "@contracts/vistest";
import { PLATFORM_LABELS } from "@contracts/kpi";
import type { DeliverableData } from "../services/deliverables";

/** 档位词：20 优秀 / 15 良好 / 10 待提升 / 0 缺失 */
function tierOf(score: number | null): string {
  if (score === null) return "待实测";
  if (score >= 20) return "优秀";
  if (score >= 15) return "良好";
  if (score >= 10) return "待提升";
  return "缺失";
}

export function renderWorkbookHtml(data: DeliverableData): string {
  const { project, diagnostic, indicators, visTests } = data;
  const monthLabel = fmtMonth(diagnostic.diagnoseDate);
  const dimNamesCN = ["一", "二", "三", "四"] as const;

  // 18 项逐项表（每维度一张表，末行小计）
  const dimTables = ([1, 2, 3, 4] as DimensionKey[])
    .map((dim) => {
      const keys = DIMENSION_INDICATOR_KEYS[dim];
      const rows = keys
        .map((key, i) => {
          const def = INDICATOR_MAP[key]!;
          const row = indicators.find((r) => r.indicatorKey === key);
          const score = row?.score ?? null;
          const evidence =
            [row?.autoEvidence, row?.evidence].filter(Boolean).join("；") || "—";
          return `<tr><td>${i + 1}. ${esc(def.name)}</td><td class="c">${tierOf(score)}</td><td class="c">${score === null ? "待实测" : score}</td><td>${esc(evidence)}</td></tr>`;
        })
        .join("");
      const dimScore =
        dim === 1
          ? diagnostic.techScore
          : dim === 2
            ? diagnostic.archScore
            : dim === 3
              ? diagnostic.contentScore
              : diagnostic.visScore;
      return `<h3 style="margin:26px 0 8px;font-size:17px;">维度${dimNamesCN[dim - 1]} · ${DIMENSION_NAMES[dim]}</h3>
    <table class="ai-table">
      <tr><th>子指标</th><th class="c" style="width:70px;">档位</th><th class="c" style="width:70px;">得分</th><th>关键证据（抓取证据 + 人工复核备注）</th></tr>
      ${rows}
      <tr><td style="font-weight:700;">小计</td><td></td><td class="c" style="font-weight:700;">${dimScore ?? "—"}${dim === 4 ? "（= 三项和 ÷ 60 × 100）" : ""}</td><td></td></tr>
    </table>`;
    })
    .join("\n");

  // 维度四附 9 问实测留档明细
  const visRows = visTests
    .map(
      (t) => `<tr>
      <td>${PLATFORM_LABELS[t.platform]}</td>
      <td>${VIS_WORD_TYPE_LABELS[t.wordType]}</td>
      <td>${esc(t.question)}</td>
      <td>${esc(t.answer) || "—"}</td>
      <td>${esc(t.sources) || "—"}</td>
      <td class="c">${t.hit === null ? "待实测" : t.hit ? '<span class="dotg">命中</span>' : '<span class="dotr">未命中</span>'}</td>
      <td class="c">${esc(t.testedAt ?? "—")}</td>
    </tr>`,
    )
    .join("\n");
  const visSection =
    visTests.length > 0
      ? `<h3 style="margin:26px 0 8px;font-size:17px;">附 · 维度四 9 问实测留档明细</h3>
    <table class="ai-table">
      <tr><th style="width:90px;">平台</th><th style="width:130px;">词类</th><th>问题原文</th><th>回答全文</th><th>来源清单</th><th class="c" style="width:70px;">命中判定</th><th class="c" style="width:100px;">实测日期</th></tr>
      ${visRows}
    </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(project.name)}GEO诊断评分与依据底稿</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="container">

  <section class="hero">
    <div class="hero-eyebrow">Scoring Workbook</div>
    <h1>${esc(project.name)} GEO 诊断评分与依据底稿</h1>
    <div class="hero-sub">18 项指标逐项评分与证据留档（四档制 20/15/10/0），内部工作底稿</div>
    <div class="hero-meta">
      <span>诊断对象：<b>${esc(project.company)}</b></span>
      <span>官网：<b>${esc(project.domain)}</b></span>
      <span>诊断日期：<b>${monthLabel}</b></span>
      <span>编制：<b>清蓝官网GEO项目组</b></span>
    </div>
  </section>

  <section class="card">
    <div class="sec-head"><span class="sec-num">01</span><span class="sec-title">18 项指标逐项评分</span></div>
    <div class="sec-desc">子指标四档：20 优秀 / 15 良好 / 10 待提升 / 0 缺失；维度一至三各 5 项求和（0–100），维度四 3 项按命中平台数定档（3/3=20、2/3=15、1/3=10、0/3=0），维度四 =（三项之和 ÷ 60）× 100。综合健康度 = 技术×25% + 页面×20% + 内容×30% + 可见度×25% = ${diagnostic.compositeScore ?? "—"} 分（${esc(diagnostic.grade ?? "—")} 级）。</div>
    ${dimTables}
    ${visSection}
  </section>

  <div class="footer">
    <b>保密声明</b>：本底稿为内部工作文档，含逐项证据留档，未经许可不得转发第三方。<br>
    报告编制：清蓝官网GEO项目组 ｜ 报告日期：${monthLabel}
  </div>

</div>
</body>
</html>`;
}
