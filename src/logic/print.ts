import type { Options } from "prettier";
import parserTypescript from "prettier/parser-typescript";
import { format as prettierFormat } from "prettier/standalone";
import ts from "typescript";
import { astFromTypescriptFileContent } from "./parse";

const PRETTIER_OPTIONS: Options = {
  parser: "typescript",
  printWidth: 80,
  trailingComma: "all",
  plugins: [parserTypescript],
};

function createPrinter() {
  return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
}

export function prettyPrintTsSourceFile(file: ts.SourceFile): string {
  const printer = createPrinter();
  const unformattedText = printer.printNode(ts.EmitHint.SourceFile, file, file);
  return prettyPrintTsString(unformattedText);
}

export function prettyPrintTsString(unformattedText: string): string {
  const printer = createPrinter();

  const formattedText = prettierFormat(unformattedText, PRETTIER_OPTIONS);

  const transformer: ts.TransformerFactory<ts.SourceFile> =
    (context) => (rootNode) => {
      function visit(node: ts.Node): ts.Node {
        if (ts.isParenthesizedExpression(node)) {
          return ts.visitEachChild(node.expression, visit, context);
        }
        return ts.visitEachChild(node, visit, context);
      }
      return ts.visitNode(rootNode, visit);
    };

  const formattedAst = astFromTypescriptFileContent(formattedText);
  const transformResult = ts.transform(formattedAst, [transformer]);
  const astWithoutParens = transformResult.transformed[0];

  const textWithoutParens = printer.printFile(astWithoutParens);
  return textWithoutParens;
}
