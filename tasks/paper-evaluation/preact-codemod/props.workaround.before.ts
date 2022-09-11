const TodoItem = React.createClass({
  render: function () {
    return fakeJSX("<div>", this.props.item, "</div>");
  },
});
const TodoItem = function () {
  return fakeJSX("<div>", this.props.item, "</div>");
};
fakeClass("TodoItem extends Component", function () {
  function render() {
    return fakeJSX("<div>", this.props.item, "</div>");
  }
});
