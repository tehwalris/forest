import { unreachable } from "../../logic/util";
import { Stage, State } from "./interfaces";
import { SelectTargetExactEditor } from "./select-target-exact-editor";
import { SelectTargetRoughEditor } from "./select-target-rough-editor";
import { WriteDocEditor } from "./write-doc-editor";

interface Props {
  state: State;
  setState: (state: State) => void;
}

export const QueryEditor = ({ state, setState }: Props) => {
  switch (state.stage) {
    case Stage.WriteDoc:
      return <WriteDocEditor state={state} setState={setState} />;
    case Stage.SelectTargetRough:
      return <SelectTargetRoughEditor state={state} setState={setState} />;
    case Stage.SelectTargetExact:
      return <SelectTargetExactEditor state={state} setState={setState} />;
    case Stage.QueryReady:
      return <div>TODO QueryReady</div>;
    default:
      return unreachable(state);
  }
};
