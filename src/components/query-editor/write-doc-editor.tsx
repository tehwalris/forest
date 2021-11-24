import { css } from "@emotion/css";
import React from "react";
import { emptyDoc } from "../../logic/doc-utils";
import { LinearEditor } from "../linear-editor";
import { WriteDocState } from "./interfaces";

const styles = {
  outerWrapper: css`
    height: 100%;
    overflow: hidden;
  `,
};

interface Props {
  state: WriteDocState;
}

export const WriteDocEditor = ({ state }: Props) => {
  return (
    <div className={styles.outerWrapper}>
      <LinearEditor initialDoc={emptyDoc} onSave={() => {}} />
    </div>
  );
};
