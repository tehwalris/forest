const TodoItem = React.createClass({
  render: function (props) {
    return <div>{props.item}</div>;
  },
});

const TodoItem = function (props) {
  return <div>{props.item}</div>;
};

class TodoItem extends Component {
  render(props) {
    return <div>{props.item}</div>;
  }
}
