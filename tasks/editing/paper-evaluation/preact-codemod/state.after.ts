const TodoItem = React.createClass({
  render: function (props, state) {
    return <div>{state.item}</div>;
  },
});

const TodoItem = function (props, state) {
  return <div>{state.item}</div>;
};

class TodoItem extends Component {
  render(props, state) {
    return <div>{state.item}</div>;
  }
}
