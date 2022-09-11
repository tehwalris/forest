const TodoItem = React.createClass({
  render: function () {
    return <div>{this.props.item}</div>;
  },
});
const TodoItem = function () {
  return <div>{this.props.item}</div>;
};
class TodoItem extends Component {
  render() {
    return <div>{this.props.item}</div>;
  }
}
