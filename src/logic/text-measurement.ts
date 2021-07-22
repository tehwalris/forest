import { LabelPart, LabelStyle } from "./tree/node";

export interface TextSize {
  width: number;
  height: number;
}

export function arrayFromTextSize({ width, height }: TextSize): number[] {
  return [width, height];
}

export type TextMeasurementFunction = (text: string) => TextSize;

interface AdvancedTextMetrics extends TextMetrics {
  fontBoundingBoxAscent: number;
  fontBoundingBoxDescent: number;
}

function isAdvancedTextMetrics(
  _metrics: TextMetrics,
): _metrics is AdvancedTextMetrics {
  const metrics: typeof _metrics & {
    fontBoundingBoxAscent?: unknown;
    fontBoundingBoxDescent?: unknown;
  } = _metrics;
  return (
    "fontBoundingBoxAscent" in metrics &&
    typeof metrics.fontBoundingBoxAscent === "number" &&
    "fontBoundingBoxDescent" in metrics &&
    typeof metrics.fontBoundingBoxDescent === "number"
  );
}

export function makeTextMeasurementFunction(
  font: string,
  fallbackHeight: number,
): TextMeasurementFunction {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("failed to get canvas context");
  }
  ctx.font = font;
  return (text) => {
    const metrics = ctx.measureText(text);
    if (isAdvancedTextMetrics(metrics)) {
      return {
        width: metrics.width,
        height: metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent,
      };
    }
    return {
      width: metrics.width,
      height: fallbackHeight,
    };
  };
}

class TextMeasurementCache {
  private resultsLastPass = new Map<string, TextSize>();
  private resultsThisPass = new Map<string, TextSize>();

  constructor(private measureNoCache: TextMeasurementFunction) {}

  measure(text: string): TextSize {
    const cachedSize =
      this.resultsThisPass.get(text) || this.resultsLastPass.get(text);
    if (cachedSize) {
      return cachedSize;
    }
    const size = this.measureNoCache(text);
    this.resultsThisPass.set(text, size);
    return size;
  }

  clearUnused() {
    this.resultsLastPass = this.resultsThisPass;
    this.resultsThisPass = new Map();
  }
}

export type LabelMeasurementFunction = (label: LabelPart[]) => TextSize;

export class LabelMeasurementCache {
  private textMeasurementCachesByStyle: {
    [K in LabelStyle]: TextMeasurementCache;
  };

  constructor(
    textMeasurementFunctionsByStyle: {
      [K in LabelStyle]: TextMeasurementFunction;
    },
  ) {
    this.textMeasurementCachesByStyle = {} as any;
    for (const [_style, f] of Object.entries(textMeasurementFunctionsByStyle)) {
      const style = _style as unknown as LabelStyle;
      this.textMeasurementCachesByStyle[style] = new TextMeasurementCache(f);
    }
  }

  measure: LabelMeasurementFunction = (label) => {
    return label.reduce<TextSize>(
      (oldSize, part) => {
        const partSize = this.measurePart(part);
        return {
          width: oldSize.width + partSize.width,
          height: Math.max(oldSize.height, partSize.height),
        };
      },
      { width: 0, height: 0 },
    );
  };

  private measurePart({ text, style }: LabelPart): TextSize {
    return this.textMeasurementCachesByStyle[style].measure(text);
  }

  clearUnused() {
    for (const cache of Object.values(this.textMeasurementCachesByStyle)) {
      cache.clearUnused();
    }
  }
}
