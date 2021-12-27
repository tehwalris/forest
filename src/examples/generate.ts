import fs from "fs";
import path from "path";
import {
  DocManager,
  DocManagerPublicState,
  initialDocManagerPublicState,
  Mode,
} from "../logic/doc-manager";
import { Doc } from "../logic/interfaces";
import { docFromAst } from "../logic/node-from-ts";
import { astFromTypescriptFileContent } from "../logic/parse";
import { prettyPrintTsString } from "../logic/print";
import { examples } from "./examples";
import { Example } from "./interfaces";
import { eventsFromEventCreator } from "./keys";

const allExamplesOutputDir = path.join(__dirname, `../../latex-out/examples`);
fs.rmSync(allExamplesOutputDir, { recursive: true, force: true });
fs.mkdirSync(allExamplesOutputDir, { recursive: true });
for (const example of examples) {
  console.log(example.name);
  const history = runExample(example);
  writeExample(example, history);
}

function asPrettyDoc(uglyText: string): Doc {
  return docFromAst(
    astFromTypescriptFileContent(prettyPrintTsString(uglyText)),
  );
}

function runExample(example: Example): DocManagerPublicState[] {
  const loadText = (suffix: string) =>
    fs.readFileSync(
      path.join(__dirname, `../../tasks/editing/${example.name}.${suffix}.ts`),
      "utf-8",
    );

  const initialDoc = asPrettyDoc(loadText("before"));
  let publicState = initialDocManagerPublicState;
  const docManager = new DocManager(
    initialDoc,
    (s) => {
      publicState = s;
    },
    false,
  );
  docManager.forceUpdate();
  const history = [publicState];
  for (const group of example.describedGroups) {
    for (const eventCreator of group.eventCreators) {
      for (const eventOrFunction of eventsFromEventCreator(eventCreator)) {
        const { handler, event } = eventOrFunction;
        docManager[handler](event);
      }
    }
    history.push(publicState);
  }
  if (publicState.doc.text !== asPrettyDoc(loadText("after")).text) {
    throw new Error(`final text does not match ${example.name}.after.ts`);
  }
  if (publicState.mode !== Mode.Normal) {
    throw new Error("final mode is not Mode.Normal");
  }
  return history;
}

function writeExample(example: Example, history: DocManagerPublicState[]) {
  const exampleOutputDir = path.join(allExamplesOutputDir, example.name);
  fs.mkdirSync(exampleOutputDir);
  for (const [i, state] of history.entries()) {
    fs.writeFileSync(path.join(exampleOutputDir, `${i}.ts`), state.doc.text, {
      encoding: "utf-8",
    });
  }
}
