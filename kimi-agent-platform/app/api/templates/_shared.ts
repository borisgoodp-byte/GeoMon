/**
 * 导出模板共享层：CSS（照抄 assets 模板）、转义与格式化工具。
 * 所有导出物为单文件 HTML：内联 CSS、无外部依赖。
 */

/** HTML 转义（数据注入前必须过一遍） */
export function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** YYYY-MM-DD → 2026 年 9 月（报告日期只精确到月，硬规则 5） */
export function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  return `${y} 年 ${m} 月`;
}

/** YYYY-MM-DD 原样（速览表实测日期精确到日） */
export function fmtDay(iso: string | null | undefined): string {
  return iso ?? "—";
}

/** 维度分档位词与配色：≥80 优秀 / 65–79 良好 / 45–64 待提升 / <45 亟需优化 */
export function bandOf(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "优秀", color: "#1e7e34" };
  if (score >= 65) return { label: "良好", color: "#0071e3" };
  if (score >= 45) return { label: "待提升", color: "#c93400" };
  return { label: "亟需优化", color: "#ff3b30" };
}

/** 总分等级章 class（a/b/c/d）与文案 */
export function gradeOf(composite: number): { cls: "a" | "b" | "c" | "d"; text: string } {
  if (composite >= 80) return { cls: "a", text: "A 级 · 优秀" };
  if (composite >= 65) return { cls: "b", text: "B 级 · 良好" };
  if (composite >= 45) return { cls: "c", text: "C 级 · 待提升" };
  return { cls: "d", text: "D 级 · 亟需优化" };
}

