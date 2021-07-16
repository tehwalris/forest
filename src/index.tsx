import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./App";
import "./index.css";

// HACK Automatic reload can be annoying during development
window.onbeforeunload = function () {
  return false;
};

ReactDOM.render(
  <App />,
  document.getElementById("sceneContainer") as HTMLElement,
);
