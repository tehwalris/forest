import * as React from "react";
interface Props {
  text: string;
  selectedRange: [number, number] | undefined;
}
const styles = {
  noHighlight: {
    opacity: 0.8,
  },
  highlight: {
    backgroundColor: "wheat",
  },
};
export default ({ text, selectedRange: range }: Props) => {
  const { before, selected, after } = range
    ? {
        before: text.slice(0, range[0]),
        selected: text.slice(...range),
        after: text.slice(range[1]),
      }
    : { before: text, selected: "", after: "" };
  return (
    <pre>
      <span style={styles.noHighlight}>{before}</span>
      <span style={styles.highlight}>{selected}</span>
      <span style={styles.noHighlight}>{after}</span>
    </pre>
  );
};
