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
import { unreachable } from "../logic/util";
import { examples } from "./examples";
import {
  DescribedGroup,
  EventCreator,
  EventCreatorKind,
  Example,
} from "./interfaces";
import { eventsFromEventCreator } from "./keys";

const prettierOptions = {
  ...defaultPrettierOptions,
  printWidth: 55,
};

function main() {
  const outputDir = path.join(__dirname, `../../latex-out/examples`);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const example of examples) {
    console.log(example.name);
    const history = runExample(example);
    writeExample(example, history, outputDir);
  }
  writeIndex(examples, outputDir);
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
        if (typeof eventOrFunction === "function") {
          eventOrFunction(docManager);
        } else {
          const { handler, event } = eventOrFunction;
          docManager[handler](event);
        }
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

function writeIndex(examples: Example[], outputDir: string) {
  fs.writeFileSync(
    path.join(outputDir, `index.tex`),
    examples.map((e) => `\\input{examples/${e.name}}\\clearpage`).join("\n"),
    { encoding: "utf-8" },
  );
}

function writeExample(
  example: Example,
  history: DocManagerPublicState[],
  outputDir: string,
) {
  for (const [i, state] of history.entries()) {
    fs.writeFileSync(
      path.join(outputDir, `${example.name}-${i}.tex`),
      generateStepTex(
        state,
        i === 0 ? [] : example.describedGroups[i - 1].eventCreators,
      ),
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

const latexKeyMapping = new Map<string, string>([
  ["escape", "\\esc"],
  ["ctrl", "\\ctrl"],
  ["shift", "\\shift"],
  ["alt", "\\Alt"],
  ["space", "\\SPACE"],
  ["backspace", "\\backspace"],
  ["h", "\\arrowkeyleft"],
  ["l", "\\arrowkeyright"],
  ["k", "\\arrowkeyup"],
  ["j", "\\arrowkeydown"],
  ...["{", "}", "[", "]"].map((k): [string, string] => [k, `\\${k}`]),
  ...["(", ")"].map((k): [string, string] => [k, k]),
]);

function latexFromEventCreator(eventCreator: EventCreator): string {
  switch (eventCreator.kind) {
    case EventCreatorKind.FromKeys: {
      return eventCreator.keys
        .split(/\s+/)
        .map((combo) =>
          combo
            .split("-")
            .map((key) => {
              const latexKey = latexKeyMapping.get(key);
              if (latexKey) {
                return latexKey;
              }
              if (key.match(/^[a-z]$/)) {
                return key;
              }
              throw new Error(`unmapped key: ${key}`);
            })
            .join("+"),
        )
        .map((combo) => `\\keys{${combo}}`)
        .join("\\hspace{2mm}");
    }
    case EventCreatorKind.ToTypeString: {
      return String.raw`Type \SaveVerb{Verb}^${eventCreator.string}^\adjustbox{bgcolor={HTML}{F2F2F2}}{\strut\UseVerb{Verb}}`;
    }
    case EventCreatorKind.Function: {
      return eventCreator.description;
    }
    default: {
      return unreachable(eventCreator);
    }
  }
}

function generateStepTex(
  { doc, mode, cursors, queuedCursors }: DocManagerPublicState,
  eventCreators: EventCreator[],
): string {
  const renderLines = renderLinesFromDoc(
    doc,
    mode,
    cursors,
    queuedCursors.map((c) => ({
      range: c.focus,
      value: CharSelection.Queued,
    })),
  );
  const latexCodeLines = renderLines
    .map((l) =>
      l.regions
        .map((r) => {
          const saveVerb = String.raw`\SaveVerb{Verb}^${r.text}^`;
          const useVerb = String.raw`\strut\UseVerb{Verb}`;
          const wrapped = (() => {
            if (r.selection & CharSelection.Normal) {
              return String.raw`\adjustbox{bgcolor={HTML}{A5BFFF}}{${useVerb}}`;
            }
            return useVerb;
          })();
          return `${saveVerb}${wrapped}`;
        })
        .join(""),
    )
    .join("\\\\\n");
  const eventLines = eventCreators
    .map((c) => latexFromEventCreator(c))
    .join("\\\\\n");
  return String.raw`
    \adjustbox{bgcolor={HTML}{F2F2F2}}{
      \begin{minipage}{\columnwidth}
        \begin{flushleft}
          \setlength{\fboxsep}{0pt}
          ${latexCodeLines}
        \end{flushleft}
      \end{minipage}
    }
    \begin{flushleft}
      ${eventLines}
    \end{flushleft}
  `;
}

function generateExampleTex(
  example: Example,
  history: DocManagerPublicState[],
): string {
  function generateStepWrapper(i: number) {
    const g: DescribedGroup | undefined =
      i === 0 ? undefined : example.describedGroups[i - 1];
    return String.raw`
      \begin{examplestep}
        \small
        \input{examples/${example.name}-${i}.tex}
        \normalsize
        \captionof{figure}{${g?.description ?? "Initial state"}}
        ${g?.label ? `\\label{step:${example.name}:${g.label}}` : ""}
      \end{examplestep}
    `;
  }

  return String.raw`
\FloatBarrier
\subsection{${example.name}}
\label{example:${example.name}}
\setcounter{figure}{0}
${history.map((_entry, i) => generateStepWrapper(i)).join("\n")}
\FloatBarrier
  `;
}

main();
