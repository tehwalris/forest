import "foo";
import bar from "bar";
const baz = {
  qux: require("bundle?lazy!qux"),
  norf: require("bundle?lazy!norf"),
  blob: require("./blob"),
};
