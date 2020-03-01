const fs = require("fs");
const path = require("path");
const R = require("ramda");

const input = fs.readFileSync(
  path.join(__dirname, "./template-templates.txt"),
  "utf8",
);

const {
  unions,
  plainTypes,
  tokenTypes,
  plainTokens,
  stringTemplates,
  listTemplates,
  structTemplates,
  shortcuts,
} = R.pipe(
  R.split("\n"),
  R.filter(R.trim),
  R.groupWith((a, b) => !b.startsWith("SECTION")),
  R.map(
    R.juxt([
      e => e[0].split(" ")[1],
      R.pipe(
        R.slice(1, Infinity),
        R.groupWith((a, b) => b.startsWith(" ")),
        R.map(R.map(R.pipe(R.split(" "), R.map(R.trim), R.filter(R.identity)))),
      ),
    ]),
  ),
  R.fromPairs(),
  R.evolve({
    unions: R.map(
      R.pipe(R.flatten, e => ({ name: e[0], variants: e.slice(1) })),
    ),
    plainTypes: R.map(
      R.pipe(R.flatten, e => ({
        name: e[0],
        match: e[1] === "-" ? `ts.is${e[0]}` : e[1].replace(/__/g, " "),
        create: e.slice(2).join(" "),
      })),
    ),
    tokenTypes: R.map(
      R.pipe(R.flatten, e => ({ name: e[0], kinds: e.slice(1) })),
    ),
    plainTokens: R.map(
      R.pipe(R.flatten, e => ({ name: e[0], isType: e[1] === "T" })),
    ),
    stringTemplates: R.map(
      R.pipe(R.flatten, e => ({ name: e[0], build: e.slice(1).join(" ") })),
    ),
    listTemplates: R.map(
      R.pipe(
        R.juxt([
          R.pipe(R.head, e => ({
            name: e[0],
            childType: e[1],
            childKey: e[2],
          })),
          R.pipe(
            R.tail,
            R.map(R.juxt([R.head, R.pipe(R.tail, R.join(" "))])),
            R.fromPairs,
          ),
        ]),
        R.mergeAll,
      ),
    ),
    structTemplates: R.map(
      R.pipe(
        R.juxt([
          R.pipe(R.head, e => ({ name: e[0] })),
          R.pipe(
            R.tail,
            R.map(R.juxt([R.head, R.pipe(R.tail, R.join(" "))])),
            R.fromPairs,
            R.omit(["R", "O", "RL", "OL", "flags"]),
          ),
          R.pipe(
            R.tail,
            R.filter(R.pipe(R.head, R.contains(R.__, ["R", "O", "RL", "OL"]))),
            R.map(e => ({
              key: e[1],
              union: e[2],
              optional: e[0][0] === "O",
              list: e[0][1] === "L",
              tsType:
                e.length > 3 &&
                e
                  .slice(3)
                  .join(" ")
                  .split("load ")[0],
              load:
                e.length > 3 &&
                e
                  .slice(3)
                  .join(" ")
                  .split("load ")[1],
            })),
            x => ({ children: x }),
          ),
          R.pipe(
            R.tail,
            R.filter(R.pipe(R.head, R.equals("flags"))),
            R.chain(R.tail),
            x => ({ flags: x }),
          ),
          R.pipe(
            R.tail,
            R.filter(R.pipe(R.head, R.equals("primary"))),
            R.chain(R.tail),
            primary => {
              if (!primary.length) {
                return undefined;
              }
              const spread = primary.some(v => v.startsWith("..."));
              if (spread && primary.length !== 1) {
                throw new Error(
                  "meta split: spread can only be used when there is 1 primary field",
                );
              }
              if (spread) {
                return {
                  primaryChildren: [primary[0].slice(3)],
                  spreadPrimary: true,
                };
              }
              return { primaryChildren: primary };
            },
            x => ({ metaSplit: x }),
          ),
        ]),
        R.mergeAll,
      ),
    ),
    shortcuts: R.map(R.pipe(R.flatten, e => ({ shortcut: e[0], type: e[1] }))),
  }),
  R.evolve({
    unions: unions => {
      function resolveVariants(union) {
        return R.chain(
          v =>
            v.startsWith("...")
              ? resolveVariants(unions.find(e => e.name === v.slice(3)))
              : [v],
          union.variants,
        );
      }
      return R.map(
        union => ({
          ...union,
          variants: resolveVariants(union),
        }),
        unions,
      );
    },
  }),
)(input);

