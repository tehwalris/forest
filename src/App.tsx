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
        {/* <Entity progressive-controls="objects: .cube, a-link; maxLevel: point">
          <Entity id="rhand" class="right-controller" />
          <Entity id="lhand" class="left-controller" />
        </Entity> */}
        <Entity laser-controls="hand: left" raycaster="objects: .interactive" />
        <Entity
          laser-controls="hand: right"
          raycaster="objects: .interactive"
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
        <Entity primitive="a-camera" />
      </Scene>
    );
  }
}
