import { describe, expect, it } from "vitest";
import {
  ALLOWED_SCORES,
  computeComposite,
  computeDimensionScore,
  computeGrade,
  INDICATORS,
  isAllowedScore,
  validateScores,
  visLevelFromHits,
} from "./scoring";

describe("isAllowedScore / validateScores", () => {
  it("四档分值 0/10/15/20 合法", () => {
    for (const s of [0, 10, 15, 20]) expect(isAllowedScore(s)).toBe(true);
    expect(ALLOWED_SCORES).toEqual([0, 10, 15, 20]);
  });
  it("非四档分值拒绝", () => {
    for (const s of [5, 12, 18, 25, -10, 100]) expect(isAllowedScore(s)).toBe(false);
  });
  it("validateScores 返回非法项键名", () => {
    const r = validateScores([
      { indicatorKey: "tech_1", score: 20 },
      { indicatorKey: "tech_2", score: 11 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.invalid).toEqual(["tech_2"]);
  });
});

describe("computeDimensionScore", () => {
  it("维度一/二/三为五子项求和", () => {
    const dims = computeDimensionScore({
      tech_1: 10, tech_2: 10, tech_3: 0, tech_4: 0, tech_5: 0,
      arch_1: 15, arch_2: 10, arch_3: 15, arch_4: 0, arch_5: 10,
      cont_1: 0, cont_2: 0, cont_3: 10, cont_4: 10, cont_5: 0,
    });
    expect(dims.tech).toBe(20);
    expect(dims.arch).toBe(50);
    expect(dims.content).toBe(20);
  });
  it("维度四 = 三子项和 / 60 × 100（保留 1 位小数）", () => {
    expect(computeDimensionScore({ vis_1: 20, vis_2: 15, vis_3: 10 }).vis).toBe(75);
    expect(computeDimensionScore({ vis_1: 20, vis_2: 20, vis_3: 20 }).vis).toBe(100);
    expect(computeDimensionScore({ vis_1: 10 }).vis).toBeCloseTo(16.7);
    expect(computeDimensionScore({}).vis).toBe(0);
  });
  it("缺失键按 0 计", () => {
    expect(computeDimensionScore({ tech_1: 20 }).tech).toBe(20);
  });
});

describe("computeComposite（韩后种子口径：20/50/20/0 → 21.0）", () => {
  it("加权 25/20/30/25", () => {
    expect(computeComposite({ tech: 20, arch: 50, content: 20, vis: 0 })).toBe(21);
    expect(computeComposite({ tech: 100, arch: 100, content: 100, vis: 100 })).toBe(100);
    expect(computeComposite({ tech: 0, arch: 0, content: 0, vis: 0 })).toBe(0);
    // 40×.25 + 40×.2 + 40×.3 + 40×.25 = 40
    expect(computeComposite({ tech: 40, arch: 40, content: 40, vis: 40 })).toBe(40);
  });
  it("保留 1 位小数", () => {
    // 33×.25+33×.2+33×.3+33×.25 = 33；33.33×权重和 = 33.33
    expect(computeComposite({ tech: 33.3, arch: 33.3, content: 33.3, vis: 33.3 })).toBeCloseTo(33.3);
  });
});

describe("computeGrade 边界", () => {
  it("A≥80 / B≥65 / C≥45 / D<45", () => {
    expect(computeGrade(80)).toBe("A");
    expect(computeGrade(79.9)).toBe("B");
    expect(computeGrade(65)).toBe("B");
    expect(computeGrade(64.9)).toBe("C");
    expect(computeGrade(45)).toBe("C");
    expect(computeGrade(44.9)).toBe("D");
    expect(computeGrade(0)).toBe("D");
    expect(computeGrade(21)).toBe("D"); // 韩后种子
  });
});

describe("visLevelFromHits", () => {
  it("3/3→20、2/3→15、1/3→10、0/3→0", () => {
    expect(visLevelFromHits(3)).toBe(20);
    expect(visLevelFromHits(2)).toBe(15);
    expect(visLevelFromHits(1)).toBe(10);
    expect(visLevelFromHits(0)).toBe(0);
  });
});

describe("INDICATORS 完整性", () => {
  it("18 项指标，维度分布 5/5/5/3", () => {
    expect(INDICATORS).toHaveLength(18);
    const byDim = INDICATORS.reduce<Record<number, number>>((acc, d) => {
      acc[d.dimension] = (acc[d.dimension] ?? 0) + 1;
      return acc;
    }, {});
    expect(byDim).toEqual({ 1: 5, 2: 5, 3: 5, 4: 3 });
  });
});
