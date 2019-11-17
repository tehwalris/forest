This project was bootstrapped with
[Create React App](https://github.com/facebookincubator/create-react-app).

## How to fix crash on first start

Edit the file `node_modules/prettier/index.js` and change the statement which
starts with `var fs$1` to:

```javascript
var fs$1 = {
  readFile: () => {},
};
```

You will have to do this every time after you run yarn.
