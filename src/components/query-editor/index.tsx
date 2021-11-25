import { useState } from "react";
import { unreachable } from "../../logic/util";
import { Stage, State } from "./interfaces";
import { SelectTargetRoughEditor } from "./select-target-rough-editor";
import { WriteDocEditor } from "./write-doc-editor";

interface Props {}

export const QueryEditor = (_props: Props) => {
  const [state, setState] = useState<State>({ stage: Stage.WriteDoc });
  switch (state.stage) {
    case Stage.WriteDoc:
      return <WriteDocEditor state={state} setState={setState} />;
    case Stage.SelectTargetRough:
      return <SelectTargetRoughEditor state={state} setState={setState} />;
    case Stage.SelectTargetExact:
      return (
        <div>TODO SelectTargetExact {JSON.stringify(state.roughTarget)}</div>
      );
    default:
      return unreachable(state);
  }
};
