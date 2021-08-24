// src/logic/transform/transforms/compress-useless-values.ts

var parentNode: { actions: { [key: string]: any } };
type Thing<B> = any;

for (const [k, a] of Object.entries(parentNode.actions)) {
  this.actions[k] = a && {
    ...a,
    apply: (...args: any[]) =>
      this.reapplyTransform((a.apply as any).call(a, ...args) as Thing<string>),
  };
}
