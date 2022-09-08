import "foo";
import bar from "bar";
import qux from "bundle?lazy!qux";
import norf from "bundle?lazy!norf";
import blob from "./blob";
const baz = { qux, norf, blob };
