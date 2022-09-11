import { PropTypes } from "react-router";
class MyComponent extends React.Component {
  doStuff() {
    this.context.router.pushState(null, "/some/path");
  }
}
MyComponent.contextTypes = { router: PropTypes.router };
