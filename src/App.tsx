import { Entity, Scene } from "aframe-react";
import * as React from "react";
import Home from "./components/home";

export default class App extends React.Component {
  state = {
    color: "red",
  };

  render() {
    return (
      <Scene>
        {React.createElement("a-assets", {}, [
          <img
            key="a"
            id="groundTexture"
            src="https://cdn.aframe.io/a-painter/images/floor.jpg"
          />,
          <img
            key="b"
            id="skyTexture"
            src="https://cdn.aframe.io/a-painter/images/sky.jpg"
          />,
        ])}
        <Home />
        <Entity
          primitive="a-plane"
          material={{ color: "green", opacity: 0.2 }}
          text={{
            value: "walrus",
            align: "center",
          }}
          position="0 5 -3"
          rotation="65 0 0"
          height="6"
          width="6"
        />
        <Entity
          primitive="a-plane"
          src="#groundTexture"
          rotation="-90 0 0"
          height="100"
          width="100"
        />
        <Entity primitive="a-light" type="ambient" color="#445451" />
        <Entity
          primitive="a-light"
          type="point"
          intensity="2"
          position="2 4 4"
        />
        <Entity
          primitive="a-sky"
          height="2048"
          radius="30"
          src="#skyTexture"
          theta-length="90"
          width="2048"
        />
        <Entity primitive="a-camera">
          <Entity primitive="a-cursor" />
        </Entity>
      </Scene>
    );
  }
}
