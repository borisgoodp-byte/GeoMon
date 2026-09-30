/**
 * 周期报告固定模板（周报 / 月报 / 季报）——IQAir 同族版式（复用 _shared REPORT_CSS）
 * 依据 design/report-templates-spec.md：
 * - 周报：hero → 01 本周速览 → 02 引用变化（逐日折线+三平台对比条）→ 03 词级命中明细 → 04 异常与预警 → 05 下周建议
 * - 月报：01 月度总览 → 02 月度趋势 → 03 词库月榜 → 04 竞对格局 → 05 被引页面 TOP → 06 环比与下月建议
 * - 季报：01 阶段成果 vs 考核目标（3 个月项目=交付物验收清单）→ 02 季度趋势研判 → 03 竞对格局演变 → 04 下季规划 → 05 验收对齐（仅周期末季）
 * 纪律：缺数据区块写「本期暂无数据」不编数；编制日期精确到月；主语永远是官网；
 * 品牌提及（L1）仅作参考列；零引用不列举第三方来源（TOP 榜仅官网自身被引页面）。
 */

import { esc, REPORT_CSS } from "./_shared";
import { CATEGORY_LABELS, KPI_STATUS_LABELS, kpiTargetForMonths, type Platform } from "@contracts/kpi";
import type { CompeteBlock, PeriodReportData, PeriodWordRow } from "../services/periodReports";

/** 周期报告附加组件 CSS（大数字卡 / 对比条 / 命中格 / 进度条 / 验收清单 / 提示框） */
const PERIOD_CSS = `
  .big-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0 6px;}
  @media (max-width:760px){.big-grid{grid-template-columns:repeat(2,1fr);}}
  .big-card{border:1px solid var(--border-soft);border-radius:var(--radius-sm);padding:18px 20px;background:#fbfbfd;box-shadow:var(--shadow-sm);}
  .big-card .b-label{font-size:12.5px;color:var(--text-3);}
  .big-card .b-val{font-size:34px;font-weight:700;letter-spacing:-.02em;margin-top:4px;font-variant-numeric:tabular-nums;}
  .big-card .b-val small{font-size:14px;color:var(--text-4);font-weight:400;}
  .big-card .b-sub{font-size:12.5px;margin-top:4px;font-variant-numeric:tabular-nums;}
  .b-sub.up{color:#1e7e34;}
  .b-sub.down{color:#ff3b30;}
  .b-sub.flat{color:var(--text-4);}
  .plat-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
  .plat-row .p-name{width:86px;font-size:13.5px;color:var(--text-2);font-weight:600;flex:none;}
  .plat-row .p-track{flex:1;height:10px;border-radius:5px;background:#ececf0;overflow:hidden;}
  .plat-row .p-fill{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--blue),#42a5f5);}
  .plat-row .p-val{width:120px;text-align:right;font-size:13px;color:var(--text-2);font-variant-numeric:tabular-nums;flex:none;}
  .hit-y{color:#1e7e34;font-weight:700;}
  .hit-n{color:#ff3b30;font-weight:700;}
  .hit-x{color:var(--text-4);}
  .tr-up{color:#1e7e34;font-weight:700;}
  .tr-down{color:#ff3b30;font-weight:700;}
  .tr-flat{color:var(--text-4);}
  .alert-box{border:1px solid var(--border-soft);border-left:4px solid var(--orange);border-radius:var(--radius-sm);
    padding:14px 18px;margin-bottom:10px;background:var(--orange-soft);font-size:14px;color:var(--text-2);}
  .ok-box{border-radius:var(--radius-sm);padding:16px 20px;background:var(--green-soft);color:#1e7e34;font-size:14.5px;font-weight:600;}
  .empty-note{font-size:13.5px;color:var(--text-4);padding:10px 0;}
  .progress{height:10px;border-radius:5px;background:#ececf0;overflow:hidden;margin:10px 0 6px;}
  .progress i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--blue),var(--violet));}
  .progress-meta{display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-3);}
  .check-list{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px;}
  .check-list li{display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:var(--radius-sm);
    background:#fbfbfd;border:1px solid var(--border-soft);font-size:14px;color:var(--text-2);}
  .check-list .ck{width:20px;height:20px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;}
  .ck.ok{background:var(--green-soft);color:#1e7e34;border:1px solid #a9e6bd;}
  .ck.no{background:var(--red-soft);color:var(--red);border:1px solid #ffc7c2;}
  .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;}
  .pill.ok{background:var(--green-soft);color:#1e7e34;}
  .pill.no{background:var(--orange-soft);color:#c93400;}
  .pill.na{background:#f5f5f7;color:var(--text-4);}
  .dot-ok{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--green);margin-right:6px;}
  .dot-no{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--orange);margin-right:6px;}
  .sug-list{list-style:none;padding:0;margin:6px 0 0;}
  .sug-list li{position:relative;padding:6px 0 6px 26px;font-size:14.5px;color:var(--text-2);}
  .sug-list li::before{content:"";position:absolute;left:6px;top:14px;width:8px;height:8px;border-radius:50%;background:var(--blue);}
  .chart-note{font-size:12px;color:var(--text-4);text-align:center;margin-top:8px;}
  .month-bars{display:flex;align-items:flex-end;gap:18px;height:150px;padding:10px 6px 0;}
  .month-bars .mb{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;}
  .month-bars .mb .col{width:46px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#42a5f5,var(--blue));}
  .month-bars .mb .mv{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;}
  .month-bars .mb .ml{font-size:12px;color:var(--text-4);}
  @media print{body{background:#fff;}.card,.big-card,.alert-box{box-shadow:none;break-inside:avoid;}}
`;

