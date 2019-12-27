import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import "./index.css";

ReactDOM.render(
  <App />,
  document.getElementById("sceneContainer") as HTMLElement,
);

// var whenReadFile = (fs$1 && fs$1.readFile) ? Promise$1.promisify(fs$1.readFile) : () => Promise$1.reject();
