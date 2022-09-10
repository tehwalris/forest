const TodoItem = React.createClass({
  render: function (props, state) {
    return fakeJSX("<div>", state.item, "</div>");
  },
});
const TodoItem = function (props, state) {
  return fakeJSX("<div>", state.item, "</div>");
};
fakeClass("TodoItem extends Component", function () {
  function render(props, state) {
    return fakeJSX("<div>", state.item, "</div>");
  }
});