/* ------------------------------------------------------------------ 公共小件 */

/** 缺数据区块统一文案（不编数） */
const EMPTY = `<p class="empty-note">本期暂无数据。</p>`;

/** 环比 sub 文案与箭头 */
function deltaSub(delta: number, unit = "pt"): { cls: string; text: string } {
  if (delta > 0) return { cls: "up", text: `▲ +${delta.toFixed(1)}${unit} 环比` };
  if (delta < 0) return { cls: "down", text: `▼ ${delta.toFixed(1)}${unit} 环比` };
  return { cls: "flat", text: "→ 持平 环比" };
}

/** 逐日/逐月 SVG 折线（viewBox 640×200，y 轴 0–100%，虚线 30%/50% 参考线） */
function lineChartSvg(points: { label: string; rate: number | null }[]): string {
  const W = 640;
  const H = 200;
  const L = 36;
  const R = 12;
  const T = 14;
  const B = 26;
  const iw = W - L - R;
  const ih = H - T - B;
  const yOf = (rate: number) => T + (1 - Math.max(0, Math.min(100, rate)) / 100) * ih;
  const xOf = (i: number) => L + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);

  const grid = [0, 25, 50, 75, 100]
    .map(
      (g) =>
        `<line x1="${L}" y1="${yOf(g)}" x2="${W - R}" y2="${yOf(g)}" stroke="#ececf0" stroke-width="1"/>` +
        `<text x="${L - 6}" y="${yOf(g) + 3.5}" font-size="10" fill="#86868b" text-anchor="end">${g}%</text>`,
    )
    .join("");
  const refs = [30, 50]
    .map(
      (g, i) =>
        `<line x1="${L}" y1="${yOf(g)}" x2="${W - R}" y2="${yOf(g)}" stroke="${i === 0 ? "#ff9f0a" : "#ff3b30"}" stroke-width="1" stroke-dasharray="4 4" opacity=".55"/>`,
    )
    .join("");

  // 折线（null 断点分段）
  const segs: string[] = [];
  let cur: string[] = [];
  points.forEach((p, i) => {
    if (p.rate === null) {
      if (cur.length > 1) segs.push(cur.join(" "));
      cur = [];
    } else {
      cur.push(`${xOf(i).toFixed(1)},${yOf(p.rate).toFixed(1)}`);
    }
  });
  if (cur.length > 1) segs.push(cur.join(" "));
  const lines = segs
    .map((s) => `<polyline points="${s}" fill="none" stroke="#0071e3" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join("");
  const dots = points
    .map((p, i) =>
      p.rate === null
        ? ""
        : `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.rate).toFixed(1)}" r="3" fill="#fff" stroke="#0071e3" stroke-width="2"/>`,
    )
    .join("");
  // x 轴标签：最多 8 个
  const step = Math.max(1, Math.ceil(points.length / 8));
  const xlabels = points
    .map((p, i) =>
      i % step === 0 || i === points.length - 1
        ? `<text x="${xOf(i).toFixed(1)}" y="${H - 8}" font-size="10" fill="#86868b" text-anchor="middle">${esc(p.label)}</text>`
        : "",
    )
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="引用率走势">${grid}${refs}${lines}${dots}${xlabels}</svg>`;
}

/** 词级命中明细表（周/月共用；品牌提及仅参考列） */
function wordTable(words: PeriodWordRow[], withTarget: number | null): string {
  if (words.length === 0) return EMPTY;
  const rows = words
    .map((w) => {
      const cell = (p: Platform) => {
        const v = w.platformHits[p];
        if (v === null) return `<td class="c hit-x">—</td>`;
        return v ? `<td class="c hit-y">✓</td>` : `<td class="c hit-n">✗</td>`;
      };
      const trend =
        w.trend === null
          ? `<span class="tr-flat">—</span>`
          : w.trend === "up"
            ? `<span class="tr-up">↑</span>`
            : w.trend === "down"
              ? `<span class="tr-down">↓</span>`
              : `<span class="tr-flat">→</span>`;
      const pill =
        withTarget === null
          ? ""
          : `<td class="c">${w.rate >= withTarget ? `<span class="pill ok">达标</span>` : `<span class="pill no">未达标</span>`}</td>`;
      return `<tr>
        <td>${esc(w.text)}</td>
        <td>${CATEGORY_LABELS[w.category]}</td>
        ${cell("doubao")}${cell("deepseek")}${cell("qwen")}
        <td class="c"><b>${w.rate}%</b></td>
        <td class="c">${trend}</td>
        <td class="c" style="color:var(--text-4)">${w.l1}</td>
        ${pill}
      </tr>`;
    })
    .join("");
  return `<table class="ai-table">
    <thead><tr>
      <th>词</th><th>词类</th>
      <th class="c">豆包</th><th class="c">DeepSeek</th><th class="c">通义千问</th>
      <th class="c">本期引用率</th><th class="c">趋势</th><th class="c">品牌提及（参考）</th>
      ${withTarget === null ? "" : `<th class="c">达标</th>`}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** SOV 声量份额表（我方行高亮；竞对数据仅对比不计 KPI） */
