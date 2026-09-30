/**
 * 《<品牌>官网GEO诊断报告.html》模板（版式 = assets/report-template.html，IQAir 版式）
 * 数据全部来自平台真实诊断数据；日期纪律：报告日期精确到月、速览表实测日期精确到日。
 * 速览表列头逐字固定「决策词（品类推荐）/场景词（采购场景）/对比词（品牌对比）」；
 * 零引用格只写「官网零引用／正文与信源中均无官网」。
 */

import { esc, fmtMonth, bandOf, gradeOf, REPORT_CSS } from "./_shared";
import { DIMENSION_NAMES } from "@contracts/scoring";
import {
  VIS_PLATFORM_ORDER,
  VIS_WORD_TYPES,
  VIS_WORD_TYPE_LABELS,
  type VisTest,
} from "@contracts/vistest";
import { PLATFORM_LABELS } from "@contracts/kpi";
import type { DeliverableData } from "../services/deliverables";

/** 维度副标题（dim-head 色点旁） */
const DIM_SUBTITLES: Record<number, string> = {
  1: "基础能力与内容发现入口评估",
  2: "页面体系与语义规范评估",
  3: "内容资产与决策意图覆盖评估",
  4: "三平台官网引用实测评估",
};

/** 维度卡色点：技术蓝 / 页面紫 / 内容橙 / 可见度绿 */
const DIM_DOTS: Record<number, string> = {
  1: "#0071e3",
  2: "#5e5ce6",
  3: "#ff9f0a",
  4: "#30d158",
};

/** 取首句（到第一个句号） */
function firstSentence(text: string): string {
  const idx = text.indexOf("。");
  return idx >= 0 ? `${text.slice(0, idx)}。` : text;
}

/** 环形图换算：周长 389.56，dasharray = <389.56×总分/100> 389.56，rotate(-90 100 80) */
function gaugeSvg(composite: number): string {
  const C = 389.56;
  const arc = Math.round(C * (composite / 100) * 100) / 100;
  return `<svg viewBox="0 0 200 160" width="220" height="176">
    <circle cx="100" cy="80" r="62" fill="none" stroke="#ececf0" stroke-width="14"/>
    <circle cx="100" cy="80" r="62" fill="none" stroke="#0071e3" stroke-width="14" stroke-linecap="round" stroke-dasharray="${arc} ${C}" transform="rotate(-90 100 80)"/>
    <text x="100" y="82" text-anchor="middle" class="gauge-num" dominant-baseline="middle">${Math.round(composite)}</text>
  </svg>`;
}

