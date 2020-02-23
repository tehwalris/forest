import {
  Node,
  BuildResult,
  BuildResultFailure,
  BuildResultSuccess,
} from "../tree/node";

export type Transform = <B>(original: Node<B>) => Node<B>;

export type SingleTransformCache = WeakMap<
  Node<unknown>,
  Node<unknown> | undefined
>;

export type MultiTransformCache = WeakMap<Transform, SingleTransformCache>;

function applyTransformToTree(
  root: Node<unknown>,
  transform: Transform,
  cache: SingleTransformCache,
): Node<unknown> {
  if (cache.has(root)) {
    return cache.get(root)!;
  }

  let newRoot = transform(root);
  // HACK Iterate using an index variable, because setting one child may change others (in MetaBranchNode)
  for (let i = 0; i < newRoot.children.length; i++) {
    const c = newRoot.children[i];
    const transformedChild = applyTransformToTree(c.node, transform, cache);
    if (transformedChild === c.node) {
      continue;
    }
    newRoot = newRoot.setChild({
      key: c.key,
      node: transformedChild,
    });
  }
  cache.set(root, newRoot);
  return newRoot;
}

function applyTransformsToTreeOnce(
  node: Node<unknown>,
  transforms: Transform[],
  cache: MultiTransformCache,
): Node<unknown> {
  return transforms.reduce((node, transform, i) => {
    const singleCache = cache.get(transform) || new WeakMap();
    cache.set(transform, singleCache);
    const newNode = applyTransformToTree(node, transform, singleCache);
    return newNode;
  }, node);
}

export function applyTransformsToTree(
  node: Node<unknown>,
  transforms: Transform[],
  cache: MultiTransformCache,
): Node<unknown> {
  for (let i = 0; i < 5; i++) {
    const newNode = applyTransformsToTreeOnce(node, transforms, cache);
    if (newNode === node) {
      return node;
    }
    node = newNode;
  }
  console.warn("applyTransformsToTree reached iteration limit");
  return node;
}

export function unapplyTransforms(
  transformedNode: Node<unknown>,
): BuildResult<Node<unknown>> {
  let node = transformedNode;
  // TODO This only unwraps the node once (more may be necessary), but
  // making it unrwap multiple times breaks transforms for some reason.
  const buildResult = transformedNode.unapplyTransform?.();
  if (buildResult) {
    if (!buildResult.ok) {
      return buildResult;
    }
    node = buildResult.value;
  }

  const childBuildResults = node.children.map(c => ({
    key: c.key,
    result: unapplyTransforms(c.node),
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
