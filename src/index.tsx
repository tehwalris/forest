import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import registerServiceWorker from "./registerServiceWorker";
import "./index.css";

ReactDOM.render(<App />, document.getElementById(
  "sceneContainer",
) as HTMLElement);
registerServiceWorker();

// var whenReadFile = (fs$1 && fs$1.readFile) ? Promise$1.promisify(fs$1.readFile) : () => Promise$1.reject();
