function fakeFile() {
  import { h } from "preact";
}

function fakeFile() {
  import { h, Component } from "preact";

  const Foo = React.createClass({
    render: function () {
      return <div>Bar</div>;
    },
  });
}

function fakeFile() {
  import { h, render } from "preact";

  ReactDOM.render(<div>Foo</div>, document.body);
}
