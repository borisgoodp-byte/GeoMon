/**
 * 《<品牌>官网优化项目排期总表.html》模板（版式 = assets/schedule-template.html，保研岛版式）
 * 三阶段模型：P1 技术诊断+官网改造（约 M1）/ P2 内容生态（约 M2）/ P3 监测运营占满剩余周期、周期末验收。
 * 02 节：6/12 个月写 KPI 考核体系；3 个月改写为「交付物验收」（无指标考核）。排期表不写价格。
 */

import { esc, fmtMonth, SCHEDULE_CSS } from "./_shared";
import { kpiTargetForMonths } from "@contracts/kpi";
import type { DeliverableData } from "../services/deliverables";

/** startDate 起第 i 个月（0 起）的 "YYYY-MM" */
function monthAt(startDate: string, i: number): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + i);
  return d.toISOString().slice(0, 7);
}

/** 甘格列头：M1 9月 … Mn（标实际月份） */
function monthColLabel(startDate: string, i: number): string {
  return `M${i + 1} ${Number(monthAt(startDate, i).slice(5, 7))}月`;
}

function ganttCell(cls: string, text: string): string {
  return `<td><div class="gantt-cell ${cls}">${text}</div></td>`;
}
const EMPTY = `<td><span class="gantt-empty">—</span></td>`;

