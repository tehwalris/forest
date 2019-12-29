import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import "./index.css";
import * as prettierThirdParty from "prettier/third-party";

// HACK Stop Prettier crashing because "fs" is not supported in browser
prettierThirdParty.findParentDir = () => undefined;

ReactDOM.render(
  <App />,
  document.getElementById("sceneContainer") as HTMLElement,
);
