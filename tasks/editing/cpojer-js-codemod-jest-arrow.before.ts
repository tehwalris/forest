describe('describe', function() {
  it('should be happy', function() {
    console.log('actually forwards body');
  });
  it('should leave existing arrow functions alone', () => {
  });
  describe('nested describe', function() {
    xit('disabled one still count', function() {

    });
    xdescribe('disabled describe as well', function() {

    });
  });

  beforeEach(function() {});
  afterEach(function() {});
});

function containsit() {
}
containsit(function() {
});