const output =
  [
    `
import * as ts from 'typescript'
import {
  StringTemplate,
  ListTemplate,
  StructTemplate,
  RequiredStructSingleChild,
  OptionalStructSingleChild,
  RequiredStructListChild,
  OptionalStructListChild,
} from "../template-nodes";
import { enchancers, makeUnionMemberEnchancer } from "../enchancer";
import {
  FlagKind
} from "../flags";
import {
  DisplayInfoPriority,
  LabelPart,
  LabelStyle,
  SemanticColor,
  Node, 
} from '../../../tree/node';

// https://github.com/Microsoft/Typescript/issues/20875
function isTypeOfWorkaround(node: ts.Node): node is ts.TypeOfExpression {
  return node.kind === ts.SyntaxKind.TypeOfExpression
}
`,
    "export const plainTypes = {",
    ...plainTypes.map(e =>
      `
${e.name}: {
  match: ${e.match},
  default: ${e.create},
},
`.trim(),
    ),
    ...tokenTypes.map(e =>
      `
${e.name}: {
  match: (e: ts.Node): e is ts.${e.name} => [
    ${e.kinds.map(c => `ts.SyntaxKind.${c}`).join(",")}
  ].some(k => e.kind === k),
  default: {kind: ts.SyntaxKind.${e.kinds[0]} } as ts.${e.name}
},
`.trim(),
    ),
    ...plainTokens
      .filter(e => !e.isType)
      .map(e =>
        `
${e.name}: {
  match: (e: ts.Node): e is ts.Token<ts.SyntaxKind.${e.name}> =>
    e.kind === ts.SyntaxKind.${e.name},
  default: {kind: ts.SyntaxKind.${e.name} } as ts.Token<ts.SyntaxKind.${e.name}>
},
`.trim(),
      ),
    ...plainTokens
      .filter(e => e.isType)
      .map(e =>
        `
${e.name}: {
  match: (e: ts.Node): e is ts.KeywordTypeNode & {kind: ts.SyntaxKind.${e.name}} =>
    e.kind === ts.SyntaxKind.${e.name},
  default: {kind: ts.SyntaxKind.${e.name} } as ts.KeywordTypeNode & {kind: ts.SyntaxKind.${e.name}}
},
`.trim(),
      ),
    "}\n",
    "export const unions = {",
    ...unions.map(e =>
      `
${e.name}: () => ({
${e.variants.map(v => `${v}: plainTypes.${v},`).join("\n")}
}),
    `.trim(),
    ),
    "// Unit unions from plain types and token types",
    ...plainTypes.concat(tokenTypes).map(e =>
      `
${e.name}: () => ({
${e.name}: plainTypes.${e.name}
}),
    `.trim(),
    ),
    "}",
    "",
    `
for (const k of Object.keys(unions.DeclarationStatement())) {
  if (enchancers[k]) {
    continue;
  }
  enchancers[k] = makeUnionMemberEnchancer(k);
}
`.trim(),
    "",
    ...stringTemplates.map(
      e => `
const ${e.name}: StringTemplate<
  ts.${e.name}
> = {
  match: plainTypes.${e.name}.match,
  load: built => built.text,
  build: ${e.build},
  enchancer: enchancers["${e.name}"]
};
`,
    ),
    "export const stringTemplates = [",
    stringTemplates.map(e => e.name).join(","),
    "]\n",
    ...listTemplates.map(
      e => `
const ${e.name}: ListTemplate<
  ts.${e.name},
  ts.${e.childType}
> = {
  match: plainTypes.${e.name}.match,
  flags: [${(e.flags || "")
    .split(" ")
    .filter(e => e)
    .map(v => `"${v}"`)
    .join(", ")}] as FlagKind[],
  load: built => built.${e.childKey},
  build: ${e.build || `children => ts.create${e.name}(children)`},
  childUnion: unions.${e.childType}
};
`,
    ),
    "export const listTemplates = [",
    listTemplates.map(e => e.name).join(","),
    "]\n",
    ...structTemplates.map(
      e => `
const ${e.name}: StructTemplate<
  {
    ${e.children
      .map(c =>
        `
      ${c.key}:
${c.optional ? "Optional" : "Required"}Struct${
          c.list ? "List" : "Single"
        }Child<${c.tsType || "ts." + c.union}>;
    `.trim(),
      )
      .join("\n")}
  },
  ts.${e.name}
> = {
  match: plainTypes.${e.name}.match,
  children: [${e.children.map(c => `"${c.key}"`).join(",")}],
  metaSplit: ${e.metaSplit ? JSON.stringify(e.metaSplit) : undefined},
  flags: [${e.flags.map(v => `"${v}"`).join(", ")}] as FlagKind[],
  load: e => ({
    ${e.children
      .map(c =>
        `
      ${c.key}: {
        value: ${c.load || `e.${c.key}`},
        union: unions.${c.union},
        ${[c.optional ? "optional: true" : "", c.list ? "isList: true" : ""]
          .filter(v => v)
          .join(",")}
      },
    `.trim(),
      )
      .join("\n")}
  }),
  build: ${e.build},
  enchancer: enchancers["${e.name}"]
};
    `,
    ),
    ...plainTokens.map(
      e => `
const ${e.name}: StructTemplate<
  {},
  ts.Token<ts.SyntaxKind.${e.name}>
> = {
  match: plainTypes.${e.name}.match,
  children: [],
  flags: [],
  load: () => ({}),
  build: () => ts.createToken(ts.SyntaxKind.${e.name}),
  enchancer: enchancers["${e.name}"]
};
    `,
    ),
    ...tokenTypes
      .filter(e => e.kinds.length === 1)
      .map(
        e => `
const ${e.name}: StructTemplate<
  {},
  ts.${e.name}
> = {
  match: plainTypes.${e.name}.match,
  children: [],
  flags: [],
  load: () => ({}),
  build: () => plainTypes.${e.name}.default,
  enchancer: enchancers["${e.name}"]
};
    `,
      ),
    "export const structTemplates = [",
    structTemplates
      .concat(plainTokens)
      .concat(tokenTypes.filter(e => e.kinds.length === 1))
      .map(e => e.name)
      .join(","),
    "]\n",
    "export const typesByShortcut = new Map<string, string>([",
    ...shortcuts.map(e => `['${e.shortcut}', '${e.type}'],`),
    "]);",
    "export const shortcutsByType = new Map<string, string>([",
    ...shortcuts.map(e => `['${e.type}', '${e.shortcut}'],`),
    "]);",
  ].join("\n") + "\n";

fs.writeFileSync(path.join(__dirname, "./generated/templates.ts"), output);
