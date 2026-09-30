/**
 * 《<品牌>GEO服务报价单.html》模板（报价单沿用排期表同族卡片样式）
 * 依据 references/pricing.md（2026-09-04 定稿 + 2026-09-15 更正）：
 * - 三档周期套餐：3个月版 30,000 / 6个月版 60,000 / 12个月版 120,000（含税）
 * - 考核列：3个月版=「无指标考核，按交付物验收」、6个月版=≥30%、12个月版=≥50%
 * - 单项服务价 A–D 四类（名称已转写）+ 付款方式 50/30/20 + 服务承诺 + 验收标准
 */

import { esc, fmtMonth, SCHEDULE_CSS } from "./_shared";
import {
  PERIOD_PACKAGES,
  SINGLE_ITEMS,
  PAYMENT_TERMS,
  SERVICE_PROMISES,
  packageForMonths,
} from "@contracts/quote";
import type { DeliverableData } from "../services/deliverables";

function money(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function renderQuoteHtml(data: DeliverableData): string {
  const { project } = data;
  const months = project.serviceMonths ?? 12;
  const current = packageForMonths(months);
  const today = new Date().toISOString().slice(0, 10);

  // 三档周期套餐卡（当前周期高亮 recommended）
  const pkgCards = PERIOD_PACKAGES.map((p) => {
    const isCur = p.months === months;
    return `<div class="price-card${isCur ? " recommended" : ""}">
      <div class="p-name">${isCur ? "✦ " : ""}${p.name}${isCur ? "（本项目）" : ""}</div>
      <div class="p-price">¥${money(p.price)}<small> / ${p.months} 个月（含税）</small></div>
      <div class="p-kpi">考核：${esc(p.kpi)}</div>
      <ul>${p.services.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <ul style="margin-top:6px;"><li>赠送：${esc(p.gift)}</li></ul>
      <div class="p-scene">适用场景：${esc(p.scene)}</div>
    </div>`;
  }).join("\n");

  // 单项服务价 A–D 四类分组表
  const groups = ["A", "B", "C", "D"] as const;
  const groupTitles: Record<(typeof groups)[number], string> = {
    A: "A 类 · 技术诊断与评估（打包 3,000 元）",
    B: "B 类 · 官网改造优化（打包 30,000 元）",
    C: "C 类 · GEO 内容优化（价格面议，按需报）",
    D: "D 类 · 数据监测与报告（打包 1,000 元/月）",
  };
  const singleTables = groups
    .map((g) => {
      const rows = SINGLE_ITEMS.filter((it) => it.group === g)
        .map(
          (it) =>
            `<tr><td>${esc(it.name)}</td><td class="nowrap">${esc(it.unit)}</td><td class="nowrap"><span class="money">${it.price === null ? "面议" : it.price === 0 ? "免费" : `¥${money(it.price)}`}</span></td><td>${esc(it.desc)}</td></tr>`,
        )
        .join("");
      return `<div class="sub-sub-title">${groupTitles[g]}</div>
    <div class="table-wrap"><div class="tbl-wrap">
      <table>
        <thead><tr><th>项目</th><th>单位</th><th>价格（元，含税）</th><th>内容</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div></div>`;
    })
    .join("\n");

  // 验收标准：3 个月按交付物清单逐项验收；6/12 个月 KPI 达成率 ≥80%
  const acceptRule =
    current && current.months === 3
      ? "本项目为 3 个月周期，按交付物清单逐项验收，无指标考核"
      : `核心 KPI 达成率 ≥80% 即视为项目验收合格（${current?.kpi ?? ""}）`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(project.name)}GEO服务报价单</title>
<style>${SCHEDULE_CSS}</style>
</head>
<body>

<nav class="nav"><div class="nav-inner">
  <div class="nav-brand">清蓝 · GEO 服务报价</div>
  <div class="nav-links">
    <a href="#packages">周期套餐</a>
    <a href="#singles">单项服务价</a>
    <a href="#terms">付款与承诺</a>
    <a href="#acceptance">验收标准</a>
  </div>
</div></nav>

<div class="container">

  <div class="hero">
    <div class="hero-eyebrow">GEO Service Quotation</div>
    <h1>${esc(project.name)}GEO服务报价单</h1>
    <p class="hero-sub">按服务周期统一计费，周期越长、改造越深、考核目标越高。所有价格均为含税价（含增值税专用发票）。</p>
    <div class="hero-meta">
      <span>客户官网 <b>${esc(project.domain)}</b></span>
      <span class="sep"></span>
      <span>本项目周期 <b>${months} 个月（${current?.name ?? ""}）</b></span>
      <span class="sep"></span>
      <span>编制方 <b>清蓝官网GEO项目组</b></span>
      <span class="sep"></span>
      <span>编制日期 <b>${fmtMonth(today)}</b></span>
    </div>
  </div>

  <!-- ================= 01 三档周期套餐 ================= -->
  <div class="section" id="packages">
    <div class="section-head">
      <div class="section-num">01</div>
      <div class="section-title">周期套餐</div>
    </div>
    <div class="price-grid">
      ${pkgCards}
    </div>
    <div class="callout blue">
      <strong>版本说明：</strong>套餐周期内有效、不拆分转让；超出版本的内容按单项服务标准价计费；定制套餐与商务另行洽谈。
    </div>
  </div>

  <!-- ================= 02 单项服务价 ================= -->
  <div class="section" id="singles">
    <div class="section-head">
      <div class="section-num">02</div>
      <div class="section-title">单项服务价（超套餐范围或定制组合时用）</div>
    </div>
    ${singleTables}
  </div>

  <!-- ================= 03 付款方式与服务承诺 ================= -->
  <div class="section" id="terms">
    <div class="section-head">
      <div class="section-num">03</div>
      <div class="section-title">付款方式与服务承诺</div>
    </div>
    <div class="subsection">
      <div class="sub-title">付款方式</div>
      <ul class="deliverables">
        ${PAYMENT_TERMS.map((t) => `<li><span class="icon">💳</span><span>${esc(t)}</span></li>`).join("\n")}
      </ul>
    </div>
    <div class="subsection">
      <div class="sub-title">服务承诺</div>
      <ul class="deliverables">
        ${SERVICE_PROMISES.map((t) => `<li><span class="icon">✅</span><span>${esc(t)}</span></li>`).join("\n")}
      </ul>
    </div>
  </div>

  <!-- ================= 04 验收标准 ================= -->
  <div class="section" id="acceptance">
    <div class="section-head">
      <div class="section-num">04</div>
      <div class="section-title">验收标准</div>
    </div>
    <div class="callout blue">
      <strong>验收标准：</strong>
      <ul>
        <li>服务周期结束后 5 个工作日内提交最终验收报告</li>
        <li>${esc(acceptRule)}</li>
        <li>如未达验收标准，双方协商延展服务或部分退款</li>
        <li>验收通过后 15 个工作日内结清尾款</li>
        <li>最终交付物：所有优化内容、技术文档、数据报告、原版权限</li>
      </ul>
    </div>
    <div class="callout">
      以上所有价格均为含税价（含增值税专用发票）。报价有效期 30 天。
    </div>
  </div>

  <div class="footer">
    <div class="line"></div>
    编制日期：${fmtMonth(today)} ｜ 编制方：清蓝官网GEO项目组 ｜ 本报价单仅供 ${esc(project.company)} 内部评估使用
  </div>

</div>
</body>
</html>`;
}
