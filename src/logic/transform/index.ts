import {
  Node,
  BuildResult,
  BuildResultFailure,
  BuildResultSuccess,
} from "../tree/node";
import { transform } from "typescript";

export type Transform = <B>(original: Node<B>) => Node<B>;

export type SingleTransformCache = WeakMap<
  Node<unknown>,
  Node<unknown> | undefined
>;

export type MultiTransformCache = {
  apply: WeakMap<Transform, SingleTransformCache>;
  unapply: SingleTransformCache;
};

function applyTransformToTree(
  root: Node<unknown>,
  transform: Transform,
  cache: SingleTransformCache,
  unapplyCache: SingleTransformCache,
): Node<unknown> {
  if (cache.has(root)) {
    return cache.get(root)!;
  }

  let newRoot = transform(root);
  // HACK Iterate using an index variable, because setting one child may change others (in MetaBranchNode)
  for (let i = 0; i < newRoot.children.length; i++) {
    const c = newRoot.children[i];
    const transformedChild = applyTransformToTree(
      c.node,
      transform,
      cache,
      unapplyCache,
    );
    if (transformedChild === c.node) {
      continue;
    }
    newRoot = newRoot.setChild({
      key: c.key,
      node: transformedChild,
    });
  }
  cache.set(root, newRoot);
  unapplyCache.set(newRoot, root);
  return newRoot;
}

function applyTransformsToTreeOnce(
  node: Node<unknown>,
  transforms: Transform[],
  cache: MultiTransformCache,
) {
  return transforms.reduce((node, transform) => {
    const singleCache = cache.apply.get(transform) || new WeakMap();
    cache.apply.set(transform, singleCache);
    const newNode = applyTransformToTree(
      node,
      transform,
      singleCache,
      cache.unapply,
    );
    return newNode;
  }, node);
}

export function applyTransformsToTree(
  node: Node<unknown>,
  transformGroups: Transform[][],
  cache: MultiTransformCache,
): Node<unknown> {
  for (const transforms of transformGroups) {
    for (let i = 0; ; i++) {
      if (i === 5) {
        console.warn("applyTransformsToTree reached iteration limit");
        break;
      }

      const newNode = applyTransformsToTreeOnce(node, transforms, cache);
      if (newNode === node) {
        break;
      }
      node = newNode;
    }
  }
  return node;
}

export function unapplyTransforms(
  transformedNode: Node<unknown>,
  cache: SingleTransformCache,
): BuildResult<Node<unknown>> {
  if (cache.has(transformedNode)) {
    return { ok: true, value: cache.get(transformedNode)! };
  }

  let node = transformedNode;
  while (node.unapplyTransform) {
    const buildResult = node.unapplyTransform();
    if (!buildResult.ok) {
      return buildResult;
    }
    node = buildResult.value;
  }

  const childBuildResults = node.children.map(c => ({
    key: c.key,
    result: unapplyTransforms(c.node, cache),
  }));
  const failedChild = childBuildResults.find(r => !r.result.ok);
  if (failedChild) {
    const { error } = failedChild.result as BuildResultFailure;
    return {
      ok: false,
      error: { path: [...error.path, failedChild.key], message: error.message },
    };
  }

  const newChildren = childBuildResults.map(e => ({
    key: e.key,
    node: (e.result as BuildResultSuccess<Node<unknown>>).value,
  }));
  if (newChildren.every((c, i) => c.node === node.children[i].node)) {
    return { ok: true, value: node };
  }

  newChildren.forEach(c => {
    node = node.setChild(c);
  });

  return { ok: true, value: node };
}
