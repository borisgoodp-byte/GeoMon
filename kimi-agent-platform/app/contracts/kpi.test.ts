import { describe, expect, it } from "vitest";
import {
  calcCitationRate,
  calcCoverageRate,
  CHECKPOINTS,
  judgeCheckpoint,
  judgePeriodKpi,
  kpiTargetForMonths,
  kpiTargetLabel,
  normalizeUrl,
} from "./kpi";

describe("kpiTargetForMonths（服务周期口径）", () => {
  it("12 个月 ≥50% / 6 个月 ≥30% / 3 个月无考核", () => {
    expect(kpiTargetForMonths(12)).toBe(50);
    expect(kpiTargetForMonths(6)).toBe(30);
    expect(kpiTargetForMonths(3)).toBeNull();
  });
  it("超档归位：≥12 归 50，6–11 归 30，<6 无考核", () => {
    expect(kpiTargetForMonths(15)).toBe(50);
    expect(kpiTargetForMonths(9)).toBe(30);
    expect(kpiTargetForMonths(1)).toBeNull();
  });
  it("label：无考核周期返回验收文案", () => {
    expect(kpiTargetLabel(3)).toBe("按交付物清单验收，无指标考核");
    expect(kpiTargetLabel(12)).toBe("官网引用率 ≥50%");
  });
});

describe("judgeCheckpoint（验收线 = 目标 × 0.8）", () => {
  it("12 个月版：50 达标 / 40 验收合格 / 以下未达标", () => {
    expect(judgeCheckpoint(50, 50)).toBe("achieved");
    expect(judgeCheckpoint(60, 50)).toBe("achieved");
    expect(judgeCheckpoint(40, 50)).toBe("accepted");
    expect(judgeCheckpoint(39.9, 50)).toBe("below");
  });
  it("6 个月版：30 达标 / 24 验收合格 / 以下未达标", () => {
    expect(judgeCheckpoint(30, 30)).toBe("achieved");
    expect(judgeCheckpoint(24, 30)).toBe("accepted");
    expect(judgeCheckpoint(23.9, 30)).toBe("below");
  });
  it("CHECKPOINTS 常量与口径一致", () => {
    expect(CHECKPOINTS.m6).toMatchObject({ target: 30, acceptRate: 24 });
    expect(CHECKPOINTS.m12).toMatchObject({ target: 50, acceptRate: 40 });
  });
});

describe("judgePeriodKpi", () => {
  it("3 个月周期返回 null（无指标考核）", () => {
    expect(judgePeriodKpi(80, 3)).toBeNull();
  });
  it("6/12 个月按周期目标判定", () => {
    expect(judgePeriodKpi(35, 6)).toBe("achieved");
    expect(judgePeriodKpi(25, 6)).toBe("accepted");
    expect(judgePeriodKpi(10, 12)).toBe("below");
  });
});

describe("calcCitationRate / calcCoverageRate", () => {
  it("引用率 = L2 ÷ 总数，保留 1 位小数", () => {
    expect(calcCitationRate(5, 2)).toBe(40);
    expect(calcCitationRate(3, 1)).toBeCloseTo(33.3);
    expect(calcCitationRate(0, 0)).toBe(0);
    expect(calcCitationRate(10, 10)).toBe(100);
  });
  it("覆盖率 = 命中词 ÷ 生效词", () => {
    expect(calcCoverageRate(10, 7)).toBe(70);
    expect(calcCoverageRate(0, 0)).toBe(0);
  });
});

describe("normalizeUrl", () => {
  it("去协议 + 去 www + 小写 host", () => {
    expect(normalizeUrl("https://www.Hanhoo.com/")).toBe("hanhoo.com");
    expect(normalizeUrl("HTTP://Example.COM/Path")).toBe("example.com/Path");
    expect(normalizeUrl("hanhoo.com/products")).toBe("hanhoo.com/products");
  });
  it("去 m. 前缀", () => {
    expect(normalizeUrl("https://m.example.com/a")).toBe("example.com/a");
  });
  it("剔除追踪参数（utm_* / spm / from / _t），保留业务参数并排序", () => {
    expect(
      normalizeUrl("https://a.com/p?utm_source=x&id=1&spm=abc&utm_medium=y"),
    ).toBe("a.com/p?id=1");
    expect(normalizeUrl("https://a.com/p?b=2&a=1")).toBe("a.com/p?a=1&b=2");
  });
  it("去 fragment / 默认文件名 / 尾斜杠", () => {
    expect(normalizeUrl("https://a.com/p#sec")).toBe("a.com/p");
    expect(normalizeUrl("https://a.com/dir/index.html")).toBe("a.com/dir");
    expect(normalizeUrl("https://a.com/dir/")).toBe("a.com/dir");
  });
  it("空串与非法输入", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});
