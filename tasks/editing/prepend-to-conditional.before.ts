var node: any;
var tryAction: any;

export const enterAction = node.actions.setVariant
  ? tryAction("setVariant", (n) => n.id, true)
  : tryAction("setFromString");
