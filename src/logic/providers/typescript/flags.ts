import * as ts from "typescript";
import { Flag, FlagSet, OneOfFlag } from "../../tree/node";
import * as R from "ramda";
export enum FlagKind {
  VARIABLE_FLAVOR = "variableFlavor",
  EXPORT = "export",
  AMBIENT = "ambient",
  DEFAULT = "default",
  ACCESIBILITY = "accesibility",
  STATIC = "static",
  READONLY = "readonly",
  ABSTRACT = "abstract",
  ASYNC = "async",
}
type TsFlags = { nodeFlags: ts.NodeFlags; modifierFlags: ts.ModifierFlags };
interface FlagTemplate<T extends Flag> {
  load: (tsFlags: TsFlags, modifiers: ts.Modifier[]) => T;
  saveModiferFlags?: (flag: T) => ts.Modifier[];
  saveNodeFlags?: (flag: T, nodeFlags: ts.NodeFlags) => ts.NodeFlags;
}
function createLoadBooleanFlag(
  from: "nodeFlags",
  target: ts.NodeFlags,
): (tsFlags: TsFlags) => boolean;
function createLoadBooleanFlag(
  from: "modifierFlags",
  target: ts.ModifierFlags,
): (tsFlags: TsFlags) => boolean;
function createLoadBooleanFlag(
  from: "nodeFlags" | "modifierFlags",
  target: ts.NodeFlags | ts.ModifierFlags,
): (tsFlags: TsFlags) => boolean {
  return (tsFlags) => {
    return !!(tsFlags[from] & target);
  };
}
function booleanModifierTemplate<T extends ts.Modifier["kind"]>(
  bit: ts.ModifierFlags,
  syntaxKind: T,
) {
  return {
    load: createLoadBooleanFlag("modifierFlags", bit),
    saveModiferFlags: (value: boolean) =>
      value ? [ts.createToken(syntaxKind)] : [],
  };
}
const ACCESIBLITY_CASES = [
  { kind: ts.SyntaxKind.PublicKeyword, name: "public" },
  { kind: ts.SyntaxKind.ProtectedKeyword, name: "protected" },
  { kind: ts.SyntaxKind.PrivateKeyword, name: "private" },
];
const templates: { [K in FlagKind]: FlagTemplate<any> } = {
  [FlagKind.VARIABLE_FLAVOR]: {
    load: ({ nodeFlags }: TsFlags): Flag => {
      const wrap = (value: string): Flag => ({
        oneOf: ["var", "let", "const"],
        value,
      });
      if (nodeFlags & ts.NodeFlags.Let) {
        return wrap("let");
      } else if (nodeFlags & ts.NodeFlags.Const) {
        return wrap("const");
      }
      return wrap("var");
    },
    saveNodeFlags: ({ value }, nodeFlags) => {
      const cleared = nodeFlags & ~(ts.NodeFlags.Let | ts.NodeFlags.Const);
      switch (value) {
        case "var":
          return cleared;
        case "let":
          return cleared | ts.NodeFlags.Let;
        case "const":
          return cleared | ts.NodeFlags.Const;
        default:
          throw new Error("Unsuported case");
      }
    },
  } as FlagTemplate<OneOfFlag>,
  [FlagKind.EXPORT]: booleanModifierTemplate(
    ts.ModifierFlags.Export,
    ts.SyntaxKind.ExportKeyword,
  ),
  [FlagKind.AMBIENT]: booleanModifierTemplate(
    ts.ModifierFlags.Ambient,
    ts.SyntaxKind.DeclareKeyword,
  ),
  [FlagKind.DEFAULT]: booleanModifierTemplate(
    ts.ModifierFlags.Default,
    ts.SyntaxKind.DefaultKeyword,
  ),
  [FlagKind.ACCESIBILITY]: {
    load: (_tsFlags, modifiers) => {
      const oneOf = ["unspecified", ...ACCESIBLITY_CASES.map((e) => e.name)];
      for (const c of ACCESIBLITY_CASES) {
        if (modifiers.find((m) => m.kind === c.kind)) {
          return { value: c.name, oneOf };
        }
      }
      return { value: "unspecified", oneOf };
    },
    saveModiferFlags: ({ value }) => {
      const c = ACCESIBLITY_CASES.find((c) => c.name === value);
      return c ? [ts.createToken(c.kind)] : [];
    },
  } as FlagTemplate<OneOfFlag>,
  [FlagKind.STATIC]: booleanModifierTemplate(
    ts.ModifierFlags.Static,
    ts.SyntaxKind.StaticKeyword,
  ),
  [FlagKind.READONLY]: booleanModifierTemplate(
    ts.ModifierFlags.Readonly,
    ts.SyntaxKind.ReadonlyKeyword,
  ),
  [FlagKind.ABSTRACT]: booleanModifierTemplate(
    ts.ModifierFlags.Abstract,
    ts.SyntaxKind.AbstractKeyword,
  ),
  [FlagKind.ASYNC]: booleanModifierTemplate(
    ts.ModifierFlags.Async,
    ts.SyntaxKind.AsyncKeyword,
  ),
};
function loadTsFlags(node: ts.Node) {
  return {
    nodeFlags: node.flags,
    modifierFlags: (ts as any).getSyntacticModifierFlags(node),
  };
}
export function loadFlags(node: ts.Node, kinds: FlagKind[]): FlagSet {
  const tsFlags = loadTsFlags(node);
  const modifiers: ts.Modifier[] = [...(node.modifiers || [])];
  const output: FlagSet = {};
  kinds.forEach((k) => {
    output[k] = templates[k].load(tsFlags, modifiers);
  });
  return output;
}
export function flagsToModifiers(flags: FlagSet): ts.Modifier[] {
  const modifiers: ts.Modifier[] = [];
  R.forEachObjIndexed((v, k) => {
    const save = templates[k as FlagKind].saveModiferFlags;
    if (save) {
      modifiers.push(...save(v));
    }
  }, flags);
  return modifiers;
}
export function saveNodeFlagsMutate(node: ts.Node, flags: FlagSet) {
  // HACK flags should be read only
  (node as any).flags = R.toPairs(flags).reduce(
    (a, [k, v]) =>
      (templates[k as FlagKind].saveNodeFlags || ((_, old) => old))(v, a),
    node.flags,
  );
}
