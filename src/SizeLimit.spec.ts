import SizeLimit from "./SizeLimit";

describe("SizeLimit", () => {
  test("should parse size-limit output", () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      {
        name: "dist/index.js",
        passed: true,
        size: "110894",
        running: "0.10210999999999999",
        loading: "2.1658984375"
      }
    ]);

    expect(limit.parseResults(output)).toEqual({
      "dist/index.js": {
        name: "dist/index.js",
        loading: 2.1658984375,
        running: 0.10210999999999999,
        size: 110894,
        total: 2.2680084375000003
      }
    });
  });

  test("should parse size-limit without times output", () => {
    const limit = new SizeLimit();
    const output = JSON.stringify([
      {
        name: "dist/index.js",
        passed: true,
        size: "110894"
      }
    ]);

    expect(limit.parseResults(output)).toEqual({
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894
      }
    });
  });

  test("should format size-limit results", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894,
        running: 0.10210999999999999,
        loading: 2.1658984375,
        total: 2.2680084375000003
      }
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894,
        running: 0.20210999999999999,
        loading: 2.5658984375,
        total: 2.7680084375000003
      }
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.TIME_RESULTS_HEADER,
      [
        "dist/index.js",
        "98.53 KB (-9.02% 🔽)",
        "2.6 s (+18.47% 🔺)",
        "203 ms (+97.94% 🔺)",
        "2.8 s"
      ]
    ]);
  });

  test("should format size-limit without times results", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894
      }
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894
      }
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "98.53 KB (-9.02% 🔽)"]
    ]);
  });

  test("should format size-limit with new section", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894
      }
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 100894
      },
      "dist/new.js": {
        name: "dist/new.js",
        size: 100894
      }
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "98.53 KB (-9.02% 🔽)"],
      ["dist/new.js", "98.53 KB (+100% 🔺)"]
    ]);
  });

  test("should format size-limit with deleted section", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110894
      }
    };
    const current = {
      "dist/new.js": {
        name: "dist/new.js",
        size: 100894
      }
    };

    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "0 B (-100% 🔽)"],
      ["dist/new.js", "98.53 KB (+100% 🔺)"]
    ]);
  });

  test("should correctly parse the margin", () => {
    const limit = new SizeLimit();
    expect(limit.parseMargin("10%")).toEqual({ type: "pct", value: 10 });
    expect(limit.parseMargin("10")).toEqual({ type: "size", value: 10 });
    expect(limit.parseMargin("non-zero")).toEqual({ type: "non-zero" });
  });
  test("should throw if the margin is invalid", () => {
    const limit = new SizeLimit();
    expect(() => limit.parseMargin("ten")).toThrowErrorMatchingInlineSnapshot(
      `"Invalid size margin: ten. Must be a number, with or without a % sign, or \\"non-zero\\""`
    );
  });

  test("should honour sizeMargin and filter out entries", () => {
    const limit = new SizeLimit();
    const base = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110890
      },
      "dist/no-change": {
        name: "dist/no-change",
        size: 110895
      }
    };
    const current = {
      "dist/index.js": {
        name: "dist/index.js",
        size: 110895
      },
      "dist/no-change": {
        name: "dist/no-change",
        size: 110895
      }
    };

    // within margin
    expect(
      limit.formatResults(base, current, {
        sizeMargin: limit.parseMargin("5")
      })
    ).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "108.3 KB (+0.01% 🔺)"]
    ]);
    // lower than margin
    expect(
      limit.formatResults(base, current, {
        sizeMargin: limit.parseMargin("10")
      })
    ).toEqual([SizeLimit.SIZE_RESULTS_HEADER]);

    // within margin
    expect(
      limit.formatResults(base, current, {
        sizeMargin: limit.parseMargin("0.005%")
      })
    ).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "108.3 KB (+0.01% 🔺)"]
    ]);

    // lower than margin
    expect(
      limit.formatResults(base, current, {
        sizeMargin: limit.parseMargin("10%")
      })
    ).toEqual([SizeLimit.SIZE_RESULTS_HEADER]);

    // no change gets filtered out as long as sizeMargin exists and is not 0
    expect(limit.formatResults(base, current)).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "108.3 KB (+0.01% 🔺)"],
      ["dist/no-change", "108.3 KB (0%)"]
    ]);

    expect(
      limit.formatResults(base, current, {
        sizeMargin: limit.parseMargin("0")
      })
    ).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "108.3 KB (+0.01% 🔺)"],
      ["dist/no-change", "108.3 KB (0%)"]
    ]);

    expect(
      limit.formatResults(base, current, {
        sizeMargin: limit.parseMargin("non-zero")
      })
    ).toEqual([
      SizeLimit.SIZE_RESULTS_HEADER,
      ["dist/index.js", "108.3 KB (+0.01% 🔺)"]
    ]);
  });
});
