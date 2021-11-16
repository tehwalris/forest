import { promisify } from "util";
import { DocManager, initialDocManagerPublicState } from "../doc-manager";
import { docFromAst } from "../node-from-ts";
import { astFromTypescriptFileContent } from "../parse";
import { prettyPrintTsString } from "../print";
import { Fs } from "./fs";

export async function roundTripFile(fs: Fs, path: string): Promise<void> {
  const oldText = await promisify(fs.readFile)(path, { encoding: "utf-8" });

  let publicState = initialDocManagerPublicState;
  const initialDoc = docFromAst(
    astFromTypescriptFileContent(prettyPrintTsString(oldText)),
  );
  const docManager = new DocManager(initialDoc, (s) => {
    publicState = s;
  });
  docManager.forceUpdate();
  const newText = publicState.doc.text;

  await promisify(fs.writeFile)(path, newText, { encoding: "utf-8" });
}