function sovTable(sov: CompeteBlock["sov"]): string {
  if (sov.length === 0) return EMPTY;
  const rows = sov
    .map((s) => {
      const isOwn = s.brandKey === "own";
      return `<tr${isOwn ? ` style="background:var(--blue-soft)"` : ""}>
        <td>${isOwn ? "★ " : ""}${esc(s.name)}${isOwn ? "（我方官网）" : ""}</td>
        <td class="c">${s.l2}</td>
        <td class="c">${s.hitRate}%</td>
        <td class="c"><b>${s.share}%</b></td>
      </tr>`;
    })
    .join("");
  return `<table class="ai-table">
    <thead><tr><th>品牌</th><th class="c">官网引用次数（L2）</th><th class="c">命中率</th><th class="c">声量份额</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** 失守词清单 */
function losingWordsTable(words: CompeteBlock["losingWords"]): string {
  if (words.length === 0)
    return `<div class="ok-box">本期无失守词：官网在全部有对比的词上引用率不低于竞对。</div>`;
  const rows = words
    .map(
      (w) => `<tr>
        <td>${esc(w.text)}</td>
        <td>${CATEGORY_LABELS[w.category]}</td>
        <td class="c">${w.ownRate}%</td>
        <td>${esc(w.rivalName)}</td>
        <td class="c" style="color:var(--red);font-weight:700">${w.rivalRate}%</td>
      </tr>`,
    )
    .join("");
  return `<table class="ai-table">
    <thead><tr><th>词</th><th>词类</th><th class="c">官网引用率</th><th>竞对</th><th class="c">竞对引用率</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** 页脚（含编制方与日期；季报带保密声明） */
function footer(d: PeriodReportData, confidential: boolean): string {
  return `<div class="footer">
    ${confidential ? `<b>保密声明</b>：本报告基于监测期内的平台实测数据生成，仅供贵司内部决策参考，未经许可不得转发第三方。<br>` : ""}
    报告编制：清蓝官网GEO项目组 ｜ 编制日期：${esc(d.compiledMonth)} ｜ 统计周期：${d.from} ~ ${d.to}<br>
    口径：引用呈现率 = 官网来源命中（L2）÷ 实测总数（不含可拓词）；品牌提及（L1）仅作参考，不参与计分。
  </div>`;
}

/** 页面骨架（hero + 各节卡片 + 页脚） */
function pageShell(args: {
  eyebrow: string;
  title: string;
  sub: string;
  meta: [string, string][];
  sections: string;
  footerHtml: string;
  docTitle: string;
}): string {
  const meta = args.meta.map(([k, v]) => `<span>${esc(k)}：<b>${esc(v)}</b></span>`).join("\n      ");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(args.docTitle)}</title>
<style>${REPORT_CSS}${PERIOD_CSS}</style>
</head>
<body>
<div class="container">

  <section class="hero">
    <div class="hero-eyebrow">${esc(args.eyebrow)}</div>
    <h1>${esc(args.title)}</h1>
    <div class="hero-sub">${esc(args.sub)}</div>
    <div class="hero-meta">
      ${meta}
    </div>
  </section>

${args.sections}

  ${args.footerHtml}

</div>
</body>
</html>`;
}

/** 节卡片骨架（编号 + 标题 + 副述 + 内容） */
function section(num: string, title: string, desc: string, body: string): string {
  return `  <section class="card">
    <div class="sec-head"><span class="sec-num">${num}</span><span class="sec-title">${esc(title)}</span></div>
    ${desc ? `<div class="sec-desc">${esc(desc)}</div>` : ""}
    ${body}
  </section>`;
}

const PLATFORM_META = `豆包、DeepSeek、通义千问`;

function poolText(d: PeriodReportData): string {
  return `${d.pool.active} 词${d.pool.extended > 0 ? `（另有可拓 ${d.pool.extended} 词单列观察）` : ""}`;
}

/* ------------------------------------------------------------------ 周报 */

export function renderWeeklyHtml(d: PeriodReportData): string {
  const kpi = d.kpi;
  const hitCount = d.words.filter((w) => w.l2 > 0).length;
  const delta = deltaSub(kpi.delta);
  // 一句话周结论（全部由真实数据拼装）
  const conclusion =
    kpi.total === 0
      ? "本周暂无实测记录，无法形成结论，请先完成采集。"
      : `本周官网引用呈现率 ${kpi.citationRate}%，环比上周 ${kpi.delta >= 0 ? "+" : ""}${kpi.delta.toFixed(1)}pt；${d.words.length} 个生效词中 ${hitCount} 个保持官网来源命中。`;

  // 01 本周速览：大数字卡
  const s01 = section(
    "01",
    "本周速览",
    "覆盖三平台的官网引用实测汇总，引用呈现率 = 官网来源命中 ÷ 实测总数（不含可拓词）。",
    `<div class="big-grid">
      <div class="big-card"><div class="b-label">本周引用呈现率</div><div class="b-val">${kpi.citationRate}<small>%</small></div><div class="b-sub ${delta.cls}">${delta.text}</div></div>
      <div class="big-card"><div class="b-label">环比上周</div><div class="b-val">${kpi.prevRate}<small>%</small></div><div class="b-sub flat">上周同期均值</div></div>
      <div class="big-card"><div class="b-label">实测总次数</div><div class="b-val">${kpi.total}<small>次</small></div><div class="b-sub flat">L2 ${kpi.l2} / L1 ${kpi.l1}</div></div>
      <div class="big-card"><div class="b-label">完成采集天数</div><div class="b-val">${d.health.fullDays}<small> / ${d.health.plannedDays} 天</small></div><div class="b-sub flat">${d.health.avgRate === null ? "本期无计划采集日" : `平均完成率 ${d.health.avgRate}%`}</div></div>
    </div>
    <div class="verdict"><b>周结论：</b>${esc(conclusion)}</div>`,
  );

  // 02 引用变化：逐日折线 + 三平台对比条
  const line =
    d.daily.length === 0
      ? EMPTY
      : lineChartSvg(d.daily.map((p) => ({ label: p.date.slice(5), rate: p.total > 0 ? p.rate : null }))) +
        `<div class="chart-note">本周逐日引用率走势（当日无实测则断点）；虚线为 30% / 50% 参考线</div>`;
  const platBars =
    d.byPlatform.every((p) => p.total === 0)
      ? EMPTY
      : d.byPlatform
          .map((p) => {
            const prevTxt = p.prevRate === null ? "上周无实测" : `上周 ${p.prevRate}%`;
            return `<div class="plat-row">
        <span class="p-name">${esc(p.label)}</span>
        <span class="p-track"><i class="p-fill" style="width:${Math.min(100, p.rate)}%"></i></span>
        <span class="p-val"><b>${p.rate}%</b> · ${p.total} 次 · ${prevTxt}</span>
      </div>`;
          })
          .join("");
  const s02 = section(
    "02",
    "引用变化",
    "本周逐日引用率走势与三平台分列对比；分平台差距用于定位短板平台。",
    `${line}<div style="margin-top:22px">${platBars}</div>`,
  );

  // 03 词级命中明细（✓✗ 格 / 周引用率 / 趋势箭头；品牌提及仅参考列）
  const s03 = section(
    "03",
    "词级命中明细",
    "✓ = 该平台本周有官网来源命中，✗ = 有实测但未命中，— = 未实测；趋势为本期与上周引用率对比；品牌提及仅作参考，不参与计分。",
    wordTable(d.words, null),
  );

  // 04 异常与预警
  const s04 = section(
    "04",
    "异常与预警",
    "连续缺采、引用率骤降、平台异常的自动巡检结果。",
    d.alerts.length === 0
      ? `<div class="ok-box">本周无异常：采集完整、引用率无骤降、三平台数据链路正常。</div>`
      : d.alerts.map((a) => `<div class="alert-box">${esc(a)}</div>`).join(""),
  );

  // 05 下周行动建议
  const s05 = section(
    "05",
    "下周行动建议",
    "基于本周实测数据生成的执行层建议。",
    d.suggestions.length === 0
      ? EMPTY
      : `<ul class="sug-list">${d.suggestions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`,
  );

  return pageShell({
    eyebrow: "Weekly GEO Monitor",
    title: `${d.project.name}官网引用监测周报`,
    sub: "面向 AI 搜索生态的官网引用周度监测 —— 三平台实测、词级命中与异常巡检",
    meta: [
      ["监测周期", `${d.label}（${d.from} ~ ${d.to}）`],
      ["监测平台", PLATFORM_META],
      ["词库规模", poolText(d)],
      ["编制方", "清蓝官网GEO项目组"],
    ],
    sections: [s01, s02, s03, s04, s05].join("\n\n"),
    footerHtml: footer(d, false),
    docTitle: `${d.project.name}官网引用监测周报-${d.from}`,
  });
}

/* ------------------------------------------------------------------ 月报 */

export function renderMonthlyHtml(d: PeriodReportData): string {
  const kpi = d.kpi;
  const target = kpiTargetForMonths(d.project.serviceMonths);
  const delta = deltaSub(kpi.delta);

  // 01 月度总览（达标词数：3 个月项目无考核 → 按交付物验收）
  const targetCard =
    target === null
      ? `<div class="big-card"><div class="b-label">考核口径</div><div class="b-val" style="font-size:20px;line-height:1.4">按交付物验收</div><div class="b-sub flat">3 个月周期无指标考核</div></div>`
      : `<div class="big-card"><div class="b-label">达标词数（≥${target}%）</div><div class="b-val">${d.targetMetWords ?? 0}<small> / ${kpi.activeWords} 词</small></div><div class="b-sub flat">考核目标：官网引用率 ≥${target}%</div></div>`;
  const s01 = section(
    "01",
    "月度总览",
    "本月官网引用监测核心指标汇总，环比对象为上个月同期。",
    `<div class="big-grid">
      <div class="big-card"><div class="b-label">月均引用呈现率</div><div class="b-val">${kpi.citationRate}<small>%</small></div><div class="b-sub ${delta.cls}">${delta.text}（上月 ${kpi.prevRate}%）</div></div>
      ${targetCard}
      <div class="big-card"><div class="b-label">实测记录数</div><div class="b-val">${kpi.total}<small>条</small></div><div class="b-sub flat">L2 ${kpi.l2} / L1 ${kpi.l1} / 覆盖 ${kpi.hitWords} 词</div></div>
      <div class="big-card"><div class="b-label">采集完成率</div><div class="b-val">${d.health.avgRate === null ? "—" : `${d.health.avgRate}<small>%</small>`}</div><div class="b-sub flat">满格 ${d.health.fullDays} / ${d.health.plannedDays} 计划日</div></div>
    </div>`,
  );

  // 02 月度趋势：全月逐日折线 + 周均值柱
  const line =
    d.daily.length === 0
      ? EMPTY
      : lineChartSvg(d.daily.map((p) => ({ label: p.date.slice(8), rate: p.total > 0 ? p.rate : null }))) +
        `<div class="chart-note">全月逐日引用率（当日无实测则断点）；虚线为 30% / 50% 参考线</div>`;
  const weekBars =
    d.weeklyAvg.length === 0
      ? ""
      : `<div class="month-bars">${d.weeklyAvg
          .map(
            (w) => `<div class="mb">
          <div class="mv">${w.rate}%</div>
          <div class="col" style="height:${Math.max(4, (w.rate / 100) * 110)}px"></div>
          <div class="ml">${esc(w.label)}</div>
        </div>`,
          )
          .join("")}</div>
        <div class="chart-note">周均值柱（按自然周聚合本月实测）</div>`;
  const s02 = section(
    "02",
    "月度趋势",
    "全月逐日引用率与周均值对照，用于观察月内节奏与波动。",
    `${line}<div style="margin-top:18px">${weekBars}</div>`,
  );

  // 03 词库表现：逐词月榜（引用率排序 + 达标色点）+ 可拓词观察
  const rankPills =
    target === null
      ? ""
      : `<p style="font-size:13px;color:var(--text-3);margin-bottom:6px">色点口径：本期引用率 ≥${target}% 记达标。</p>`;
  const extNote =
    d.pool.extended === 0
      ? ""
      : d.extendedWords.length === 0
        ? `<p class="empty-note">可拓词 ${d.pool.extended} 个本月暂无实测记录，继续观察。</p>`
        : `<table class="ai-table">
          <thead><tr><th>可拓词（不计考核）</th><th>词类</th><th class="c">实测数</th><th class="c">引用率</th></tr></thead>
          <tbody>${d.extendedWords
            .map(
              (w) => `<tr><td>${esc(w.text)}</td><td>${CATEGORY_LABELS[w.category]}</td><td class="c">${w.total}</td><td class="c">${w.rate}%</td></tr>`,
            )
            .join("")}</tbody>
        </table>
        <p class="chart-note">可拓词单列观察、不计入考核分母，连续两月稳定命中可考虑转正式词。</p>`;
  const s03 = section(
    "03",
    "词库表现月榜",
    "逐词本月引用率排序（✓✗ 为三平台命中格；品牌提及仅作参考列）。",
    `${rankPills}${wordTable(d.words, target)}${d.pool.extended > 0 ? `<h4 style="font-size:15px;font-weight:700;margin:20px 0 8px">可拓词观察</h4>${extNote}` : ""}`,
  );

  // 04 竞对格局：SOV + 失守词（无竞对配置 → 本期暂无数据）
  const s04 = section(
    "04",
    "竞对格局",
    "AI 回答中的品牌声量份额（SOV）与头对头失守词；竞对数据仅作对比，不计入官网考核。",
    d.compete === null
      ? EMPTY
      : `<h4 style="font-size:15px;font-weight:700;margin-bottom:8px">SOV 声量份额</h4>
        ${sovTable(d.compete.sov)}
        <h4 style="font-size:15px;font-weight:700;margin:22px 0 8px">失守词清单</h4>
        ${losingWordsTable(d.compete.losingWords)}`,
  );

  // 05 内容表现：官网被引页面 TOP 榜
  const s05 = section(
    "05",
    "被引页面 TOP 榜",
    "本月被 AI 引用最多的官网页面（仅统计官网自身页面，按引用次数排序）。",
    d.topPages.length === 0
      ? EMPTY
      : `<table class="ai-table">
        <thead><tr><th class="c">#</th><th>官网页面</th><th class="c">引用次数</th><th class="c">占官网被引比</th></tr></thead>
        <tbody>${d.topPages
          .map(
            (p, i) => `<tr>
          <td class="c">${i + 1}</td>
          <td>${esc(p.title ?? p.url)}<br><span style="font-size:12px;color:var(--text-4)">${esc(p.url)}</span></td>
          <td class="c"><b>${p.count}</b></td>
          <td class="c">${p.share}%</td>
        </tr>`,
          )
          .join("")}</tbody>
      </table>`,
  );

  // 06 环比与下月建议
  const l2DeltaPct = kpi.prevL2 > 0 ? Math.round(((kpi.l2 - kpi.prevL2) / kpi.prevL2) * 1000) / 10 : null;
  const momPoints = [
    `引用呈现率 ${kpi.citationRate}%（上月 ${kpi.prevRate}%，${kpi.delta >= 0 ? "+" : ""}${kpi.delta.toFixed(1)}pt）。`,
    `官网来源命中 ${kpi.l2} 次（上月 ${kpi.prevL2} 次${l2DeltaPct === null ? "" : `，${l2DeltaPct >= 0 ? "+" : ""}${l2DeltaPct}%`}）。`,
    `意向词覆盖 ${kpi.hitWords}/${kpi.activeWords} 词（覆盖率 ${kpi.coverageRate}%）。`,
  ];
  const s06 = section(
    "06",
    "环比要点与下月建议",
    "与上月同期的关键指标环比，以及下月执行建议。",
    `<ul class="sug-list">${momPoints.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
     <h4 style="font-size:15px;font-weight:700;margin:20px 0 8px">下月行动建议</h4>
     ${d.suggestions.length === 0 ? EMPTY : `<ul class="sug-list">${d.suggestions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`}`,
  );

  return pageShell({
    eyebrow: "Monthly GEO Report",
    title: `${d.project.name}官网引用监测月报`,
    sub: "面向 AI 搜索生态的官网引用月度复盘 —— 达成总览、趋势研判、词库月榜与竞对格局",
    meta: [
      ["监测月份", d.label],
      ["监测平台", PLATFORM_META],
      ["词库规模", poolText(d)],
      ["编制方", "清蓝官网GEO项目组"],
    ],
    sections: [s01, s02, s03, s04, s05, s06].join("\n\n"),
    footerHtml: footer(d, false),
    docTitle: `${d.project.name}官网引用监测月报-${d.from.slice(0, 7)}`,
  });
}

/* ------------------------------------------------------------------ 季报 */

/** 交付物验收清单（勾选态来自平台真实导出就绪状态；周期报告以本报告已生成计 ✓） */
function deliverablesChecklist(d: PeriodReportData): string {
  if (!d.deliverables) return EMPTY;
  const items: { label: string; ok: boolean; missing: string[] }[] = [
    { label: "官网 GEO 诊断报告", ok: d.deliverables.report.ok, missing: d.deliverables.report.missing },
    { label: "诊断评分与依据底稿", ok: d.deliverables.workbook.ok, missing: d.deliverables.workbook.missing },
    { label: "官网优化项目排期总表", ok: d.deliverables.schedule.ok, missing: d.deliverables.schedule.missing },
    { label: "GEO 服务报价单", ok: d.deliverables.quote.ok, missing: d.deliverables.quote.missing },
    { label: "周期监测报告（周报 / 月报 / 季报）", ok: true, missing: [] },
  ];
  return `<ul class="check-list">${items
    .map(
      (it) => `<li>
      <span class="ck ${it.ok ? "ok" : "no"}">${it.ok ? "✓" : "✗"}</span>
      <span>${esc(it.label)}${it.ok ? "" : `<span style="color:var(--text-4);font-size:12.5px">（待补齐：${esc(it.missing.join("；"))}）</span>`}</span>
    </li>`,
    )
    .join("")}</ul>`;
}

export function renderQuarterlyHtml(d: PeriodReportData): string {
  const kpi = d.kpi;
  const target = kpiTargetForMonths(d.project.serviceMonths);
  // 季度月均引用率：有实测月份的均值（无实测月份不计）
  const validMonths = d.monthly.filter((m) => m.total > 0);
  const monthAvg =
    validMonths.length > 0
      ? Math.round((validMonths.reduce((s, m) => s + m.rate, 0) / validMonths.length) * 10) / 10
      : kpi.citationRate;

  // 01 阶段成果 vs 考核目标
  const cardsHtml = `<div class="big-grid">
      <div class="big-card"><div class="b-label">季度引用呈现率</div><div class="b-val">${kpi.citationRate}<small>%</small></div><div class="b-sub ${deltaSub(kpi.delta).cls}">${deltaSub(kpi.delta).text}（上季 ${kpi.prevRate}%）</div></div>
      <div class="big-card"><div class="b-label">季度月均引用率</div><div class="b-val">${monthAvg}<small>%</small></div><div class="b-sub flat">${validMonths.length} 个月有实测</div></div>
      <div class="big-card"><div class="b-label">词库完成词数</div><div class="b-val">${kpi.hitWords}<small> / ${kpi.activeWords} 词</small></div><div class="b-sub flat">期内至少 1 次官网来源命中</div></div>
      <div class="big-card"><div class="b-label">实测记录数</div><div class="b-val">${kpi.total}<small>条</small></div><div class="b-sub flat">L2 ${kpi.l2} / L1 ${kpi.l1}</div></div>
    </div>`;
  const s01Body =
    target === null
      ? `${cardsHtml}
        <div class="verdict" style="margin-top:18px"><b>考核口径：</b>本项目为 ${d.project.serviceMonths} 个月服务周期，无指标考核，按交付物清单验收。</div>
        <h4 style="font-size:15px;font-weight:700;margin:18px 0 4px">交付物验收清单</h4>
        ${deliverablesChecklist(d)}`
      : `${cardsHtml}
        <div style="margin-top:20px">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-2)">
            <span><b>考核目标：官网引用率 ≥${target}%</b>（验收线 ${Math.round(target * 0.8)}%）</span>
            <span>当前进度 ${kpi.citationRate}% / ${target}%</span>
          </div>
          <div class="progress"><i style="width:${Math.min(100, (kpi.citationRate / target) * 100)}%"></i></div>
          <div class="progress-meta"><span>0%</span><span>验收线 ${Math.round(target * 0.8)}%</span><span>目标 ${target}%</span></div>
        </div>`;
  const s01 = section(
    "01",
    "阶段成果与考核目标",
    `服务周期进度：第 ${d.service.monthIndex} 月 / 共 ${d.service.totalMonths} 月；${target === null ? "3 个月周期无指标考核，按交付物清单验收。" : `考核口径：官网引用率 ≥${target}%。`}`,
    s01Body,
  );

  // 02 季度趋势研判：三月叠加 + 拐点归因
  let s02Body: string;
  if (d.monthly.every((m) => m.total === 0)) {
    s02Body = EMPTY;
  } else {
    const bars = `<div class="month-bars">${d.monthly
      .map(
        (m) => `<div class="mb">
        <div class="mv">${m.total > 0 ? `${m.rate}%` : "—"}</div>
        <div class="col" style="height:${m.total > 0 ? Math.max(4, (m.rate / 100) * 110) : 4}px;${m.total > 0 ? "" : "background:#ececf0;"}"></div>
        <div class="ml">${esc(m.label)}</div>
      </div>`,
      )
      .join("")}</div>
      <div class="chart-note">季度内三月引用率叠加（无实测月份以灰柱占位）</div>`;
    // 拐点归因：逐月环比 + 最大变动月
    const notes: string[] = d.monthly.map((m) =>
      m.total === 0
        ? `${m.label}：本期暂无数据。`
        : `${m.label}：官网引用率 ${m.rate}%（${m.total} 次实测）${m.delta === null ? "" : `，较上月 ${m.delta >= 0 ? "+" : ""}${m.delta.toFixed(1)}pt`}。`,
    );
    const movers = d.monthly.filter((m) => m.delta !== null);
    if (movers.length > 0) {
      const turn = [...movers].sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0]!;
      notes.push(
        `关键拐点出现在 ${turn.label}（${turn.delta! >= 0 ? "+" : ""}${turn.delta!.toFixed(1)}pt），建议结合当月官网内容产出与平台侧波动复盘。`,
      );
    }
    s02Body = `${bars}<ul class="sug-list" style="margin-top:16px">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
  }
  const s02 = section(
    "02",
    "季度趋势研判",
    "季度内三个月官网引用率走势叠加与拐点归因。",
    s02Body,
  );

  // 03 竞对格局演变
  let s03Body: string;
  if (d.compete === null) {
    s03Body = EMPTY;
  } else {
    const shareNote =
      d.compete.ownShareDelta === null
        ? ""
        : `<div class="verdict" style="margin:14px 0 0"><b>份额环比：</b>官网声量份额较上季 ${d.compete.ownShareDelta >= 0 ? "+" : ""}${d.compete.ownShareDelta.toFixed(1)}pt。</div>`;
    const regained =
      d.compete.regainedWords.length === 0
        ? `<p class="empty-note">本季无收复词记录。</p>`
        : `<ul class="sug-list">${d.compete.regainedWords
            .map((w) => `<li>「${esc(w.text)}」（${CATEGORY_LABELS[w.category]}）：官网引用率回到 ${w.ownRate}%，不再失守。</li>`)
            .join("")}</ul>`;
    s03Body = `<h4 style="font-size:15px;font-weight:700;margin-bottom:8px">SOV 声量份额（本季）</h4>
      ${sovTable(d.compete.sov)}
      ${shareNote}
      <h4 style="font-size:15px;font-weight:700;margin:22px 0 8px">失守词（本季竞对占优）</h4>
      ${losingWordsTable(d.compete.losingWords)}
      <h4 style="font-size:15px;font-weight:700;margin:22px 0 8px">收复词（上季失守、本季收复）</h4>
      ${regained}`;
  }
  const s03 = section(
    "03",
    "竞对格局演变",
    "季度声量份额变化与失守/收复词清单；竞对数据仅作对比，不计入官网考核。",
    s03Body,
  );

  // 04 下季规划（只方向不施工细节）
  const s04 = section(
    "04",
    "下季规划",
    "方向性建议，具体实施方案由双方团队专项对接。",
    d.suggestions.length === 0
      ? EMPTY
      : `<ul class="sug-list">${d.suggestions.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
         <div class="dir-note">说明：本节仅给出优化方向，不展开施工细节；具体技术实施方案由我方团队与贵司专项对接。</div>`,
  );

  // 05 验收对齐（仅周期末季）
  let s05 = "";
  if (d.service.isFinalQuarter) {
    const body =
      target === null
        ? `<div class="verdict"><b>复测结论：</b>本项目为 ${d.project.serviceMonths} 个月服务周期，无指标考核，按交付物清单验收；以下为交付物就绪状态。</div>
           <h4 style="font-size:15px;font-weight:700;margin:18px 0 4px">验收材料清单</h4>
           ${deliverablesChecklist(d)}`
        : `<div class="verdict"><b>复测结论：</b>考核口径为官网引用率 ≥${target}%（验收线 ${Math.round(target * 0.8)}%）；本季官网引用呈现率 ${kpi.citationRate}%，考核状态：${KPI_STATUS_LABELS[kpi.kpiStatus]}（以考核节点单日实测口径为准）。</div>
           <h4 style="font-size:15px;font-weight:700;margin:18px 0 4px">验收材料清单</h4>
           ${deliverablesChecklist(d)}`;
    s05 = section(
      "05",
      "验收对齐",
      "本季为服务周期末季，以下为考核口径复测结论与验收材料清单。",
      body,
    );
  }

  return pageShell({
    eyebrow: "Quarterly GEO Review",
    title: `${d.project.name}GEO 服务季度复盘`,
    sub: "面向 AI 搜索生态的官网引用季度复盘 —— 阶段成果、趋势研判、竞对格局与验收对齐",
    meta: [
      ["复盘季度", d.label],
      ["服务周期进度", `第 ${d.service.monthIndex} 月 / 共 ${d.service.totalMonths} 月`],
      ["词库规模", poolText(d)],
      ["编制方", "清蓝官网GEO项目组"],
    ],
    sections: [s01, s02, s03, s04, s05].filter(Boolean).join("\n\n"),
    footerHtml: footer(d, true),
    docTitle: `${d.project.name}GEO服务季度复盘-${d.label.replaceAll(" ", "")}`,
  });
}

/** 按类型分发渲染 */
export function renderPeriodReportHtml(d: PeriodReportData): string {
  if (d.type === "week") return renderWeeklyHtml(d);
  if (d.type === "month") return renderMonthlyHtml(d);
  return renderQuarterlyHtml(d);
}
