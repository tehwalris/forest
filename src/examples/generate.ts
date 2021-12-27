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
import { defaultPrettierOptions, prettyPrintTsString } from "../logic/print";
import { CharSelection, renderLinesFromDoc } from "../logic/render";
import { examples } from "./examples";
import { Example } from "./interfaces";
import { eventsFromEventCreator } from "./keys";

const prettierOptions = {
  ...defaultPrettierOptions,
  printWidth: 55,
};

const outputDir = path.join(__dirname, `../../latex-out/examples`);
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
for (const example of examples) {
  console.log(example.name);
  const history = runExample(example);
  writeExample(example, history);
}

function asPrettyDoc(uglyText: string): Doc {
  return docFromAst(
    astFromTypescriptFileContent(
      prettyPrintTsString(uglyText, prettierOptions),
    ),
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
    prettierOptions,
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
  for (const [i, state] of history.entries()) {
    fs.writeFileSync(
      path.join(outputDir, `${example.name}-${i}.ts.tex`),
      generateEscapedTs(state),
      {
        encoding: "utf-8",
      },
    );
  }
  fs.writeFileSync(
    path.join(outputDir, `${example.name}.tex`),
    generateExampleTex(example, history),
    { encoding: "utf-8" },
  );
}

function generateEscapedTs({
  doc,
  mode,
  cursors,
  queuedCursors,
}: DocManagerPublicState): string {
  const lines = renderLinesFromDoc(
    doc,
    mode,
    cursors,
    queuedCursors.map((c) => ({
      range: c.focus,
      value: CharSelection.Queued,
    })),
  );
  const verbatimLines = lines
    .map((l) =>
      l.regions
        .map((r) => {
          const saveVerb = String.raw`\SaveVerb{Verb}^${r.text}^`;
          const useVerb = String.raw`\strut\UseVerb{Verb}`;
          const wrapped = (() => {
            if (r.selection & CharSelection.Normal) {
              return String.raw`\adjustbox{bgcolor=green}{${useVerb}}`;
            }
            return useVerb;
          })();
          return `${saveVerb}${wrapped}`;
        })
        .join(""),
    )
    .join("\\\\\n");
  return String.raw`
    \begin{flushleft}
      \setlength{\fboxsep}{0pt}
      ${verbatimLines}
    \end{flushleft}
  `;
}

function generateExampleTex(
  example: Example,
  history: DocManagerPublicState[],
): string {
  function generateStep(i: number) {
    return String.raw`
      \begin{examplestep}
        \small
        \input{examples/${example.name}-${i}.ts.tex}
        \normalsize
        \captionof{figure}{${
          i === 0 ? "Initial state" : example.describedGroups[i - 1].description
        }}
      \end{examplestep}
    `;
  }

  return String.raw`
\FloatBarrier
\subsection{${example.name}}
\label{example:${example.name}}
${history.map((_entry, i) => generateStep(i)).join("\n")}
\FloatBarrier
  `;
}