/** 诊断报告 CSS（照抄 assets/report-template.html，IQAir 版式） */
export const REPORT_CSS = `
  :root{
    --bg:#f5f5f7;--surface:#ffffff;--text:#1d1d1f;--text-2:#424245;--text-3:#6e6e73;--text-4:#86868b;
    --blue:#0071e3;--blue-soft:#e8f1fd;--violet:#5e5ce6;--violet-soft:#ededfd;
    --orange:#ff9f0a;--orange-soft:#fff5e6;--green:#30d158;--green-soft:#e8fbed;
    --red:#ff3b30;--red-soft:#fff1f0;--border:#d2d2d7;--border-soft:#e8e8ed;
    --radius:18px;--radius-sm:12px;
    --shadow-sm:0 1px 3px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.03);
    --shadow:0 4px 24px rgba(0,0,0,.06),0 1px 4px rgba(0,0,0,.03);
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--text);line-height:1.65;font-size:15px;-webkit-font-smoothing:antialiased;letter-spacing:.01em;}
  .container{max-width:980px;margin:0 auto;padding:0 22px 80px;}
  .hero{text-align:center;padding:80px 22px 48px;}
  .hero-eyebrow{font-size:13px;font-weight:600;color:var(--blue);letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;}
  .hero h1{font-size:44px;font-weight:700;letter-spacing:-.025em;line-height:1.12;margin-bottom:18px;background:linear-gradient(180deg,#1d1d1f 0%,#424245 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
  .hero-sub{font-size:17px;color:var(--text-3);max-width:620px;margin:0 auto;line-height:1.5;}
  .hero-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 32px;margin-top:28px;font-size:13px;color:var(--text-4);}
  .hero-meta b{color:var(--text-2);font-weight:600;}
  .card{background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);padding:40px 44px;margin-bottom:28px;}
  .sec-head{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
  .sec-num{width:32px;height:32px;border-radius:10px;background:var(--blue-soft);color:var(--blue);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;}
  .sec-title{font-size:22px;font-weight:700;letter-spacing:-.01em;}
  .sec-desc{color:var(--text-3);font-size:14px;margin-bottom:26px;}
  .score-grid{display:grid;grid-template-columns:280px 1fr;gap:44px;align-items:center;}
  .gauge-wrap{text-align:center;}
  .gauge-num{font-size:52px;font-weight:700;letter-spacing:-.02em;}
  .gauge-label{font-size:12px;color:var(--text-4);letter-spacing:.15em;}
  .grade{display:inline-block;margin-top:12px;padding:5px 18px;border-radius:999px;font-size:14px;font-weight:600;}
  .grade.a{background:var(--green-soft);color:#1e7e34;}
  .grade.b{background:var(--blue-soft);color:var(--blue);}
  .grade.c{background:var(--orange-soft);color:#c93400;}
  .grade.d{background:var(--red-soft);color:var(--red);}
  .dim-chips{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .chip{border:1px solid var(--border-soft);border-radius:var(--radius-sm);padding:16px 18px;background:#fbfbfd;box-shadow:var(--shadow-sm);}
  .chip .name{font-size:13px;color:var(--text-3);margin-bottom:4px;}
  .chip .val{font-size:24px;font-weight:700;letter-spacing:-.02em;}
  .chip .val small{font-size:13px;color:var(--text-4);font-weight:400;}
  .bar{height:6px;border-radius:3px;background:#ececf0;margin-top:10px;overflow:hidden;}
  .bar i{display:block;height:100%;border-radius:3px;}
  .verdict{margin-top:28px;padding:20px 24px;border-radius:var(--radius-sm);font-size:15px;background:var(--blue-soft);color:var(--text-2);}
  .verdict b{color:var(--blue);}
  .radar-flex{display:grid;grid-template-columns:340px 1fr;gap:36px;align-items:center;}
  .radar-note{font-size:14px;color:var(--text-2);}
  .radar-note li{margin-bottom:12px;list-style:none;padding-left:22px;position:relative;}
  .radar-note li::before{content:"";position:absolute;left:0;top:9px;width:10px;height:10px;border-radius:3px;}
  .radar-note li:nth-child(1)::before{background:var(--blue);}
  .radar-note li:nth-child(2)::before{background:var(--violet);}
  .radar-note li:nth-child(3)::before{background:var(--orange);}
  .radar-note li:nth-child(4)::before{background:var(--red);}
  .radar-note b{color:var(--text);}
  .dim-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:6px;}
  .dim-name{font-size:17px;font-weight:700;display:flex;align-items:center;gap:10px;}
  .dim-name .dot{width:11px;height:11px;border-radius:4px;flex:none;}
  .dim-score{font-size:26px;font-weight:700;letter-spacing:-.02em;}
  .dim-score small{font-size:13px;color:var(--text-4);font-weight:400;}
  .dim-bar{height:8px;border-radius:4px;background:#ececf0;overflow:hidden;margin:14px 0 24px;}
  .dim-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--blue),var(--violet));}
  .finding{border:1px solid var(--border-soft);border-radius:var(--radius-sm);padding:18px 22px;margin-bottom:14px;background:var(--surface);box-shadow:var(--shadow-sm);}
  .finding.sev-danger{border-left:4px solid var(--red);}
  .finding.sev-warn{border-left:4px solid var(--orange);}
  .finding.sev-ok{border-left:4px solid var(--green);background:#fbfdfc;}
  .f-head{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
  .badge{font-size:12px;font-weight:600;padding:3px 11px;border-radius:999px;flex:none;}
  .badge.danger{background:var(--red-soft);color:var(--red);}
  .badge.warn{background:var(--orange-soft);color:#c93400;}
  .badge.ok{background:var(--green-soft);color:#1e7e34;}
  .f-title{font-weight:700;font-size:15px;}
  .f-body{font-size:14px;color:var(--text-2);}
  .f-impact{font-size:14px;margin-top:10px;padding:10px 14px;border-radius:10px;background:#f5f5f7;color:var(--text-2);}
  .f-impact b{color:var(--text);}
  .dir{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .d-card{border-radius:var(--radius-sm);padding:22px 24px;border:1px solid var(--border-soft);background:#fbfbfd;box-shadow:var(--shadow-sm);}
  .d-step{font-size:12px;font-weight:700;letter-spacing:.12em;color:var(--violet);margin-bottom:6px;}
  .d-title{font-weight:700;font-size:16px;margin-bottom:8px;letter-spacing:-.01em;}
  .d-body{font-size:14px;color:var(--text-2);}
  .d-body ul{padding-left:18px;}
  .d-body li{margin-bottom:6px;}
  .dir-note{margin-top:22px;padding:16px 20px;border-radius:var(--radius-sm);background:#f5f5f7;font-size:13px;color:var(--text-3);border:1px dashed var(--border);}
  .footer{text-align:center;color:var(--text-4);font-size:12.5px;line-height:2;padding-top:8px;}
  .footer b{color:var(--text-3);}
  table.ai-table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:14px;}
  table.ai-table th,table.ai-table td{border:1px solid var(--border-soft);padding:9px 12px;text-align:left;}
  table.ai-table th{background:#f5f5f7;font-weight:700;}
  table.ai-table td.c,table.ai-table th.c{text-align:center;}
  .dotg{color:#1e7e34;font-weight:700;}
  .dotr{color:#ff3b30;font-weight:700;}
  .valid{font-size:12px;color:var(--text-4);text-align:center;margin-top:18px;}
  @media (max-width:860px){
    .score-grid,.radar-flex,.dir{grid-template-columns:1fr;}
    .hero{padding:56px 22px 36px;}
    .hero h1{font-size:32px;}
    .card{padding:28px 22px;}
  }
  @media print{body{background:#fff;}.card{box-shadow:none;break-inside:avoid;}}
`;

