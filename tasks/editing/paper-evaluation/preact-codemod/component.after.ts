const PureComponent = function () {
  return <div>PureComponent Test</div>;
};

class ImpureComponent extends Component {
  shouldComponentUpdate() {
    return true;
  }

  render() {
    return <div>ImpureComponent Test</div>;
  }
}
