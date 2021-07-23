import { css } from "@emotion/css";
import * as React from "react";

interface Props {
  shortcutKey: string;
}

const circleRadiusPx = 10;

const styles = {
  wrapper: css`
    position: absolute;
    width: 100%;
    height: 100%;
  `,
  circle: css`
    position: relative;
    top: 50%;
    left: 50%;
    width: ${2 * circleRadiusPx}px;
    height: ${2 * circleRadiusPx}px;
    margin-top: -${circleRadiusPx}px;
    margin-left: -${circleRadiusPx}px;
    border-radius: 50%;
    background: rgba(149, 113, 0, 0.8);
    text-align: center;
    overflow: hidden;
  `,
  text: css`
    display: inline-block;
    vertical-align: middle;
    line-height: ${2 * circleRadiusPx}px;
    color: white;
  `,
};

export const ShortcutKeyDisplay = ({ shortcutKey }: Props) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.circle}>
        <span className={styles.text}>{shortcutKey}</span>
      </div>
    </div>
  );
};
