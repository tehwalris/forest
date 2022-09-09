import { Example } from "../../examples/interfaces";

export interface Task {
  name: string;
  afterPath: string;
  contentBefore: string;
  contentAfter: string;
  example?: Example;
}
export interface CreationTask extends Task {
  contentBefore: "";
}
