import * as React from "react";
import { HomeNew } from "./components/home-new";
import createClient from "fs-remote/createClient";
import * as _fsType from "fs";

const fs = createClient("http://localhost:1234") as typeof _fsType;

export default class App extends React.Component {
  state = {
    color: "red",
  };

  render() {
    return <HomeNew fs={fs} />;
  }
}
