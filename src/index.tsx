import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { App } from "./App";
import "./index.css";
window.onbeforeunload = function () {
  return false;
};
ReactDOM.render(
  <MantineProvider withGlobalStyles withNormalizeCSS>
    <ModalsProvider>
      <App />
    </ModalsProvider>
  </MantineProvider>,
  document.getElementById("sceneContainer") as HTMLElement,
);
