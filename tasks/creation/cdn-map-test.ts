// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/typescript-vfs/test/index.test.ts

var it: any, knownLibFilesForCompilerOptions, createDefaultMapFromCDN, ts;

it("creates a map from the CDN without cache", async () => {
  const fetcher = jest.fn();
  fetcher.mockResolvedValue({
    text: () => Promise.resolve("// Contents of file"),
  });
  const store = jest.fn() as any;

  const compilerOpts = { target: ts.ScriptTarget.ES5 };
  const libs = knownLibFilesForCompilerOptions(compilerOpts, ts);
  expect(libs.length).toBeGreaterThan(0);

  const map = await createDefaultMapFromCDN(
    compilerOpts,
    "3.7.3",
    false,
    ts,
    undefined,
    fetcher,
    store,
  );
  expect(map.size).toBeGreaterThan(0);

  libs.forEach((l) => {
    expect(map.get("/" + l)).toBeDefined();
  });
});
