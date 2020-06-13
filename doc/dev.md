# Developer guide

## Local dev server

**You might not need this**. There's a [prebuilt version of Forest](https://forest.walr.is) and you can even let it [edit your local files](./filesystem.md). If you want to make changes to Forest though, you'll need to compile it by yourself like this:

- Install Node.js 12 and [yarn](https://yarnpkg.com/)
- Configure divetree
  - Clone [divetree](https://github.com/tehwalris/divetree)
  - `cd divetree`
  - `yarn`
  - `yarn workspace divetree-core build`
  - `yarn workspace divetree-react build`
  - `cd divetree-core && yarn link && cd ..`
  - `cd divetree-react && yarn link && cd ..`
  - `cd node_modules/react && yarn link && cd ../..`
- Install dependencies
  - `yarn`
- Link in divetree
  - `yarn link divetree-core`
  - `yarn link divetree-react`
  - `yarn link react`
- Generate templates
  - `cd src/logic/providers/typescript/ && node generate-templates.js`
- [optional] Start the server (**WARNING**: This is really unsafe! [More info](./filesystem.md))
  - `cd src && node ../server-unsafe.js`
- Start the CRA dev server
  - `yarn start`
- Open the main page and edit (probably [http://localhost:3000](http://localhost:3000))

## Production build

A production build of this app may fail because the JavaScript heap grows larger than the default limit. To work around this, allow more memory to be used:

```
env NODE_OPTIONS="--max-old-space-size=8192" yarn build
```
