var doc: any;
var mode: any;
var PrintBreakMode: any;
var currentPos: any;
var fits: any;
var maxLineWidth: any;

export const newMode =
  doc.break ||
  (mode === PrintBreakMode.Break &&
    (currentPos === undefined ||
      !fits(doc, PrintBreakMode.Flat, maxLineWidth - currentPos)))
    ? PrintBreakMode.Break
    : PrintBreakMode.Flat;
