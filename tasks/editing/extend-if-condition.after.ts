var ev: any;
var value: any;

if (!(ev.key === "Escape" || (ev.key === " " && !value))) {
  ev.stopPropagation();
}
