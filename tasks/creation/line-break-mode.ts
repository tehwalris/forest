var doc, mode, PrintBreakMode, currentPos, fits, maxLineWidth: any;

export const newMode =
  doc.break ||
  (mode === PrintBreakMode.Break &&
    (currentPos === undefined ||
      !fits(doc, PrintBreakMode.Flat, maxLineWidth - currentPos)))
    ? PrintBreakMode.Break
    : PrintBreakMode.Flat;
