const PureComponent = React.createClass({
  render: function () {
    return <div>PureComponent Test</div>;
  },
});
const ImpureComponent = React.createClass({
  shouldComponentUpdate: function () {
    return true;
  },
  render: function () {
    return <div>ImpureComponent Test</div>;
  },
});
