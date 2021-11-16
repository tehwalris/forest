import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./App";
import "./index.css";
import { configureRemoteFs } from "./logic/tasks/fs";
import { roundTripFile } from "./logic/tasks/round-trip";
(async () => {
  const _paths = `
    src/react-app-env.d.ts
    src/components/linear-editor.tsx
    src/logic/compiler-host.ts
    src/logic/paste.ts
    src/logic/path-utils.ts
    src/logic/tree-utils/access.ts
    src/logic/tree-utils/equal.ts
    src/logic/tree-utils/flatten.ts
    src/logic/tree-utils/filter.ts
    src/logic/legacy-templates/match.ts
    src/logic/legacy-templates/interfaces.ts
    src/logic/legacy-templates/templates.ts
    src/logic/util.ts
    src/logic/binary-operator.ts
    src/logic/doc-utils.ts
    src/logic/make-valid.ts
    src/logic/cursor/paste.ts
    src/logic/cursor/post-action.ts
    src/logic/cursor/equal.ts
    src/logic/cursor/interfaces.ts
    src/logic/cursor/start-insert.ts
    src/logic/cursor/move-in-out.ts
    src/logic/cursor/delete.ts
    src/logic/cursor/reduce-selection.ts
    src/logic/cursor/copy.ts
    src/logic/cursor/move-leaf.ts
    src/logic/cursor/rename.ts
    src/logic/check-insertion.ts
    src/logic/ts-type-predicates.ts
    src/logic/interfaces.ts
    src/logic/text.ts
    src/logic/generic-node.ts
    src/logic/print.ts
    src/logic/doc-manager.ts
    src/logic/without-invisible.ts
    src/logic/ts-from-node.ts
    src/logic/memoize.ts
    src/logic/replace-multiple.ts
    src/logic/struct.ts
    src/logic/node-from-ts.ts
    src/logic/__tests__/doc-manager.test.ts
    src/logic/tasks/util.ts
    src/logic/tasks/load.ts
    src/logic/tasks/interfaces.ts
    src/logic/tasks/fs.ts
    src/logic/tasks/round-trip.ts
    src/logic/focus.ts
    src/logic/modifier.ts
    src/logic/path-mapper.ts
    src/logic/parse.ts
    src/logic/track-ranges.ts
    src/logic/placeholders.ts
    src/thirdparty/lightning-fs.d.ts
    src/thirdparty/fs-remote.d.ts
    src/index.tsx
    src/App.tsx
  `;
  // const paths = _paths
  //   .trim()
  //   .split("\n")
  //   .map((s) => s.trim())
  //   .filter((s) => !s.match(/\.d\.tsx?$/) && !s.endsWith("/templates.ts"));
  const paths: string[] = [];
  console.log(paths);
  const fs = await configureRemoteFs();
  for (const [i, path] of paths.entries()) {
    console.log("round tripping", i, path);
    await roundTripFile(fs, path);
  }
})().catch((err) => console.warn(err));
window.onbeforeunload = function () {
  return false;
};
ReactDOM.render(
  <App />,
  document.getElementById("sceneContainer") as HTMLElement,
);
