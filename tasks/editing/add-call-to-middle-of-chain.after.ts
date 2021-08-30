var statementVariants: any;

export const statementsForDisplay = statementVariants
  .filter(({ key }) => key !== "ExpressionStatement")
  .map(({ key, children }) => ({
    key: "Statement." + key,
    children,
  }));
