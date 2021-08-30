var action: any;
var InputKind: any;
var wrap: any;
var createStringFiller: any;
var onApply: any;
var createOneOfFiller: any;

export function example() {
  switch (action.inputKind) {
    case InputKind.String:
      return wrap(createStringFiller({ action, onApply }));
    case InputKind.OneOf:
      return wrap(createOneOfFiller({ action, onApply }));
    default:
      return null;
  }
}
