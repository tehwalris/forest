// https://github.com/microsoft/TypeScript-Website/blob/v2/packages/typescript-vfs/src/index.ts

var files: any;
var version: any;
var storelike: any;
var fetchlike: any;
var prefix: any;
var zip: any;
var unzip: any;
var fsMap: any;

function cached() {
  return Promise.all(
    files.map((lib) => {
      const cacheKey = "ts-lib-" + version + "-" + lib;
      const content = storelike.getItem(cacheKey);

      if (!content) {
        // Make the API call and store the text concent in the cache
        return fetchlike(prefix + lib)
          .then((resp) => resp.text())
          .then((t) => {
            storelike.setItem(cacheKey, zip(t));
            return t;
          });
      } else {
        return Promise.resolve(unzip(content));
      }
    }),
  ).then((contents) => {
    contents.forEach((text, index) => {
      const name = "/" + files[index];
      fsMap.set(name, text);
    });
  });
}
