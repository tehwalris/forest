const TodoItem = React.createClass({
  render: function (props) {
    return fakeJSX("<div>", props.item, "</div>");
  },
});
const TodoItem = function (props) {
  return fakeJSX("<div>", props.item, "</div>");
};
fakeClass("TodoItem extends Component", function () {
  function render(props) {
    return fakeJSX("<div>", props.item, "</div>");
  }
});
