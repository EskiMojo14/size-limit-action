// @ts-ignore
import bytes from "bytes";

interface IResult {
  name: string;
  size: number;
  running?: number;
  loading?: number;
  total?: number;
}

type Margin =
  | { type: "non-zero" }
  | {
      type: "size" | "pct";
      value: number;
    };

interface FormatOptions {
  sizeMargin?: Margin;
}

const EmptyResult = {
  name: "-",
  size: 0,
  running: 0,
  loading: 0,
  total: 0,
};

class SizeLimit {
  static SIZE_RESULTS_HEADER = ["Path", "Size"];

  static TIME_RESULTS_HEADER = [
    "Path",
    "Size",
    "Loading time (3g)",
    "Running time (snapdragon)",
    "Total time",
  ];

  private formatBytes(size: number): string {
    return bytes.format(size, { unitSeparator: " " });
  }

  private formatTime(seconds: number): string {
    if (seconds >= 1) {
      return `${Math.ceil(seconds * 10) / 10} s`;
    }

    return `${Math.ceil(seconds * 1000)} ms`;
  }

  private getChange(base: number = 0, current: number = 0): number {
    if (base === 0) {
      return 100;
    }
    return ((current - base) / base) * 100;
  }

  private formatChange(base: number = 0, current: number = 0): string {
    if (base === 0) {
      return "+100% 🔺";
    }

    const value = this.getChange(base, current);
    const formatted =
      (Math.sign(value) * Math.ceil(Math.abs(value) * 100)) / 100;

    if (value > 0) {
      return `+${formatted}% 🔺`;
    }

    if (value === 0) {
      return `${formatted}%`;
    }

    return `${formatted}% 🔽`;
  }

  private formatLine(value: string, change: string) {
    return `${value} (${change})`;
  }

  private formatSizeResult(
    name: string,
    base: IResult,
    current: IResult,
    options: FormatOptions = {},
  ): Array<string> | null {
    if (options.sizeMargin !== undefined) {
      switch (options.sizeMargin.type) {
        case "non-zero": {
          const rawChange = current.size - base.size;
          if (rawChange === 0) {
            return null;
          }
          break;
        }
        case "size": {
          const rawChange = current.size - base.size;
          if (Math.abs(rawChange) < options.sizeMargin.value) {
            return null;
          }
          break;
        }
        case "pct": {
          const pctChange = this.getChange(base.size, current.size);
          if (Math.abs(pctChange) < options.sizeMargin.value / 100) {
            return null;
          }
        }
      }
    }
    return [
      name,
      this.formatLine(
        this.formatBytes(current.size),
        this.formatChange(base.size, current.size),
      ),
    ];
  }

  private formatTimeResult(
    name: string,
    base: IResult,
    current: IResult,
  ): Array<string> {
    return [
      name,
      this.formatLine(
        this.formatBytes(current.size),
        this.formatChange(base.size, current.size),
      ),
      this.formatLine(
        this.formatTime(current.loading ?? 0),
        this.formatChange(base.loading, current.loading),
      ),
      this.formatLine(
        this.formatTime(current.running ?? 0),
        this.formatChange(base.running, current.running),
      ),
      this.formatTime(current.total ?? 0),
    ];
  }

  parseResults(output: string): { [name: string]: IResult } {
    const results = JSON.parse(output);

    return results.reduce(
      (current: { [name: string]: IResult }, result: any) => {
        let time = {};

        if (result.loading !== undefined && result.running !== undefined) {
          const loading = +result.loading;
          const running = +result.running;

          time = {
            running,
            loading,
            total: loading + running,
          };
        }

        return {
          ...current,
          [result.name]: {
            name: result.name,
            size: +result.size,
            ...time,
          },
        };
      },
      {},
    );
  }

  formatResults(
    base: { [name: string]: IResult },
    current: { [name: string]: IResult },
    options: FormatOptions = {},
  ): Array<Array<string>> {
    const names = [...new Set([...Object.keys(base), ...Object.keys(current)])];
    const isSize = names.some(
      (name: string) => current[name] && current[name].total === undefined,
    );
    const header = isSize
      ? SizeLimit.SIZE_RESULTS_HEADER
      : SizeLimit.TIME_RESULTS_HEADER;
    const fields = names
      .map((name: string) => {
        const baseResult = base[name] || EmptyResult;
        const currentResult = current[name] || EmptyResult;

        if (isSize) {
          return this.formatSizeResult(
            name,
            baseResult,
            currentResult,
            options,
          );
        }
        return this.formatTimeResult(name, baseResult, currentResult);
      })
      .filter((r): r is string[] => !!r);

    return [header, ...fields];
  }

  parseMargin(sizeMargin: string): Margin | undefined {
    if (!sizeMargin) return undefined;
    if (sizeMargin === "non-zero") {
      return { type: "non-zero" };
    }
    if (sizeMargin.endsWith("%")) {
      const sliced = sizeMargin.slice(0, -1);
      const parsed = parseFloat(sliced);
      if (Number.isNaN(parsed)) {
        throw new Error(
          `Invalid size margin: ${sizeMargin}. Must be a number, with or without a % sign, or "non-zero"`,
        );
      }
      return {
        type: "pct",
        value: parsed,
      };
    }

    // assume bytes
    const parsed = parseFloat(sizeMargin);
    if (Number.isNaN(parsed)) {
      throw new Error(
        `Invalid size margin: ${sizeMargin}. Must be a number, with or without a % sign, or "non-zero"`,
      );
    }

    return {
      type: "size",
      value: parsed,
    };
  }
}
export default SizeLimit;
