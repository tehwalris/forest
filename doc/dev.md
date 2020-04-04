# Developer guide

## Local dev server

- Configure divetree
  - Clone [divetree](https://github.com/tehwalris/divetree)
  - `cd divetree`
  - `yarn`
  - `yarn workspace divetree-core build`
  - `yarn workspace divetree-react build`
  - `cd divetree-core && yarn link && cd ..`
  - `cd divetree-react && yarn link && cd ..`
- Install dependencies
  - `yarn`
- Link in divetree
  - `yarn link divetree-core`
  - `yarn link divetree-react`
- Generate templates
  - `cd src/logic/providers/typescript/ && node generate-templates.js`
- Start the server (**WARNING**: This is really unsafe!)
  - `node server-unsafe.js`
- Start the CRA dev server
  - `yarn start`
- Open the main page and edit (probably [http://localhost:3000](http://localhost:3000))

## Production build

A production build of this app may fail because the JavaScript heap grows larger than the default limit. To work around this, allow more memory to be used:

```
env NODE_OPTIONS="--max-old-space-size=8192" yarn build
```
