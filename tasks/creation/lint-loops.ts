// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/glossary/scripts/lint.js

var languages,
  readdirSync,
  join,
  locale,
  chalk,
  errorReports,
  filterString,
  remarkTwoSlash,
  markdownAST,
  hasError,
  cross,
  tick: any;

const go = async () => {
  for (const lang of languages) {
    console.log("\n\nLanguage: " + chalk.bold(lang) + "\n");

    let options;
    try {
      options = readdirSync(join(locale)).filter((f) => !f.startsWith("."));
    } catch {
      errorReports.push({
        path: join(locale, "options"),
        error:
          "Options directory " + join(locale, "options") + " doesn't exist",
      });
      return;
    }

    for (const option of options) {
      if (filterString.length && !option.includes(filterString)) return;

      const optionPath = join(locale, option);

      try {
        await remarkTwoSlash.default({})(markdownAST);
      } catch (error) {
        hasError = true;
        errorReports.push({ path: optionPath, error });
      }

      const sigil = hasError ? cross : tick;
      const name = hasError ? chalk.red(option) : option;
      process.stdout.write(name + " " + sigil + ", ");
    }
  }
};