/** 排期总表 CSS（照抄 assets/schedule-template.html，保研岛版式；报价单沿用同族卡片样式） */
export const SCHEDULE_CSS = `
:root {
  --bg:#f5f5f7; --surface:#ffffff;
  --text:#1d1d1f; --text-2:#424245; --text-3:#6e6e73; --text-4:#86868b;
  --blue:#0071e3; --blue-soft:#e8f1fd;
  --border:#d2d2d7; --border-soft:#e8e8ed;
  --p1:#5e5ce6; --p1-soft:#ededfd;
  --p2:#ff9f0a; --p2-soft:#fff5e6;
  --p3:#30d158; --p3-soft:#e8fbed;
  --red:#ff3b30; --orange:#ff9500; --yellow:#ffcc00; --teal:#5ac8fa;
  --radius:18px; --radius-sm:12px;
  --shadow-sm:0 1px 3px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.03);
  --shadow:0 4px 24px rgba(0,0,0,.06),0 1px 4px rgba(0,0,0,.03);
  --shadow-lg:0 12px 40px rgba(0,0,0,.08),0 2px 8px rgba(0,0,0,.03);
}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
html, body { overflow-x:hidden; }
body{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;
  background:var(--bg);color:var(--text);line-height:1.65;font-size:15px;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;letter-spacing:.01em;
}
.nav{position:sticky;top:0;z-index:100;background:rgba(245,245,247,.72);
  backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid rgba(0,0,0,.06);}
.nav-inner{max-width:980px;margin:0 auto;padding:0 22px;height:48px;display:flex;
  align-items:center;justify-content:space-between;font-size:13px;color:var(--text-3);}
.nav-brand{font-weight:600;color:var(--text);letter-spacing:-.01em;}
.nav-links{display:flex;gap:24px;}
.nav-links a{color:var(--text-3);text-decoration:none;transition:color .2s;}
.nav-links a:hover{color:var(--blue);}
@media (max-width:640px){.nav-links{display:none;}}
.container{max-width:980px;margin:0 auto;padding:0 22px 80px;}

.hero{text-align:center;padding:72px 22px 48px;}
.hero-eyebrow{font-size:13px;font-weight:600;color:var(--blue);letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;}
.hero h1{font-size:42px;font-weight:700;letter-spacing:-.025em;line-height:1.12;margin-bottom:18px;
  background:linear-gradient(180deg,#1d1d1f 0%,#424245 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.hero-sub{font-size:16.5px;color:var(--text-3);max-width:640px;margin:0 auto;line-height:1.55;}
.hero-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 30px;margin-top:26px;font-size:13px;color:var(--text-4);}
.hero-meta span{display:inline-flex;align-items:center;gap:6px;}
.hero-meta .sep{width:3px;height:3px;border-radius:50%;background:var(--text-4);display:inline-block;}
@media (max-width:640px){.hero h1{font-size:30px;}.hero{padding:52px 22px 36px;}}

.section{padding:10px 0 18px;}
.section-head{margin-bottom:22px;}
.section-num{font-size:13px;font-weight:700;color:var(--blue);letter-spacing:.06em;margin-bottom:4px;}
.section-title{font-size:27px;font-weight:700;letter-spacing:-.02em;color:var(--text);}
@media (max-width:640px){.section-title{font-size:21px;}}
.subsection{margin-bottom:34px;}
.sub-title{font-size:20px;font-weight:600;letter-spacing:-.015em;margin-bottom:14px;color:var(--text);}
@media (max-width:640px){.sub-title{font-size:17px;}}
.sub-sub-title{font-size:16px;font-weight:600;margin:20px 0 10px;color:var(--text-2);}
.divider{height:1px;background:var(--border-soft);margin:38px 0;border:none;}

.gantt-card{background:var(--surface);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow);
  border:1px solid var(--border-soft);margin:14px 0;}
.gantt-scene-label{font-size:13px;font-weight:600;color:var(--text-3);margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.gantt-scene-label .badge{background:var(--blue-soft);color:var(--blue);padding:2px 10px;border-radius:100px;font-size:12px;}
.gantt-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.gantt-table{min-width:640px;border-collapse:collapse;width:100%;font-size:13px;}
.gantt-table th,.gantt-table td{text-align:center;padding:10px 8px;border-bottom:1px solid var(--border-soft);}
.gantt-table th:first-child,.gantt-table td:first-child{text-align:left;min-width:210px;}
.gantt-table thead th{background:#fbfbfd;font-weight:600;color:var(--text-3);}
.gantt-cell{height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:600;color:#fff;transition:transform .2s;}
.gantt-cell:hover{transform:scale(1.03);}
.gantt-p1{background:linear-gradient(135deg,#7b78ff,var(--p1));}
.gantt-p1-light{background:linear-gradient(135deg,#7b78ff,var(--p1));opacity:.45;}
.gantt-p2{background:linear-gradient(135deg,#ffb84d,var(--p2));}
.gantt-p2-light{background:linear-gradient(135deg,#ffb84d,var(--p2));opacity:.45;}
.gantt-p3{background:linear-gradient(135deg,#5be87f,var(--p3));}
.gantt-p3-light{background:linear-gradient(135deg,#5be87f,var(--p3));opacity:.45;}
.gantt-empty{color:var(--text-4);font-size:14px;}

.phase-block{background:var(--surface);border-radius:var(--radius);padding:28px;margin-bottom:20px;
  box-shadow:var(--shadow);border:1px solid var(--border-soft);position:relative;overflow:hidden;}
.phase-block::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;}
.phase-block.p1::before{background:linear-gradient(90deg,var(--p1),#7b78ff);}
.phase-block.p2::before{background:linear-gradient(90deg,var(--p2),#ffb84d);}
.phase-block.p3::before{background:linear-gradient(90deg,var(--p3),#5be87f);}
.phase-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;}
.phase-header h4{font-size:18px;font-weight:700;letter-spacing:-.015em;}
.phase-header .duration{margin-left:auto;font-size:12.5px;color:var(--text-3);background:#fbfbfd;
  border:1px solid var(--border-soft);padding:4px 12px;border-radius:100px;white-space:nowrap;}
@media (max-width:640px){.phase-header .duration{margin-left:0;}}

.tag{display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:100px;
  font-size:12px;font-weight:600;letter-spacing:.01em;white-space:nowrap;}
.tag-p1{background:var(--p1-soft);color:var(--p1);}
.tag-p2{background:var(--p2-soft);color:#b36800;}
.tag-p3{background:var(--p3-soft);color:#1a9e43;}
.tag-red{background:#ffeaea;color:var(--red);}
.tag-orange{background:#fff3e6;color:var(--orange);}
.tag-teal{background:#e6f7fe;color:#0090c4;}

.table-wrap{background:var(--surface);border-radius:var(--radius);overflow:hidden;
  box-shadow:var(--shadow-sm);border:1px solid var(--border-soft);margin:14px 0;}
.table-wrap table{width:100%;border-collapse:collapse;font-size:14px;min-width:640px;}
.table-wrap thead th{background:#fbfbfd;font-weight:600;color:var(--text-3);padding:14px 18px;text-align:left;
  border-bottom:1px solid var(--border-soft);white-space:nowrap;}
.table-wrap td{padding:13px 18px;border-bottom:1px solid var(--border-soft);vertical-align:top;color:var(--text-2);}
.table-wrap tr:last-child td{border-bottom:none;}
.table-wrap .total-row td{background:#f5f5f7;font-weight:600;color:var(--text);border-top:2px solid var(--border-soft);}
@media (max-width:640px){.table-wrap table{font-size:13px;min-width:560px;}.table-wrap thead th,.table-wrap td{padding:10px 12px;}}
.table-wrap .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}

.deliverables{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:8px;}
.deliverables li{display:flex;align-items:flex-start;gap:10px;padding:13px 16px;border-radius:var(--radius-sm);
  background:#fbfbfd;border:1px solid var(--border-soft);font-size:13.5px;color:var(--text-2);transition:background .2s,transform .2s;}
.deliverables li:hover{background:#f5f5f7;transform:translateX(2px);}
.deliverables li .icon{font-size:17px;flex-shrink:0;line-height:1.4;}
.deliverables b{color:var(--text);}

.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0;}
@media (max-width:640px){.stat-grid{grid-template-columns:1fr;}}
.stat-card{background:var(--surface);border-radius:var(--radius);padding:24px 20px;text-align:center;
  border:1px solid var(--border-soft);box-shadow:var(--shadow-sm);transition:transform .2s,box-shadow .2s;}
.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
.stat-card .val{font-size:32px;font-weight:700;letter-spacing:-.02em;}
.stat-card.p1 .val{color:var(--p1);}
.stat-card.p2 .val{color:var(--p2);}
.stat-card.p3 .val{color:var(--p3);}
.stat-card .label{font-size:12px;color:var(--text-4);margin-top:6px;letter-spacing:.02em;}

.callout{background:var(--surface);border-radius:var(--radius);padding:20px 24px;margin:14px 0;
  border:1px solid var(--border-soft);font-size:14px;color:var(--text-2);line-height:1.7;box-shadow:var(--shadow-sm);}
.callout.blue{border-left:4px solid var(--blue);background:linear-gradient(90deg,var(--blue-soft) 0%,var(--surface) 40%);}
.callout.blue strong{color:var(--blue);}
.callout ul{margin:8px 0 0 20px;}
.callout li{margin-bottom:5px;}
.info-box{background:linear-gradient(135deg,var(--blue-soft),#f0f6ff);border-radius:var(--radius);
  padding:22px 26px;margin:14px 0;border:1px solid #c5ddf9;}
.info-box strong{color:var(--blue);}
.info-box ul{margin:8px 0 0 20px;}
.info-box li{margin-bottom:5px;font-size:14px;color:var(--text-2);}

.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0;}
@media (max-width:640px){.kpi-row{grid-template-columns:1fr;}}
.kpi-item{background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius-sm);
  padding:18px 20px;box-shadow:var(--shadow-sm);}
.kpi-item .k-name{font-size:14px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px;}
.kpi-item ul{margin:0 0 0 18px;font-size:13px;color:var(--text-2);}
.kpi-item li{margin-bottom:5px;}
.kpi-big{background:linear-gradient(135deg,#1d1d1f,#3a3a3c);border-radius:var(--radius);padding:26px 30px;
  color:#fff;margin:16px 0;display:flex;align-items:center;gap:22px;flex-wrap:wrap;}
.kpi-big .k-left{flex:1 1 320px;}
.kpi-big .k-left b{color:#fff;font-size:17px;}
.kpi-big .k-left p{color:#b8b8bd;font-size:13.5px;margin-top:6px;}
.kpi-big .k-num{font-size:38px;font-weight:700;color:#30d158;white-space:nowrap;}
.kpi-big .k-num small{font-size:13px;color:#b8b8bd;font-weight:600;}

.footer{text-align:center;padding:40px 22px 0;color:var(--text-4);font-size:13px;}
.footer .line{width:40px;height:4px;background:var(--blue);border-radius:2px;margin:0 auto 16px;}
.nowrap{white-space:nowrap;}

/* 报价单沿用同族卡片（套餐卡/价目表/承诺） */
.price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0;}
@media (max-width:760px){.price-grid{grid-template-columns:1fr;}}
.price-card{background:var(--surface);border:1px solid var(--border-soft);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow-sm);}
.price-card.recommended{border-color:var(--blue);box-shadow:var(--shadow);}
.price-card .p-name{font-size:17px;font-weight:700;}
.price-card .p-price{font-size:30px;font-weight:700;color:var(--blue);margin:8px 0;letter-spacing:-.02em;}
.price-card .p-price small{font-size:13px;color:var(--text-4);font-weight:400;}
.price-card .p-kpi{font-size:13px;color:var(--text-2);background:var(--blue-soft);border-radius:8px;padding:6px 10px;margin-bottom:10px;}
.price-card ul{margin:0 0 0 18px;font-size:13px;color:var(--text-2);}
.price-card li{margin-bottom:5px;}
.price-card .p-scene{font-size:12.5px;color:var(--text-3);margin-top:10px;border-top:1px dashed var(--border-soft);padding-top:10px;}
.money{font-variant-numeric:tabular-nums;font-weight:600;color:var(--text);}
@media print{body{background:#fff;}.gantt-card,.phase-block,.table-wrap,.price-card,.kpi-item,.callout,.info-box,.stat-card{box-shadow:none;break-inside:avoid;}}
`;
