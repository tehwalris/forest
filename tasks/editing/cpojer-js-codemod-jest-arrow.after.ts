describe('describe', () => {
  it('should be happy', () => {
    console.log('actually forwards body');
  });
  it('should leave existing arrow functions alone', () => {
  });
  describe('nested describe', () => {
    xit('disabled one still count', () => {

    });
    xdescribe('disabled describe as well', () => {

    });
  });

  beforeEach(() => {});
  afterEach(() => {});
});

function containsit() {
}
containsit(function() {
});
