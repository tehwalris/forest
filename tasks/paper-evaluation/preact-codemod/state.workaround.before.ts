const TodoItem = React.createClass({
  render: function () {
    return fakeJSX("<div>", this.state.item, "</div>");
  },
});
const TodoItem = function () {
  return fakeJSX("<div>", this.state.item, "</div>");
};
fakeClass("TodoItem extends Component", function () {
  function render() {
    return fakeJSX("<div>", this.state.item, "</div>");
  }
});
