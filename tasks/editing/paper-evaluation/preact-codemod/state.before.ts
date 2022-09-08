const TodoItem = React.createClass({
  render: function () {
    return <div>{this.state.item}</div>;
  },
});
const TodoItem = function () {
  return <div>{this.state.item}</div>;
};
class TodoItem extends Component {
  render() {
    return <div>{this.state.item}</div>;
  }
}
