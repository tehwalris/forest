import fs from "fs";
import glob from "glob";
import path from "path";
import ts from "typescript";
import { docFromAst } from "../node-from-ts";
import { astFromTypescriptFileContent } from "../parse";
import {
  defaultPrettierOptions,
  prettyPrintTsSourceFile,
  uglyPrintTsSourceFile,
} from "../print";
import { tsNodeFromNode } from "../ts-from-node";

function printTsFileLikeForest(path: string): boolean {
  const uglyText = fs.readFileSync(path, "utf8");
  const prettyText = prettyPrintTsSourceFile(
    uglyPrintTsSourceFile(
      tsNodeFromNode(
        docFromAst(astFromTypescriptFileContent(uglyText)).root,
      ) as ts.SourceFile,
    ),
    defaultPrettierOptions,
  );
  if (uglyText === prettyText.text) {
    return false;
  } else {
    fs.writeFileSync(path, prettyText.text);
    return true;
  }
}

function main() {
  const filenames = glob.sync(
    path.join(__dirname, "../../../tasks/editing/paper-evaluation/**/*.ts"),
  );
  let totalChanged = 0;
  for (const filename of filenames) {
    const didChange = printTsFileLikeForest(filename);
    if (didChange) {
      console.log(filename);
      totalChanged++;
    }
  }
  console.log(`Formatted ${totalChanged} of ${filenames.length} files`);
}

main();
