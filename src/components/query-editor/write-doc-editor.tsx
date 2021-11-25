import { css } from "@emotion/css";
import React from "react";
import { emptyDoc } from "../../logic/doc-utils";
import { LinearEditor } from "../linear-editor";
import { Stage, State, WriteDocState } from "./interfaces";

const styles = {
  outerWrapper: css`
    height: 100%;
    overflow: hidden;
  `,
};

interface Props {
  state: WriteDocState;
  setState: (state: State) => void;
}

export const WriteDocEditor = ({ state, setState }: Props) => {
  return (
    <div className={styles.outerWrapper}>
      <LinearEditor
        initialDoc={emptyDoc}
        onSave={(doc) => setState({ stage: Stage.SelectTargetRough, doc })}
      />
    </div>
  );
};
