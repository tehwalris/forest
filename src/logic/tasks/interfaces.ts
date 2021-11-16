export interface Task {
  name: string;
  afterPath: string;
  contentBefore: string;
  contentAfter: string;
}
export interface CreationTask extends Task {
  contentBefore: "";
}
