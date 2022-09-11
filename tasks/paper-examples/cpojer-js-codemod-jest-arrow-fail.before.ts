describe("describe", function () {
  it("should be happy", function () {
    console.log("actually forwards body");
  });
  it("should leave arrow functions", () => {});
  describe("nested describe", function () {
    xit("disabled still counts", function () {});
    xdescribe("disabled describe", function () {});
  });
});
function containsit() {}
containsit(function () {});
