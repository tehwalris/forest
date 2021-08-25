import ts from "typescript";

export type LiveStringHelperResult<T extends ts.Node> =
  | {
      ok: true;
      message: string;
      node: T;
    }
  | {
      ok: false;
      message: string;
    };

export type LiveStringHelper<T extends ts.Node> = (
  input: string,
) => LiveStringHelperResult<T>;

export const liveStringHelpers: {
  [key: string]: LiveStringHelper<any> | undefined;
} = {
  IdentifierLike: (_input: string) => {
    const input = _input.trim();
    if (!input.length) {
      return {
        ok: false,
        message: "Enter an identifier or press enter for more options",
      };
    }
    if (!input.match(/^[a-zA-Z_$][a-zA-Z_$\d]*$/)) {
      return { ok: false, message: "Not a valid identifier" };
    }
    return {
      ok: true,
      message: "",
      node: ts.createIdentifier(input),
    };
  },
};