/** 四维雷达：viewBox 300×300，中心 150,150，轴长 100，上技术/右内容/下页面/左可见度，网格环 25/50/75/100 */
function radarSvg(dims: { tech: number; arch: number; content: number; vis: number }): string {
  const pt = (axis: "up" | "right" | "down" | "left", s: number) => {
    const v = Math.max(0, Math.min(100, s));
    if (axis === "up") return [150, 150 - v] as const;
    if (axis === "right") return [150 + v, 150] as const;
    if (axis === "down") return [150, 150 + v] as const;
    return [150 - v, 150] as const;
  };
  const fmt = (n: number) => n.toFixed(1);
  const rings = [25, 50, 75, 100]
    .map((r) => {
      const [ux, uy] = pt("up", r);
      const [rx, ry] = pt("right", r);
      const [dx, dy] = pt("down", r);
      const [lx, ly] = pt("left", r);
      return `<polygon points="${fmt(ux)},${fmt(uy)} ${fmt(rx)},${fmt(ry)} ${fmt(dx)},${fmt(dy)} ${fmt(lx)},${fmt(ly)}" fill="none" stroke="#e8e8ed" stroke-width="1"/>`;
    })
    .join("");
  const axes = (
    [
      ["up", "技术底座", 150, 38],
      ["right", "内容生态", 262, 150],
      ["down", "页面架构", 150, 262],
      ["left", "GEO可见度", 38, 150],
    ] as const
  )
    .map(([axis, label, tx, ty]) => {
      const [x, y] = pt(axis, 100);
      return `<line x1="150" y1="150" x2="${fmt(x)}" y2="${fmt(y)}" stroke="#e8e8ed" stroke-width="1"/><text x="${tx}" y="${ty}" font-size="12" fill="#6e6e73" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
    })
    .join("");
  // 数据多边形：上技术 → 右内容 → 下页面 → 左可见度
  const data = [pt("up", dims.tech), pt("right", dims.content), pt("down", dims.arch), pt("left", dims.vis)];
  const points = data.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" ");
  const scores = [dims.tech, dims.content, dims.arch, dims.vis];
  const dots = data
    .map(([x, y], i) => {
      // 分数标注向轴内侧偏移，避免压线
      const lx = x + (x > 150 ? -14 : x < 150 ? 14 : 0);
      const ly = y + (y > 150 ? -14 : y < 150 ? 14 : 0);
      return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="3.5" fill="#0071e3"/><text x="${fmt(lx)}" y="${fmt(ly)}" font-size="13" font-weight="700" fill="#1d1d1f" text-anchor="middle">${scores[i]}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 300 300" width="300" height="300" role="img" aria-label="四维雷达图">${rings}${axes}<polygon points="${points}" fill="rgba(0,113,227,.14)" stroke="#0071e3" stroke-width="2"/>${dots}</svg>`;
}

/** 速览表单元格：主语永远是官网；零引用格只写固定话术 */
function gridCell(test: VisTest | undefined): string {
  if (!test || test.hit === null) {
    return `<td class="c"><span style="color:#86868b;font-weight:700;">— 待实测</span></td>`;
  }
  if (test.hit) {
    return `<td class="c"><span class="dotg">🟢 官网被引用</span><br><span style="font-size:12px;color:#6e6e73;">正文给出官网地址或来源含官网</span></td>`;
  }
  return `<td class="c"><span class="dotr">🔴 官网零引用</span><br><span style="font-size:12px;color:#6e6e73;">官网零引用／正文与信源中均无官网</span></td>`;
}

export function renderReportHtml(data: DeliverableData): string {
  const { project, diagnostic, findings, verdict, directions, visTests } = data;
  const composite = diagnostic.compositeScore ?? 0;
  const grade = gradeOf(composite);
  const monthLabel = fmtMonth(diagnostic.diagnoseDate);
  const dims = [
    { dim: 1 as const, score: diagnostic.techScore ?? 0 },
    { dim: 2 as const, score: diagnostic.archScore ?? 0 },
    { dim: 3 as const, score: diagnostic.contentScore ?? 0 },
    { dim: 4 as const, score: diagnostic.visScore ?? 0 },
  ];

  // 实测日期：取最后一次实测完成日（精确到日，只写一个）
  const testedDays = visTests
    .map((t) => t.testedAt)
    .filter((d): d is string => !!d)
    .sort();
  const testedAt = testedDays.length > 0 ? testedDays[testedDays.length - 1]! : null;

  // 01 综合健康度：环形图 + 等级章 + 2×2 dim-chips
  const chips = dims
    .map(({ dim, score }) => {
      const band = bandOf(score);
      return `<div class="chip"><div class="name">${DIMENSION_NAMES[dim]}</div><div class="val">${score}<small> /100 · ${band.label}</small></div><div class="bar"><i style="width:${score}%;background:${band.color};"></i></div></div>`;
    })
    .join("");

  // 综合结论：总起一句 → 技术/页面/内容/实测各一行 → 末行「核心判断：」
  const verdictHtml = verdict
    ? `<div class="verdict"><b>综合结论：</b>${esc(project.name)}官网综合健康度 ${composite} 分（${grade.text}），基于四大维度公开信息实测评估。<br>
      <b>1. 技术：</b>${esc(verdict.tech)}<br>
      <b>2. 页面：</b>${esc(verdict.pages)}<br>
      <b>3. 内容：</b>${esc(verdict.content)}<br>
      <b>4. 实测：</b>${esc(verdict.visibility)}<br>
      <b>核心判断：</b>${esc(verdict.core)}</div>`
    : `<div class="verdict"><b>综合结论：</b>综合结论尚未填写，请先完成「发现与结论」编辑。</div>`;

  // 02 速览表：行 = DeepSeek/豆包/通义千问，列头逐字固定
  const gridRows = VIS_PLATFORM_ORDER.map((platform) => {
    const cells = VIS_WORD_TYPES.map((wt) =>
      gridCell(visTests.find((t) => t.platform === platform && t.wordType === wt)),
    ).join("");
    return `<tr><td>${PLATFORM_LABELS[platform]}</td>${cells}</tr>`;
  }).join("");
  const gridSec = visTests.length > 0
    ? `<div class="sec-head" style="margin-top:30px;"><span class="sec-num">02</span><span class="sec-title">三平台官网可见度速览</span></div>
    <div class="sec-desc">实测时间：${testedAt ?? "待实测"}。围绕三类典型提问在豆包、DeepSeek、通义千问实测，逐格核验官网是否被引用或呈现——判定标准：回答正文给出官网地址/链接，或引用来源列表包含官网页面；仅提及品牌不计。</div>
    <table class="ai-table">
      <tr><th>平台</th><th class="c">${VIS_WORD_TYPE_LABELS.decision}</th><th class="c">${VIS_WORD_TYPE_LABELS.scenario}</th><th class="c">${VIS_WORD_TYPE_LABELS.compare}</th></tr>
      ${gridRows}
    </table>`
    : `<div class="sec-head" style="margin-top:30px;"><span class="sec-num">02</span><span class="sec-title">三平台官网可见度速览</span></div>
    <div class="sec-desc">尚未完成三平台实测（决策词/场景词/对比词 × 豆包、DeepSeek、通义千问）。</div>`;

  // 03 雷达 + radar-note（每维严格一句话）
  const noteOf = (dim: number): string => {
    if (!verdict) return "评分依据见下方维度卡发现。";
    const src =
      dim === 1 ? verdict.tech : dim === 2 ? verdict.pages : dim === 3 ? verdict.content : verdict.visibility;
    return firstSentence(src);
  };
  const radarNotes = dims
    .map(({ dim, score }) => `<li><b>${DIMENSION_NAMES[dim]} ${score}</b>：${esc(noteOf(dim))}</li>`)
    .join("");

  // 04–07 维度卡（dim-head + dim-bar + findings，不放子指标评分表）
  const sevBadge: Record<string, string> = { danger: "严重", warn: "待优化", ok: "亮点" };
  const dimCards = dims
    .map(({ dim, score }, i) => {
      const band = bandOf(score);
      const rows = findings.filter((f) => f.dimension === dim);
      const findingHtml = rows.length
        ? rows
            .map(
              (f) => `<div class="finding sev-${f.severity}">
        <div class="f-head"><span class="badge ${f.severity}">${sevBadge[f.severity]}</span><span class="f-title">${esc(f.title)}</span></div>
        <div class="f-body">${esc(f.body)}</div>
        <div class="f-impact"><b>业务影响：</b>${esc(f.impact)}</div>
      </div>`,
            )
            .join("")
        : `<div class="finding"><div class="f-body">该维度发现尚未填写。</div></div>`;
      return `<section class="card">
    <div class="sec-head"><span class="sec-num">0${i + 4}</span><span class="sec-title">维度${["一", "二", "三", "四"][i]} · ${DIMENSION_NAMES[dim]}</span></div>
    <div class="dim-head">
      <div class="dim-name"><span class="dot" style="background:${DIM_DOTS[dim]};"></span>${DIM_SUBTITLES[dim]}</div>
      <div class="dim-score" style="color:${band.color};">${score}<small> /100 · ${band.label}</small></div>
    </div>
    <div class="dim-bar"><i style="width:${score}%;background:${band.color};"></i></div>
    ${findingHtml}
  </section>`;
    })
    .join("\n");

  // 08 优化方向（2×2 d-card，短句分点，只写方向不写施工细节）
  const DIR_STEPS = ["方向一 · 固本", "方向二 · 立信", "方向三 · 扩声", "方向四 · 占位"];
  const dirHtml =
    directions && directions.length > 0
      ? directions
          .map((d, i) => {
            const [theme, rest] = d.title.includes("·")
              ? [d.title.split("·")[0]!.trim(), d.title.split("·").slice(1).join("·").trim()]
              : [d.title, ""];
            return `<div class="d-card">
        <div class="d-step">${DIR_STEPS[i] ?? `方向${i + 1}`}</div>
        <div class="d-title">${esc(rest || theme)}</div>
        <div class="d-body"><ul>${d.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></div>
      </div>`;
          })
          .join("")
      : `<div class="d-card"><div class="d-body">优化方向尚未填写。</div></div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(project.name)}官网GEO诊断报告</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="container">

  <section class="hero">
    <div class="hero-eyebrow">GEO Diagnostic Report</div>
    <h1>${esc(project.name)} 官网 GEO 诊断报告</h1>
    <div class="hero-sub">面向 AI 搜索生态的官网可见性诊断 —— 覆盖技术底座、页面架构、内容生态与 GEO 可见度四大维度</div>
    <div class="hero-meta">
      <span>诊断对象：<b>${esc(project.company)}</b></span>
      <span>官网：<b>${esc(project.domain)}</b></span>
      <span>所属行业：<b>${esc(project.industry)}</b></span>
      <span>诊断日期：<b>${monthLabel}</b></span>
    </div>
  </section>

  <section class="card">
    <div class="sec-head"><span class="sec-num">01</span><span class="sec-title">综合健康度总览</span></div>
    <div class="sec-desc">基于四大维度对官网进行公开信息实测评估，综合得分反映官网在 AI 搜索生态中的整体可见性水平。</div>
    <div class="score-grid">
      <div class="gauge-wrap">
        ${gaugeSvg(composite)}
        <div><span class="grade ${grade.cls}">${grade.text}</span></div>
      </div>
      <div class="dim-chips">
        ${chips}
      </div>
    </div>
    ${verdictHtml}
    ${gridSec}
  </section>

  <section class="card">
    <div class="sec-head"><span class="sec-num">03</span><span class="sec-title">四大维度评估画像</span></div>
    <div class="radar-flex">
      <div>${radarSvg({ tech: diagnostic.techScore ?? 0, arch: diagnostic.archScore ?? 0, content: diagnostic.contentScore ?? 0, vis: diagnostic.visScore ?? 0 })}</div>
      <ul class="radar-note">
        ${radarNotes}
      </ul>
    </div>
  </section>

  ${dimCards}

  <section class="card">
    <div class="sec-head"><span class="sec-num">08</span><span class="sec-title">优化方向与预期价值</span></div>
    <div class="sec-desc">结合诊断结论，建议按以下四个方向推进，由浅入深、先固基础再破决策场景。</div>
    <div class="dir">
      ${dirHtml}
    </div>
    <div class="dir-note">
      说明：本报告旨在呈现官网现状与优化方向。具体技术实施方案将由我方团队与贵司技术团队专项对接，并结合优化难度评估服务周期与投入。
    </div>
  </section>

  <div class="footer">
    <b>保密声明</b>：本报告基于诊断时点的公开信息实测生成，仅供贵司内部决策参考，未经许可不得转发第三方。<br>
    报告编制：清蓝官网GEO项目组 ｜ 报告日期：${monthLabel} ｜ 诊断数据保留备查
  </div>

</div>
</body>
</html>`;
}
