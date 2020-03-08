This project was bootstrapped with
[Create React App](https://github.com/facebookincubator/create-react-app).

## Usage

- Install dependencies
  - `yarn`
- Generate templates
  - `cd src/logic/providers/typescript/ && node generate-templates.js`
- Start the server (**WARNING**: This is really unsafe!)
  - `node server-unsafe.js`
- Start the CRA dev server
  - `yarn start`
- Open a file for editing
  - In your browser console: `openFile('src/playground.ts')`

## Production build

A production build of this app may fail because the JavaScript heap grows larger than the default limit. To work around this, allow more memory to be used:

```
env NODE_OPTIONS="--max-old-space-size=8192" yarn build
```
