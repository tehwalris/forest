import { MantineProvider } from "@mantine/core";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./App";
import "./index.css";
window.onbeforeunload = function () {
  return false;
};
ReactDOM.render(
  <MantineProvider withGlobalStyles withNormalizeCSS>
    <App />
  </MantineProvider>,
  document.getElementById("sceneContainer") as HTMLElement,
);
