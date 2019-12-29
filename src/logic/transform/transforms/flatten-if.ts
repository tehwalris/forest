import { Transform } from "..";
import {
  Node,
  ChildNodeEntry,
  FlagSet,
  BuildResult,
  BuildResultFailure,
  BuildResultSuccess,
} from "../../tree/node";
import * as R from "ramda";
import * as ts from "typescript";
import { ActionSet } from "../../tree/action";
import { Link, Path } from "../../tree/base";
import { fromTsNode } from "../../providers/typescript/convert";
import { unions } from "../../providers/typescript/generated/templates";

// HACK There should be a better way to get the type of a node
function isIfStatement(node: Node<unknown>): node is Node<ts.IfStatement> {
  return R.equals(
    node.children.map(c => c.key),
    ["expression", "thenStatement", "elseStatement"],
  );
}

function unwrapUpToIfStatement(
  node: Node<unknown>,
  path: Path,
): { path: Path; node: Node<ts.IfStatement> } | undefined {
  if (isIfStatement(node)) {
    return { path, node };
  }
  if (node.children.length !== 1) {
    return undefined;
  }
  const buildResult = node.build();
  if (!buildResult.ok || !ts.isIfStatement(buildResult.value as ts.Node)) {
    return undefined;
  }
  return unwrapUpToIfStatement(node.children[0].node, [
    ...path,
    node.children[0].key,
  ]);
}

export const flattenIfTransform: Transform = node => {
  if (!isIfStatement(node)) {
    return node;
  }
  const flat = new FlatIfNode(node, flattenIf(node)) as any;
  flat.id = node.id;
  return flat;
};

interface FlatIfBranch {
  path: Path;
  condition: Node<ts.Expression>;
  thenStatement: Node<ts.Statement>;
}

function getVirtualElseCondition(
  elseStatement: Node<ts.Statement>,
): Node<ts.Expression> {
  const node = fromTsNode(ts.createLiteral(true), unions.Expression);
  node.id = elseStatement.id + "-virtual-else-condition";
  return node;
}

function flattenIf(
  nested: Node<ts.IfStatement>,
  path: Path = [],
): FlatIfBranch[] {
  const output: FlatIfBranch[] = [
    {
      path,
      condition: nested.getByPath(["expression"])! as Node<ts.Expression>,
      thenStatement: nested.getByPath(["thenStatement"])! as Node<ts.Statement>,
    },
  ];
  const elseStatementRaw = nested.getByPath(["elseStatement"])!;
  const elseStatement = unwrapUpToIfStatement(elseStatementRaw, [
    ...path,
    "elseStatement",
  ]);
  if (elseStatement) {
    output.push(...flattenIf(elseStatement.node, elseStatement.path));
  } else {
    output.push({
      path,
      condition: getVirtualElseCondition(elseStatementRaw),
      thenStatement: elseStatementRaw,
    });
  }
  return output;
}

class FlatIfNode extends Node<ts.IfStatement> {
  children: ChildNodeEntry<FlatIfBranch>[];
  flags: FlagSet = {};
  actions: ActionSet<Node<ts.IfStatement>> = {};
  links: Link[] = [];

  constructor(
    private originalNode: Node<ts.IfStatement>,
    branches: FlatIfBranch[],
  ) {
    super();
    this.children = branches.map((b, i) => ({
      key: `if ${i}`,
      node: new FlatIfBranchNode(b),
    }));
  }

  clone(): FlatIfNode {
    const node = new FlatIfNode(this.originalNode, []);
    node.children = this.children;
    node.id = this.id;
    return node;
  }

  setChild(child: ChildNodeEntry<FlatIfBranch>): FlatIfNode {
    const node = this.clone();
    node.children = node.children.map(c => (c.key === child.key ? child : c));
    return node;
  }

  setFlags(flags: FlagSet): FlatIfNode {
    throw new Error("not implemented");
  }

  build(): BuildResult<ts.IfStatement> {
    const result = this.unapplyTransform();
    if (!result.ok) {
      return result;
    }
    return result.value.build();
  }

  unapplyTransform(): BuildResult<Node<ts.IfStatement>> {
    const childBuildResults = this.children.map(c => ({
      key: c.key,
      result: c.node.build(),
    }));
    const firstChildError = childBuildResults.find(r => !r.result.ok);
    if (firstChildError) {
      const error = (firstChildError.result as BuildResultFailure).error;
      return {
        ok: false,
        error: {
          message: error.message,
          path: [...error.path, firstChildError.key],
        },
      };
    }

    let node = this.originalNode;
    childBuildResults
      .map(r => (r.result as BuildResultSuccess<FlatIfBranch>).value)
      .forEach(b => {
        if (b.condition) {
          node = node.setDeepChild([...b.path, "expression"], b.condition);
          node = node.setDeepChild(
            [...b.path, "thenStatement"],
            b.thenStatement,
          );
        } else {
          node = node.setDeepChild(
            [...b.path, "elseStatement"],
            b.thenStatement,
          );
        }
      });
    return { ok: true, value: node };
  }

  getDebugLabel(): string | undefined {
    return "FlatIfNode";
  }
}

class FlatIfBranchNode extends Node<FlatIfBranch> {
  children: ChildNodeEntry<any>[] = [];
  flags: FlagSet = {};
  actions: ActionSet<Node<FlatIfBranch>> = {};
  links: Link[] = [];

  constructor(private branch: FlatIfBranch) {
    super();
    if (branch.condition) {
      // TODO Maybe use an option
      this.children.push({
        key: "condition",
        node: branch.condition,
      });
    }
    this.children.push({
      key: "thenStatement",
      node: branch.thenStatement,
    });
    this.id = branch.thenStatement.id + "-flat-if-branch";
  }

  clone(): FlatIfBranchNode {
    const node = new FlatIfBranchNode(this.branch);
    node.children = this.children;
    node.id = this.id;
    return node;
  }

  setChild(child: ChildNodeEntry<unknown>): FlatIfBranchNode {
    const node = this.clone();
    node.children = node.children.map(c => (c.key === child.key ? child : c));
    return node;
  }

  setFlags(flags: FlagSet): FlatIfBranchNode {
    throw new Error("not implemented");
  }

  build(): BuildResult<FlatIfBranch> {
    return {
      ok: true,
      value: {
        path: this.branch.path,
        condition: this.getByPath(["condition"])!,
        thenStatement: this.getByPath(["thenStatement"])!,
      },
    };
  }

  getDebugLabel(): string | undefined {
    return "FlatIfBranchNode";
  }
}
