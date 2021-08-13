import ts from "typescript";
import { Transform } from "..";
import { fromTsNode } from "../../providers/typescript/convert";
import { unions } from "../../providers/typescript/generated/templates";
import {
  RequiredHoleNode,
  someDefaultFromUnion,
  TemplateUnionNode,
  Union,
} from "../../providers/typescript/template-nodes";
import { UnionVariant } from "../../tree/base-nodes";
import { LazyUnionVariant } from "../../tree/base-nodes/union";
import { ChildNodeEntry, Node } from "../../tree/node";

const expressionVariants: LazyUnionVariant<string>[] = (
  TemplateUnionNode.fromUnion(
    unions.Expression,
    someDefaultFromUnion(unions.Expression),
    fromTsNode,
  ) as any
).variants;

interface ExpressionOrStatementCacheEntry {
  union: Union<ts.Statement>;
  variants: LazyUnionVariant<string>[];
}

const makeExpressionOrStatementCache = new WeakMap<
  Union<ts.Statement>,
  ExpressionOrStatementCacheEntry
>();
function makeExpressionOrStatement(
  statementUnion: Union<ts.Statement>,
): ExpressionOrStatementCacheEntry {
  const oldCacheEntry = makeExpressionOrStatementCache.get(statementUnion);
  if (oldCacheEntry) {
    return oldCacheEntry;
  }
  const newCacheEntry = _makeExpressionOrStatement(statementUnion);
  makeExpressionOrStatementCache.set(statementUnion, newCacheEntry);
  return newCacheEntry;
}

function _makeExpressionOrStatement(
  statementUnion: Union<ts.Statement>,
): ExpressionOrStatementCacheEntry {
  const expressionOrStatementMembers: ReturnType<
    Union<ts.Statement>["getMembers"]
  > = {};
  for (const [name, member] of Object.entries(statementUnion.getMembers())) {
    if (name === "ExpressionStatement") {
      continue;
    }
    expressionOrStatementMembers[`Statement.${name}`] = member;
  }
  for (const [name, member] of Object.entries(unions.Expression.getMembers())) {
    expressionOrStatementMembers[`Expression.${name}`] = {
      match: (node: ts.Node | undefined): node is ts.ExpressionStatement =>
        node !== undefined &&
        ts.isExpressionStatement(node) &&
        member.match(node.expression),
      default: ts.createExpressionStatement(member.default),
    };
  }

  const statementVariants: LazyUnionVariant<string>[] = (
    TemplateUnionNode.fromUnion(
      statementUnion,
      someDefaultFromUnion(statementUnion),
      fromTsNode,
    ) as any
  ).variants;
  const variants: LazyUnionVariant<string>[] = [
    ...statementVariants.map(({ key, children }) => ({
      key: `Statement.${key}`,
      children,
    })),
    ...expressionVariants.map(({ key, children }) => ({
      key: `Expression.${key}`,
      children,
    })),
  ];

  return {
    union: {
      name: "ExpressionOrStatement",
      getMembers: () => expressionOrStatementMembers,
    },
    variants,
  };
}

function getUnionValue(
  node: TemplateUnionNode<ts.Node | undefined>,
): UnionVariant<string> {
  return (node as any).value;
}

function setUnionValue(
  node: TemplateUnionNode<ts.Node | undefined>,
  value: UnionVariant<string>,
) {
  (node as any).value = value;
  node.children = value.children;
}

export const expressionStatementTransform: Transform = (node) => {
  if (node instanceof RequiredHoleNode) {
    const inner: typeof node = (node as any).inner;
    const transformedInner = expressionStatementTransform(inner);
    if (transformedInner === inner) {
      return node;
    }
    const transformedOuter = new RequiredHoleNode(transformedInner);
    transformedOuter.id = node.id;
    return transformedOuter;
  }

  if (
    !(node instanceof TemplateUnionNode) ||
    node.getUnionName() !== "Statement"
  ) {
    return node;
  }
  const { union: transformedUnion, variants: transformedVariants } =
    makeExpressionOrStatement((node as any)._union);

  const transformedUnionValue = { ...getUnionValue(node) };
  const transformedNode = new TemplateUnionNode(
    transformedUnion,
    transformedVariants,
    transformedUnionValue,
    node.original,
  );
  transformedNode.id = node.id;

  if (transformedUnionValue.key === "ExpressionStatement") {
    if (transformedUnionValue.children.length !== 1) {
      console.warn(
        "TemplateUnionNode for Statement has unexpected number of children",
      );
      return node;
    }
    const expressionNode = transformedUnionValue.children[0].node.getByPath([
      "expression",
    ]);
    if (
      !expressionNode ||
      !(expressionNode instanceof TemplateUnionNode) ||
      expressionNode.getUnionName() !== "Expression"
    ) {
      console.warn(
        "TemplateUnionNode for Statement does not contain a TemplateUnionNode for Expression",
      );
      return node;
    }
    const expressionValueNode = expressionNode.getByPath(["value"]);
    if (!expressionValueNode) {
      console.warn(
        'TemplateUnionNode for Expression does not have "value" child',
      );
      return node;
    }
    transformedUnionValue.key = `Expression.${
      getUnionValue(expressionNode).key
    }`;
    transformedUnionValue.children = [
      { key: "value", node: expressionValueNode },
    ];
  } else {
    transformedUnionValue.key = `Statement.${transformedUnionValue.key}`;
  }
  setUnionValue(transformedNode, transformedUnionValue);

  transformedNode.unapplyTransform = () => {
    try {
      const untransformedNode = TemplateUnionNode.fromUnion<ts.Statement>(
        unions.Statement,
        someDefaultFromUnion<ts.Statement>(unions.Statement),
        fromTsNode,
      );
      untransformedNode.id = node.id;

      const untransformedUnionValue = { ...getUnionValue(transformedNode) };
      if (untransformedUnionValue.key.startsWith("Statement.")) {
        untransformedUnionValue.key = untransformedUnionValue.key.slice(
          "Statement.".length,
        );
      } else if (untransformedUnionValue.key.startsWith("Expression.")) {
        untransformedUnionValue.key = "ExpressionStatement";
      } else {
        throw new Error(
          `unexpected modifiedUnionValue.key: ${untransformedUnionValue.key}`,
        );
      }
      setUnionValue(untransformedNode, untransformedUnionValue);

      return { ok: true, value: untransformedNode };
    } catch (err) {
      return { ok: false, error: { message: err.message, path: [] } };
    }
  };

  return transformedNode;
};
