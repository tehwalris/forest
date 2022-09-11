const App = React.createClass({
  foo: "bar",
  shouldComponentUpdate: function () {
    return true;
  },
  render: function () {
    return <div>Test</div>;
  },
});
const App1 = React.createClass({ id: 1 }),
  App2 = React.createClass({ id: 2 });
