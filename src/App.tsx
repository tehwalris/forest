import * as React from "react";
import { HomeNew } from "./components/home-new";

export default class App extends React.Component {
  state = {
    color: "red",
  };

  render() {
    return <HomeNew />;
  }
}
