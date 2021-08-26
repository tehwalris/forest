import ts from "typescript";

export type LiveStringHelperResult<T extends ts.Node> =
  | {
      ok: true;
      message: string;
      node: T;
    }
  | {
      ok: false;
      message: string;
    };

export type LiveStringHelper<T extends ts.Node> = (
  input: string,
) => LiveStringHelperResult<T>;

interface TypeWithRegex {
  name: string;
  regex: RegExp;
  makeTsNode: (m: RegExpMatchArray) => ts.Node;
}

const orderedTypesWithRegex: TypeWithRegex[] = [
  {
    name: "TrueLiteral",
    regex: /^true$/,
    makeTsNode: () => ts.createLiteral(true),
  },
  {
    name: "FalseLiteral",
    regex: /^false$/,
    makeTsNode: () => ts.createLiteral(false),
  },
  {
    name: "Identifier",
    regex: /^[a-zA-Z_$][a-zA-Z_$\d]*$/,
    makeTsNode: (m) => ts.createIdentifier(m[0]),
  },
  {
    name: "StringLiteral",
    regex: /^(?<quote>["'])(?<inner>.*)\k<quote>$/,
    makeTsNode: (m) => ts.createStringLiteral(m.groups!.inner),
  },
  {
    name: "NumericLiteral",
    regex: /^(?:\d+\.?\d*(?:e\d+)?|0b[01]+|0o[0-7]+|0x[0-9a-fA-F]+)$/,
    makeTsNode: (m) => ts.createNumericLiteral(m[0]),
  },
];

export function makeLiveStringHelper(
  supportedTypeNames: (
    | "Identifier"
    | "StringLiteral"
    | "NumericLiteral"
    | "TrueLiteral"
    | "FalseLiteral"
  )[],
): LiveStringHelper<any> {
  const supportedTypes = orderedTypesWithRegex.filter(({ name }) =>
    (supportedTypeNames as string[]).includes(name),
  );

  return (_input: string): LiveStringHelperResult<ts.Node> => {
    const input = _input.trim();
    if (!input.length) {
      return {
        ok: false,
        message: `Enter one of [${supportedTypes
          .map((t) => t.name)
          .join(", ")}] or press enter for more options`,
      };
    }

    for (const { name, regex, makeTsNode } of supportedTypes) {
      const m = input.match(regex);
      if (!m) {
        continue;
      }
      return {
        ok: true,
        message: `Press enter to create ${name}`,
        node: makeTsNode(m),
      };
    }

    return {
      ok: false,
      message: `Input is not valid as any of [${supportedTypes
        .map((t) => t.name)
        .join(", ")}]`,
    };
  };
}
