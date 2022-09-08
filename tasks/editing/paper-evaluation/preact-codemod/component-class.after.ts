class App extends Component {
  constructor(props, context) {
    super(props, context);
    this.foo = "bar";
  }

  shouldComponentUpdate() {
    return true;
  }

  render() {
    return <div>Test</div>;
  }
}

class App1 extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = 1;
  }
}

class App2 extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = 2;
  }
}
