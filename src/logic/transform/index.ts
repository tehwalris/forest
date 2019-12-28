import { Node, BuildResult } from "../tree/node";

export type Transform = (original: Node<unknown>) => Node<unknown>;

export type SingleTransformCache = WeakMap<
  Node<unknown>,
  Node<unknown> | undefined
>;

export type MultiTransformCache = WeakMap<Transform, SingleTransformCache>;

function tryApplyTransformToNode(
  node: Node<unknown>,
  transform: Transform,
  cache: SingleTransformCache,
): Node<unknown> {
  if (cache.has(node)) {
    return node;
  }
  const result = transform(node);
  cache.set(node, result);
  return result;
}

function applyTransformToSubtree(
  root: Node<unknown>,
  transform: Transform,
  cache: SingleTransformCache,
): Node<unknown> {
  let newRoot = tryApplyTransformToNode(root, transform, cache);
  newRoot.children.forEach(c => {
    newRoot = newRoot.setChild({
      key: c.key,
      node: applyTransformToSubtree(c.node, transform, cache),
    });
  });
  return newRoot;
}

export function applyTransformsToTree(
  node: Node<unknown>,
  transforms: Transform[],
  cache: MultiTransformCache,
): Node<unknown> {
  return transforms.reduce((node, transform) => {
    const singleCache = cache.get(transform) || new WeakMap();
    cache.set(transform, singleCache);
    return applyTransformToSubtree(node, transform, singleCache);
  }, node);
}

export function unapplyTransforms(
  node: Node<unknown>,
): BuildResult<Node<unknown>> {
  if (!node.unapplyTransform) {
    return { ok: true, value: node };
  }
  const buildResult = node.unapplyTransform();
  if (!buildResult.ok) {
    return buildResult;
  }
  return unapplyTransforms(buildResult.value);
}
