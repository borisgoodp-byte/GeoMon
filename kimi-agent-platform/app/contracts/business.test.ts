import { describe, expect, it } from "vitest";
import {
  computeQuoteTotal,
  packageForMonths,
  packageQuoteItem,
  PERIOD_PACKAGES,
  type QuoteItem,
} from "./quote";
import { dayToDate, generateSchedule } from "./schedule";
import {
  buildVisTestTemplate,
  visScoresFromTests,
  VIS_WORD_TYPES,
  type VisTest,
} from "./vistest";

describe("packageForMonths / packageQuoteItem", () => {
  it("三档套餐价：3/6/12 个月 → 3/6/12 万", () => {
    expect(packageForMonths(3)?.price).toBe(30000);
    expect(packageForMonths(6)?.price).toBe(60000);
    expect(packageForMonths(12)?.price).toBe(120000);
    expect(packageForMonths(4)).toBeNull();
  });
  it("套餐明细行继承套餐价与考核口径", () => {
    const item = packageQuoteItem(12);
    expect(item.price).toBe(120000);
    expect(item.qty).toBe(1);
    expect(item.name).toContain("12个月版");
    expect(item.desc).toContain("≥50%");
  });
  it("非法周期抛错", () => {
    expect(() => packageQuoteItem(9)).toThrow();
  });
  it("套餐目录结构与 KPI 文案", () => {
    expect(PERIOD_PACKAGES).toHaveLength(3);
    expect(PERIOD_PACKAGES[0]!.kpi).toContain("无指标考核");
  });
});

describe("computeQuoteTotal", () => {
  const item = (price: number, qty: number): QuoteItem => ({
    group: "x", name: "n", desc: "", unit: "项", price, qty,
  });
  it("Σ price × qty", () => {
    expect(computeQuoteTotal([item(60000, 1), item(500, 2)])).toBe(61000);
    expect(computeQuoteTotal([])).toBe(0);
  });
  it("保留 2 位小数", () => {
    expect(computeQuoteTotal([item(0.1, 3), item(0.2, 1)])).toBeCloseTo(0.5);
  });
});

describe("generateSchedule（三阶段模型）", () => {
  it("Phase 3 占满剩余周期，期末里程碑 = months×30 天", () => {
    const s = generateSchedule("2026-09-01", 12);
    expect(s.phasesJson.map((p) => p.phase)).toEqual(["A", "B", "C"]);
    const phaseC = s.phasesJson[2]!;
    expect(phaseC.tasks.every((t) => t.endDay === 360)).toBe(true);
    expect(s.milestonesJson.at(-1)!.day).toBe(360);
  });
  it("12 个月期末写 KPI 口径，3 个月写交付物验收", () => {
    expect(generateSchedule("2026-01-01", 12).milestonesJson.at(-1)!.desc).toContain("≥50%");
    expect(generateSchedule("2026-01-01", 6).milestonesJson.at(-1)!.desc).toContain("≥30%");
    expect(generateSchedule("2026-01-01", 3).milestonesJson.at(-1)!.desc).toContain("无指标考核");
  });
  it("dayToDate 偏移换算", () => {
    expect(dayToDate("2026-09-01", 0)).toBe("2026-09-01");
    expect(dayToDate("2026-09-01", 30)).toBe("2026-10-01");
  });
});

describe("visScoresFromTests（9 问定档）", () => {
  const makeTests = (fill: Partial<VisTest> = {}): VisTest[] =>
    buildVisTestTemplate({ category: "护肤品", brand: "韩后", rival: "竞品" }).map(
      (t) => ({ ...t, ...fill }),
    );

  it("模板生成 3 平台 × 3 词类 = 9 格", () => {
    const tests = buildVisTestTemplate({ category: "护肤品", brand: "韩后", rival: "竞品" });
    expect(tests).toHaveLength(9);
    for (const t of tests) {
      expect(t.hit).toBeNull();
      expect(VIS_WORD_TYPES).toContain(t.wordType);
    }
  });

  it("全部命中 → vis_1/2/3 = 20，complete", () => {
    const r = visScoresFromTests(makeTests({ hit: true, testedAt: "2026-09-01" }));
    expect(r.scores).toEqual({ vis_1: 20, vis_2: 20, vis_3: 20 });
    expect(r.complete).toBe(true);
  });

  it("词类未测满 3 平台 → 该项 null 且 complete=false", () => {
    const tests = makeTests({ hit: true, testedAt: "2026-09-01" });
    // 决策词只测 2 平台
    const decisionCells = tests.filter((t) => t.wordType === "decision");
    decisionCells[2]!.hit = null;
    decisionCells[2]!.testedAt = null;
    const r = visScoresFromTests(tests);
    expect(r.scores.vis_1).toBeNull();
    expect(r.scores.vis_2).toBe(20);
    expect(r.scores.vis_3).toBe(20);
    expect(r.complete).toBe(false);
    expect(r.detail.decision).toEqual({ tested: 2, hits: 2 });
  });

  it("部分命中定档：2/3→15、1/3→10、0/3→0", () => {
    const tests = makeTests({ hit: false, testedAt: "2026-09-01" });
    const decision = tests.filter((t) => t.wordType === "decision");
    decision[0]!.hit = true;
    decision[1]!.hit = true;
    const scenario = tests.filter((t) => t.wordType === "scenario");
    scenario[0]!.hit = true;
    const r = visScoresFromTests(tests);
    expect(r.scores).toEqual({ vis_1: 15, vis_2: 10, vis_3: 0 });
  });
});
