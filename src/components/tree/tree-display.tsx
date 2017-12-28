import * as React from "react";
import { DisplayNode, DisplayPath } from "../../logic/tree/display";
import * as R from "ramda";
const INDENT_STRING = "  ";
interface Props {
  root: DisplayNode;
  highlightPath: DisplayPath;
  disableFolding: boolean;
  levelsAbove: number;
  levelsBelowMatch: number;
  levelsBelowSibling: number;
}
function getRows(node: DisplayNode): DisplayNode[] {
  return [node, ...R.chain(getRows, node.children)];
}
export default class TreeDisplay extends React.Component<Props> {
  render() {
    const { root } = this.props;
    const rows = this.filterRows(getRows(root));
    return (
      <div>
        {rows.map((r, i) => (
          <div key={i}>
            <pre style={this.getRowStyle(r)}>{this.getRowText(r)}</pre>
          </div>
        ))}
      </div>
    );
  }
  filterRows(rows: DisplayNode[]): DisplayNode[] {
    const {
      highlightPath,
      disableFolding,
      levelsAbove,
      levelsBelowMatch,
      levelsBelowSibling
    } = this.props;
    if (disableFolding) {
      return rows;
    }
    return rows.filter(({ displayPath }) => {
      const isMatch = highlightPath
        .slice(0, Math.min(highlightPath.length, displayPath.length))
        .every((e, i) => e === displayPath[i]);
      const isSibling = highlightPath
        .slice(
          0,
          Math.max(0, Math.min(highlightPath.length - 1, displayPath.length))
        )
        .every((e, i) => e === displayPath[i]);
      if (!isMatch && !isSibling) {
        return false;
      }
      if (displayPath.length >= highlightPath.length) {
        if (
          (isMatch &&
            displayPath.length - highlightPath.length > levelsBelowMatch) ||
          (isSibling &&
            displayPath.length - highlightPath.length > levelsBelowSibling)
        ) {
          return false;
        }
      } else {
        if (highlightPath.length - displayPath.length > levelsAbove) {
          return false;
        }
      }
      return true;
    });
  }
  getRowText({
    basePath,
    baseNode,
    displayPath,
    chain,
    bestDisplayInfo
  }: DisplayNode): string {
    const indent = INDENT_STRING.repeat(
      Math.max(
        0,
        displayPath.length -
          this.props.highlightPath.length +
          this.props.levelsAbove
      )
    );
    if (bestDisplayInfo) {
      return `${indent}${bestDisplayInfo.label.map(e => e.text).join()}`;
    }
    const fullChain = [
      {
        key: basePath.length ? basePath[basePath.length - 1] : "root",
        node: baseNode
      },
      ...chain
    ];
    const debugLabel = fullChain.reduce(
      (a, c) => c.node.getDebugLabel() || a,
      ""
    );
    const built = baseNode.build();
    const path = fullChain.map(e => e.key).join("/");
    const label =
      (debugLabel ? `${path} (${debugLabel})` : path) + (built.ok ? "" : "!");
    return `${indent}${label}`;
  }
  getRowStyle(row: DisplayNode): {} {
    const { highlightPath } = this.props;
    const { displayPath } = row;
    const hasErrors =
      this.getRowText(row).includes("!") &&
      !this.getRowText(row).includes("Keyword");
    const isHighighted = highlightPath.every((e, i) => e === displayPath[i]);
    const isHighlightSibling =
      displayPath.length === highlightPath.length &&
      highlightPath.slice(0, -1).every((e, i) => e === displayPath[i]);
    return {
      margin: "0",
      background: hasErrors
        ? "black"
        : isHighighted ? "green" : isHighlightSibling ? "grey" : undefined,
      opacity: isHighighted || isHighlightSibling ? 1 : 0.5
    };
  }
}
