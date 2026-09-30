/**
 * 对外产出禁用词检查（前后端共享）
 * 依据 SKILL.md 硬规则 1：任何对外产出（报告/排期表/报价/沟通文案）中
 * 绝不出现「收录」「SEO」「seo就绪度」「搜索引擎优化」及其变体。
 * 评分复核页与导出前跑检查，命中列警示条。
 */

/** 禁用词表（不区分大小写；按长度降序匹配，保证先报长词） */
export const BANNED_WORDS: string[] = [
  "搜索引擎优化",
  "seo就绪度",
  "收录率",
  "收录",
  "就绪度",
  "seo",
].sort((a, b) => b.length - a.length);

/**
 * 扫描文本中的禁用词，返回去重后的命中词列表（无命中返回空数组）。
 * 匹配不区分大小写。
 */
export function findBanned(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits = new Set<string>();
  for (const w of BANNED_WORDS) {
    if (lower.includes(w.toLowerCase())) hits.add(w);
  }
  return [...hits];
}

/** 常用转写对照（命中提示用） */
export const BANNED_REWRITES: Record<string, string> = {
  收录: "可见 / 被引用",
  收录率: "页面可见率 / 官网被引用率",
  seo: "GEO / AI 可见性",
  seo就绪度: "GEO 健康度",
  搜索引擎优化: "生成式引擎优化（GEO）",
  就绪度: "健康度",
};
