declare namespace ts {
  type Node = any;
}

type LiveStringHelper<T> = any;

export type Union<T extends ts.Node | undefined> = {
  name: string;
  liveStringHelper?: LiveStringHelper<NonNullable<T>>;
  getMembers: () => {
    [key: string]: {
      match: (node: ts.Node | undefined) => node is T;
      default: T;
    };
  };
};
