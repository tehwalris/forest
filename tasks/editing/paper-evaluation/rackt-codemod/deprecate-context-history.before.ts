import { PropTypes } from "react-router";
class MyComponent extends React.Component {
  doStuff() {
    this.context.history.pushState(null, "/some/path");
  }
}
MyComponent.contextTypes = { history: PropTypes.history };
