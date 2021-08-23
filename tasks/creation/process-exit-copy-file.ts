// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/handbook-epub/script/createEpub.ts

var copyFileSync, epubPath, join: any;

process.once("exit", () => {
  copyFileSync(epubPath, join(__dirname, "../handbook.epub"));
});
