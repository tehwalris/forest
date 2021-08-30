declare namespace ts {
  type Node = any;
}

export type Union<T extends ts.Node | undefined> = {
  name: string;
  getMembers: () => {
    [key: string]: {
      match: (node: ts.Node | undefined) => node is T;
      default: T;
    };
  };
};
