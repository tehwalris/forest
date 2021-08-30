var statementVariants: any;

export const statementsForDisplay = statementVariants.map(
  ({ key, children }) => ({
    key: "Statement." + key,
    children,
  }),
);