export function renderScheduleHtml(data: DeliverableData): string {
  const { project } = data;
  const months = project.serviceMonths ?? 12;
  const startDate = project.startDate ?? new Date().toISOString().slice(0, 10);
  const kpiTarget = kpiTargetForMonths(months);
  const endMonth = monthAt(startDate, months - 1);
  const today = new Date().toISOString().slice(0, 10);

  const cols = Array.from({ length: months }, (_, i) => `<th>${monthColLabel(startDate, i)}</th>`).join("");

  // 三阶段甘特行：P1 占 M1；P2 占 M2；P3 从 M3 起占满剩余周期（首格上线+监测，末格验收）
  const p1Cells = Array.from({ length: months }, (_, i) => (i === 0 ? ganttCell("gantt-p1", "全月") : EMPTY)).join("");
  const p2Cells = Array.from({ length: months }, (_, i) => (i === 1 ? ganttCell("gantt-p2", months === 3 ? "全月" : "约 2 周") : EMPTY)).join("");
  const p3Cells = Array.from({ length: months }, (_, i) => {
    if (i < 2) return EMPTY;
    if (months === 3) return ganttCell("gantt-p3", "上线+验收");
    if (i === 2) return ganttCell("gantt-p3", "上线+监测");
    if (i === months - 1) return ganttCell("gantt-p3", "验收");
    return ganttCell("gantt-p3", "持续");
  }).join("");

  // 报告节奏行：周报/月报从监测启动月（M3）起；季报每 3 个月；验收在末月
  const weekly = Array.from({ length: months }, (_, i) => (i >= 2 ? ganttCell("gantt-p3-light", "每周") : EMPTY)).join("");
  const monthly = Array.from({ length: months }, (_, i) => (i >= 2 ? ganttCell("gantt-p3-light", `月报${i - 1}`) : EMPTY)).join("");
  const quarterly = Array.from({ length: months }, (_, i) => ((i + 1) % 3 === 0 && i >= 2 ? ganttCell("gantt-p3", `季报${Math.floor((i + 1) / 3)}`) : EMPTY)).join("");
  const acceptance = Array.from({ length: months }, (_, i) => (i === months - 1 ? ganttCell("gantt-p1", "验收") : EMPTY)).join("");

  // 02 考核区：3 个月写交付物验收（无指标考核）；6/12 个月写 KPI 口径
  const kpiSection =
    kpiTarget === null
      ? `
    <div class="callout blue">
      <strong>交付物验收（本周期不设指标考核）：</strong>本项目为 ${months} 个月周期，按交付物清单逐项验收，无指标考核。各阶段交付物清单与验收方式如下：
      <ul>
        <li>Phase 1：技术诊断报告 1 份 + 官网改造优化数据包 1 套，改造页面按数据包完成上线、验证 Checklist 通过；</li>
        <li>Phase 2：GEO 内容指导包 1 套（内容战略地图、选题池、创作规范、FAQ 矩阵）+ 存量内容改造指导包 1 套，品牌方确认接收；</li>
        <li>Phase 3：上线内容与监测报告（周报/月报）按期交付，周期末提交最终交付清单。</li>
      </ul>
    </div>
    <div class="callout blue">
      <strong>验收规则：</strong>服务周期结束后 5 个工作日内提交最终验收报告与全量交付清单；交付物按清单逐项清点验收；验收通过后 15 个工作日内结清尾款。
    </div>`
      : `
    <div class="kpi-big">
      <div class="k-left">
        <b>核心 KPI · 官网引用率</b>
        <p>签约时锁定固定词库（如 10 个用户决策词），每日在豆包 / DeepSeek / 通义千问三平台逐词提问，每个词单日累计检索 10 次；某次提问中任一平台回答里官网被引用或呈现（回答正文给出官网地址/链接，或引用来源列表包含官网页面；仅提及品牌不计）即计 1 次命中。单词官网引用率 = 单日被引用次数 ÷ 10 × 100%；单词引用率达到 ≥${kpiTarget}% 即计该词完成；词库完成词数 ÷ 词库总词数 × 100% ≥ 80% 即 KPI 达标。考核按任意一天的单日实测结果达标为准，提问与回答记录全部留档、可复现。</p>
      </div>
      <div class="k-num">0 词完成 → ≥80% 词完成<small> 单词引用率 ≥${kpiTarget}%</small></div>
    </div>

    <div class="kpi-row">
      <div class="kpi-item">
        <div class="k-name"><span class="tag tag-p1">A1</span> Phase 1 交付验收</div>
        <ul>
          <li>《技术诊断报告》1 份</li>
          <li>《官网改造优化数据包》1 套（方案/页面规范/结构化部署清单）</li>
          <li>改造页面按数据包完成上线，验证 Checklist 通过</li>
        </ul>
      </div>
      <div class="kpi-item">
        <div class="k-name"><span class="tag tag-p2">A2</span> Phase 2 交付验收</div>
        <ul>
          <li>《GEO 内容指导包》1 套（战略地图、选题池、创作规范、FAQ 矩阵）</li>
          <li>《存量内容改造指导包》1 套（体检清单、重构指引、批量优化建议）</li>
          <li>指导内容 100% 交付，品牌方确认接收</li>
        </ul>
      </div>
      <div class="kpi-item">
        <div class="k-name"><span class="tag tag-p3">A3</span> Phase 3 上线与监测</div>
        <ul>
          <li>GEO 优化内容与 FAQ 板块按节奏上线</li>
          <li>监测周报、月数据报告、季度复盘按期输出</li>
        </ul>
      </div>
    </div>

    <div class="callout blue">
      <strong>验收规则：</strong>服务周期结束后 5 个工作日内提交最终验收报告；核心 KPI 达成率 ≥80% 即视为项目验收合格；如 KPI 未达标，双方协商延展服务或部分退款；验收通过后 15 个工作日内结清尾款。
    </div>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(project.name)}官网优化项目排期总表</title>
<style>${SCHEDULE_CSS}</style>
</head>
<body>

<nav class="nav"><div class="nav-inner">
  <div class="nav-brand">清蓝 · GEO 项目排期</div>
  <div class="nav-links">
    <a href="#schedule">排期总表</a>
    <a href="#kpi">${kpiTarget === null ? "交付物验收" : "KPI 考核"}</a>
    <a href="#report">月期检测报告</a>
    <a href="#appendix">附录</a>
  </div>
</div></nav>

<div class="container">

  <div class="hero">
    <div class="hero-eyebrow">Project Schedule</div>
    <h1>${esc(project.name)}官网优化项目排期总表</h1>
    <p class="hero-sub">三阶段推进：第一阶段（第 1 个月）技术诊断 + 官网改造（数据包），第二阶段（第 2 个月）内容生态（内容指导、板块建设），第三阶段内容上线与监测运营，周报 / 月报数据全程覆盖。</p>
    <div class="hero-meta">
      <span>客户官网 <b>${esc(project.domain)}</b></span>
      <span class="sep"></span>
      <span>服务周期 <b>${months} 个月（${monthAt(startDate, 0)} — ${endMonth}）</b></span>
      <span class="sep"></span>
      <span>编制方 <b>清蓝官网GEO项目组</b></span>
      <span class="sep"></span>
      <span>编制日期 <b>${fmtMonth(today)}</b></span>
    </div>
  </div>

  <!-- ================= 01 项目排期总表 ================= -->
  <div class="section" id="schedule">
    <div class="section-head">
      <div class="section-num">01</div>
      <div class="section-title">项目排期总表</div>
    </div>

    <div class="subsection">
      <div class="sub-title">1.1 总览甘特</div>
      <div class="gantt-card">
        <div class="gantt-scene-label">${months} 个月服务周期（${monthAt(startDate, 0)} — ${endMonth}）<span class="badge">三阶段</span></div>
        <div class="gantt-table-wrap">
          <table class="gantt-table">
            <thead><tr><th>阶段</th>${cols}</tr></thead>
            <tbody>
              <tr>
                <td><span class="tag tag-p1">Phase 1</span> 技术诊断 + 官网改造（数据包）</td>
                ${p1Cells}
              </tr>
              <tr>
                <td><span class="tag tag-p2">Phase 2</span> 内容生态（内容指导 / 板块建设）</td>
                ${p2Cells}
              </tr>
              <tr>
                <td><span class="tag tag-p3">Phase 3</span> 内容上线 + 监测运营</td>
                ${p3Cells}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="gantt-card">
        <div class="gantt-scene-label">数据与报告节奏：第三阶段起持续输出<span class="badge">报告节奏</span></div>
        <div class="gantt-table-wrap">
          <table class="gantt-table">
            <thead><tr><th>报告</th>${cols}</tr></thead>
            <tbody>
              <tr><td><span class="tag tag-teal">周报</span> 监测报告（每周一）</td>${weekly}</tr>
              <tr><td><span class="tag tag-orange">月报</span> 月数据报告（每月末）</td>${monthly}</tr>
              <tr><td><span class="tag tag-red">季报</span> 季度复盘</td>${quarterly}</tr>
              <tr><td><span class="tag tag-p1">验收</span> 最终验收数据包</td>${acceptance}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="subsection">
      <div class="sub-title">1.2 节点排期明细</div>

      <div class="phase-block p1">
        <div class="phase-header">
          <span class="tag tag-p1">Phase 1</span>
          <h4>技术诊断与官网改造</h4>
          <span class="duration">第 1 个月</span>
        </div>
        <div class="table-wrap"><div class="tbl-wrap">
          <table>
            <thead><tr><th>序号</th><th>工作项</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td>1.1</td><td>官网技术诊断（18 项指标实测评分）</td><td>输出《技术诊断报告》，诊断结论即改造数据包依据</td></tr>
              <tr><td>1.2</td><td>官网改造核心（页面规范、结构化数据、商业页升级）</td><td>按诊断数据包推进，改造完成上线</td></tr>
              <tr><td>1.3</td><td>信息架构与板块规划</td><td>板块层级、内容流转路径、页面原型，需品牌方确认后定稿</td></tr>
            </tbody>
          </table>
        </div></div>
        <ul class="deliverables">
          <li><span class="icon">📦</span><span><b>《技术诊断报告》</b>（健康度评分、问题归因、优化机会矩阵）</span></li>
          <li><span class="icon">📦</span><span><b>《官网改造优化数据包》</b>（页面改造方案、结构化部署清单、页面升级 Brief、信息架构蓝图）</span></li>
        </ul>
      </div>

      <div class="phase-block p2">
        <div class="phase-header">
          <span class="tag tag-p2">Phase 2</span>
          <h4>内容生态建设（GEO 内容指导 + 存量内容改造指导）</h4>
          <span class="duration">第 2 个月</span>
        </div>
        <div class="table-wrap"><div class="tbl-wrap">
          <table>
            <thead><tr><th>序号</th><th>工作项</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td>2.1</td><td>GEO 内容指导（内容战略、选题池、创作规范、FAQ 矩阵设计）</td><td>输出《内容战略地图》《选题池与关键词矩阵》《创作 Brief 模板》、FAQ 内容矩阵</td></tr>
              <tr><td>2.2</td><td>存量内容改造指导（体检 + 重构指引 + 批量优化建议）</td><td>按潜力优先级输出存量内容体检清单与重构指引，供第三阶段执行上线</td></tr>
            </tbody>
          </table>
        </div></div>
        <ul class="deliverables">
          <li><span class="icon">📦</span><span><b>《GEO 内容指导包》</b>（内容战略地图、选题池与关键词矩阵、创作 Brief 模板、FAQ 内容矩阵）</span></li>
          <li><span class="icon">📦</span><span><b>《存量内容改造指导包》</b>（存量内容体检清单、重构指引、批量优化建议）</span></li>
        </ul>
      </div>

      <div class="phase-block p3">
        <div class="phase-header">
          <span class="tag tag-p3">Phase 3</span>
          <h4>内容上线与监测运营</h4>
          <span class="duration">M3 起，持续至周期末（共 ${months - 2} 个月）</span>
        </div>
        <div class="table-wrap"><div class="tbl-wrap">
          <table>
            <thead><tr><th>序号</th><th>工作项</th><th>说明</th></tr></thead>
            <tbody>
              <tr><td>3.1</td><td>内容板块上线与长文 / 重构稿发布</td><td>M3 起持续上线，含上线 30 天引用追踪；FAQ 板块上线</td></tr>
              <tr><td>3.2</td><td>监测报告（周报）</td><td>每周一输出；含引用变化、品牌提及、异常预警与行动建议</td></tr>
              <tr><td>3.3</td><td>月数据报告（月报）</td><td>每月末输出；含官网引用率、内容表现、环比分析与下月建议</td></tr>
              <tr><td>3.4</td><td>可见度与引用量监测（月度）</td><td>意图词 5 个持续监测；引用频次、位置、上下文全口径统计</td></tr>
              <tr><td>3.5</td><td>季度复盘与验收数据包</td><td>季度末复盘；周期末输出最终验收数据包（口径与基线一致、可复现）</td></tr>
            </tbody>
          </table>
        </div></div>
        <ul class="deliverables">
          <li><span class="icon">📦</span><span><b>上线内容</b>（GEO 优化长文、存量重构稿件、FAQ 内容板块）</span></li>
          <li><span class="icon">📦</span><span><b>《监测报告》</b>（周报，含关键指标变动雷达）</span></li>
          <li><span class="icon">📦</span><span><b>《月数据报告》</b>（含策略迭代建议）</span></li>
          <li><span class="icon">📦</span><span><b>《季度复盘报告》</b>与最终验收数据包</span></li>
        </ul>
      </div>
    </div>

    <div class="subsection">
      <div class="sub-title">1.3 工时总览</div>
      <div class="stat-grid">
        <div class="stat-card p1"><div class="val">约 1 个月</div><div class="label">Phase 1 · 技术诊断 + 官网改造</div></div>
        <div class="stat-card p2"><div class="val">约 1 个月</div><div class="label">Phase 2 · 内容生态建设</div></div>
        <div class="stat-card p3"><div class="val">${months - 2} 个月</div><div class="label">Phase 3 · 内容上线 + 监测运营</div></div>
      </div>
      <div class="table-wrap"><div class="tbl-wrap">
        <table>
          <thead><tr><th>阶段</th><th>工期</th><th>跨月</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td><span class="tag tag-p1">Phase 1</span> 技术诊断与官网改造</td><td>1 个月</td><td>M1</td><td>技术诊断先行，改造核心随后推进</td></tr>
            <tr><td><span class="tag tag-p2">Phase 2</span> 内容生态建设</td><td>1 个月</td><td>M2</td><td>GEO 内容指导 + 存量内容改造指导（并行）</td></tr>
            <tr><td><span class="tag tag-p3">Phase 3</span> 内容上线与监测运营</td><td>${months - 2} 个月</td><td>M3–M${months}</td><td>内容上线 + 周报/月报/季报监测</td></tr>
            <tr><td>项目管理与协同</td><td>贯穿</td><td>M1–M${months}</td><td>周会、对接、进度管理、验收组织</td></tr>
            <tr class="total-row"><td>合计</td><td>${months} 个月</td><td>M1–M${months}</td><td>—</td></tr>
          </tbody>
        </table>
      </div></div>
    </div>

    <div class="subsection">
      <div class="sub-title">1.4 前置资源需求</div>
      <div class="info-box">
        <strong>品牌方需配合提供：</strong>
        <ul>
          <li>官网 CMS / 后台管理权限（Phase 1 改造与 Phase 3 内容上线需使用）</li>
          <li>品牌手册、业务资料、产品与案例素材（Phase 1 诊断与 Phase 2 内容指导用）</li>
          <li>技术开发配合（按工单 3 个工作日内响应）；改造上线窗口于 M1 内确认</li>
          <li>考核词库与评分规则签约前双方确认（沿用诊断期实测基线）</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- ================= 02 考核与验收（6/12 个月 KPI 考核体系；3 个月交付物验收） ================= -->
  <div class="section" id="kpi">
    <div class="section-head">
      <div class="section-num">02</div>
      <div class="section-title">${kpiTarget === null ? "交付物验收" : "KPI 考核体系"}</div>
    </div>
    ${kpiSection}
  </div>

  <!-- ================= 03 月期检测报告 ================= -->
  <div class="section" id="report">
    <div class="section-head">
      <div class="section-num">03</div>
      <div class="section-title">月期检测报告</div>
    </div>
    <div class="subsection">
      <div class="sub-title">检测报告</div>
      <div class="table-wrap"><div class="tbl-wrap">
        <table>
          <thead><tr><th>报告类型</th><th>频率</th><th>核心内容</th><th>输出时间</th><th>接收方</th></tr></thead>
          <tbody>
            <tr><td><span class="tag tag-teal">监测报告</span> 周报</td><td>每周</td><td>引用变化、品牌提及、异常预警、本周行动建议</td><td>每周一</td><td>品牌方</td></tr>
            <tr><td><span class="tag tag-orange">月数据报告</span> 月报</td><td>每月</td><td>官网引用率、内容表现、环比分析、下月策略建议</td><td>每月末</td><td>品牌方</td></tr>
            <tr><td><span class="tag tag-red">季度复盘</span></td><td>每季度</td><td>阶段成果、行业趋势研判、下季度规划</td><td>季度末</td><td>品牌方管理层</td></tr>
            <tr><td><span class="tag tag-p1">最终验收报告</span></td><td>周期末</td><td>同口径复测结果、${kpiTarget === null ? "交付物清点" : "KPI 达标判定"}、全量交付清单</td><td>周期末后 5 个工作日内</td><td>品牌方</td></tr>
          </tbody>
        </table>
      </div></div>
      <div class="callout blue">
        <strong>基线依据：</strong>诊断期实测基线（${fmtMonth(data.diagnostic.diagnoseDate)}）：三平台三类提问官网引用情况以《${esc(project.name)}官网GEO诊断报告》速览表为准。所有监测与验收沿用同一词库与评分规则，结果可复现。
      </div>
    </div>
  </div>

  <!-- ================= 04 附录 ================= -->
  <div class="section" id="appendix">
    <div class="section-head">
      <div class="section-num">04</div>
      <div class="section-title">附录</div>
    </div>

    <div class="subsection">
      <div class="sub-title">后续运营交接清单</div>
      <ul class="deliverables">
        <li><span class="icon">📄</span><span><b>内容更新指引</b>——长文/FAQ/重构稿的上线、更新频率与发布规范，交接后品牌方可自行维护</span></li>
        <li><span class="icon">📄</span><span><b>季度自查清单</b>——官网引用率、内容上新、结构化数据健康度三项自查动作</span></li>
        <li><span class="icon">📄</span><span><b>报告解读说明</b>——周报/月报指标口径与阅读指南，含异常处理建议</span></li>
      </ul>
    </div>

    <div class="subsection">
      <div class="sub-title">各阶段交接产出物总结</div>
      <div class="table-wrap"><div class="tbl-wrap">
        <table>
          <thead><tr><th>阶段</th><th>交接产出物</th><th>交接时间</th><th>接收方</th></tr></thead>
          <tbody>
            <tr>
              <td rowspan="2" style="vertical-align:top"><span class="tag tag-p1">Phase 1</span><br />完成后</td>
              <td>📦 《技术诊断报告》（含诊断期实测基线）</td><td>Phase 1 验收时</td><td>品牌方</td>
            </tr>
            <tr><td>📦 《官网改造优化数据包》及完成改造的官网页面（线上可访问，含信息架构蓝图）</td><td>Phase 1 验收时</td><td>品牌方</td></tr>
            <tr>
              <td rowspan="2" style="vertical-align:top"><span class="tag tag-p2">Phase 2</span><br />完成后</td>
              <td>📦 《GEO 内容指导包》（内容战略地图、选题池、创作规范、FAQ 矩阵）</td><td>Phase 2 验收时</td><td>品牌方</td>
            </tr>
            <tr><td>📦 《存量内容改造指导包》（体检清单、重构指引、批量优化建议）</td><td>Phase 2 验收时</td><td>品牌方</td></tr>
            <tr>
              <td rowspan="3" style="vertical-align:top"><span class="tag tag-p3">Phase 3</span><br />持续</td>
              <td>📦 上线内容（GEO 优化长文、存量重构稿、FAQ 内容板块）</td><td>M3 起按节奏</td><td>品牌方</td>
            </tr>
            <tr><td>📦 《监测报告》（周报）与《月数据报告》（月报）</td><td>每周一 / 每月末</td><td>品牌方</td></tr>
            <tr><td>📦 《季度复盘报告》及最终验收数据包</td><td>季度末 / 周期末</td><td>品牌方管理层</td></tr>
          </tbody>
        </table>
      </div></div>
    </div>
  </div>

  <div class="footer">
    <div class="line"></div>
    更新日期：${fmtMonth(today)} ｜ 编制方：清蓝官网GEO项目组 ｜ 基线依据：《${esc(project.name)}官网GEO诊断报告》（${fmtMonth(data.diagnostic.diagnoseDate)}）
  </div>

</div>
</body>
</html>`;
}
