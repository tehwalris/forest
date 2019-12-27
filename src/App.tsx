import * as React from "react";
import Home from "./components/home";
import { HomeNew } from "./components/home-new";

export default class App extends React.Component {
  state = {
    color: "red",
  };

  render() {
    return (
      <div>
        <HomeNew />
        <Home />
      </div>
    );
  }
}
