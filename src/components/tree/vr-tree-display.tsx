import * as React from "react";
import { Entity } from "aframe-react";
import { DisplayNode, DisplayPath } from "../../logic/tree/display";

interface Props {
  root: DisplayNode;
  highlightPath: DisplayPath;
}

export default ({  }: Props) => {
  return (
    <Entity>
      <Entity
        key="hello"
        text={{ value: "Hello, A-Frame React!", align: "center" }}
        position={{ x: 0, y: 2, z: -1 }}
      />
      <Entity
        key="box"
        geometry={{ primitive: "box" }}
        material={{ color: "red", opacity: 0.6 }}
        position={{ x: 0, y: 1, z: -3 }}
        events={{ click: () => console.log("test") }}
      >
        <Entity
          geometry={{ primitive: "box", depth: 0.2, height: 0.2, width: 0.2 }}
          material={{ color: "#24CAFF" }}
        />
      </Entity>
    </Entity>
  );
};
