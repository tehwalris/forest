import ts from "typescript";
import { Transform } from "..";
import { fromTsNode } from "../../providers/typescript/convert";
import {
  shortcutsByType,
  unions,
} from "../../providers/typescript/generated/templates";
import {
  RequiredHoleNode,
  someDefaultFromUnion,
  TemplateUnionNode,
  Union,
} from "../../providers/typescript/template-nodes";
import { InputKind } from "../../tree/action";
import { UnionVariant } from "../../tree/base-nodes";
import { LazyUnionVariant } from "../../tree/base-nodes/union";
import { BuildResult, Node } from "../../tree/node";
import { unreachable } from "../../util";

const exampleExpressionNode = TemplateUnionNode.fromUnion(
  unions.Expression,
  someDefaultFromUnion(unions.Expression),
  fromTsNode,
);

const expressionVariants: LazyUnionVariant<string>[] = (
  exampleExpressionNode as any
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

  const statementUnion: Union<ts.Statement> = (node as any)._union;
  const { union: transformedUnion, variants: transformedVariants } =
    makeExpressionOrStatement(statementUnion);

  function routeToInnerUnion(outerKey: string): {
    route: "Statement" | "Expression";
    key: string;
    union: Union<ts.Node | undefined>;
  } {
    if (outerKey.startsWith("Statement.")) {
      return {
        route: "Statement",
        key: outerKey.slice("Statement.".length),
        union: statementUnion,
      };
    } else if (outerKey.startsWith("Expression.")) {
      return {
        route: "Expression",
        key: outerKey.slice("Expression.".length),
        union: unions.Expression,
      };
    } else {
      throw new Error(`unexpected outerKey: ${outerKey}`);
    }
  }

  class TransformedTemplateUnionNode extends TemplateUnionNode<
    ts.Node | undefined
  > {
    constructor(
      union: Union<ts.Node | undefined>,
      variants: LazyUnionVariant<string>[],
      value: UnionVariant<string>,
      original: ts.Node | undefined,
    ) {
      super(union, variants, value, original);
      this.actions.replace = {
        inputKind: InputKind.Node,
        apply: (...args) => {
          let nodeForReplace = args[0];
          const expressionReplaceResult =
            exampleExpressionNode.actions.replace?.apply(...args);
          if (
            expressionReplaceResult &&
            expressionReplaceResult !== exampleExpressionNode
          ) {
            const buildResult = expressionReplaceResult.build();
            if (!buildResult.ok) {
              console.warn(
                "expected expressionReplaceResult to build successfully",
              );
              return this;
            }
            nodeForReplace = fromTsNode(
              ts.createExpressionStatement(buildResult.value as ts.Expression),
              unions.Expression,
            );
          }

          const nodeAfterReplace = node.actions.replace?.apply(nodeForReplace);
          if (!nodeAfterReplace || nodeAfterReplace === node) {
            return this;
          }
          return expressionStatementTransform(nodeAfterReplace);
        },
      };
    }

    clone(): TransformedTemplateUnionNode {
      const node = new TransformedTemplateUnionNode(
        (this as any)._union,
        (this as any).variants,
        this.value,
        this.original,
      );
      node.id = this.id;
      return node;
    }

    setValue(value: UnionVariant<string>): TransformedTemplateUnionNode {
      const node = new TransformedTemplateUnionNode(
        (this as any)._union,
        (this as any).variants,
        value,
        this.original,
      );
      node.id = this.id;
      return node;
    }

    getShortcut(key: string) {
      return shortcutsByType.get(routeToInnerUnion(key).key);
    }

    getLabel(key: string) {
      return routeToInnerUnion(key).key;
    }

    unapplyTransform(): BuildResult<Node<ts.Node | undefined>> {
      try {
        const untransformedNode = TemplateUnionNode.fromUnion<ts.Statement>(
          unions.Statement,
          someDefaultFromUnion<ts.Statement>(unions.Statement),
          fromTsNode,
        );
        untransformedNode.id = node.id;

        const untransformedUnionValue = { ...getUnionValue(this) };
        const { route, key: innerKey } = routeToInnerUnion(
          untransformedUnionValue.key,
        );
        switch (route) {
          case "Statement":
            untransformedUnionValue.key = innerKey;
            break;
          case "Expression":
            untransformedUnionValue.key = "ExpressionStatement";
            untransformedUnionValue.children =
              untransformedUnionValue.children.map((c) => ({
                key: c.key,
                node: fromTsNode(
                  ts.createExpressionStatement(ts.createIdentifier("")),
                ).setDeepChild(["expression", "value"], c.node),
              }));
            break;
          default:
            return unreachable(route);
        }
        setUnionValue(untransformedNode, untransformedUnionValue);

        return { ok: true, value: untransformedNode };
      } catch (err) {
        return { ok: false, error: { message: err.message, path: [] } };
      }
    }

    getNodeForCopy() {
      const buildResult = this.build();
      if (buildResult.ok) {
        return fromTsNode(
          buildResult.value && ts.isExpressionStatement(buildResult.value)
            ? buildResult.value.expression
            : buildResult.value,
          routeToInnerUnion(this.value.key).union,
        );
      }
      return this;
    }

    build(): BuildResult<ts.Node | undefined> {
      return this.buildHelper(({ value }) =>
        routeToInnerUnion(this.value.key).route === "Expression"
          ? ts.createExpressionStatement(value)
          : value,
      );
    }
  }

  const transformedUnionValue = { ...getUnionValue(node) };
  const transformedNode = new TransformedTemplateUnionNode(
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

  return transformedNode;
};
