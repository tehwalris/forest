// src/logic/tree/base-nodes/struct.ts

type BuildResult<T> = any;
type T = any;

export function buildChildren(): BuildResult<{ [key: string]: T }> {
  const builtValues: { [key: string]: T } = {};
  for (const child of this.children) {
    const buildResult = child.node.build();
    if (!buildResult.ok) {
      return {
        ok: false,
        error: {
          message: buildResult.error.message,
          path: [child.key, ...buildResult.error.path],
        },
      };
    }
    builtValues[child.key] = buildResult.value;
  }
  return { ok: true, value: builtValues };
}
