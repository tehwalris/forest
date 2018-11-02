import * as React from "react";
import Home from "./components/home";

export default class App extends React.Component {
  state = {
    color: "red",
  };

  render() {
    return <Home />;
  }
}
