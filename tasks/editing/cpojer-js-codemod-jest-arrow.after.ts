describe("describe", () => {
  it("should be happy", () => {
    console.log("actually forwards body");
  });
  it("should leave arrow functions", () => {});
  describe("nested describe", () => {
    xit("disabled still counts", () => {});
    xdescribe("disabled describe", () => {});
  });
});
function containsit() {}
containsit(function () {});
