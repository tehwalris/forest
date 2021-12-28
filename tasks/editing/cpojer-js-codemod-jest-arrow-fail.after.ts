describe("describe", () => {
  it("should be happy", function () {
    console.log("actually forwards body");
  });
  it("should leave arrow", () => {});
  describe("nested describe", function () {
    xit("disabled one still count", function () {});
    xdescribe("disabled describe", function () {});
  });
  beforeEach(function () {});
  afterEach(function () {});
});
function containsit() {}
containsit(function () {});
