expect(1).toExist();
expect(1).toNotExist();
expect(1).toNotBe();
expect(1).toNotEqual();
expect(1).toThrow();
expect(1).toNotThrow();

expect(1).toBeA(a);
expect(1).toBeAn(a);
expect(1).toBeA('string');
expect(1).toBeAn('string');
expect(1).toNotBeA(a);
expect(1).toNotBeAn(a);
expect(1).toNotBeA('string');
expect(1).toNotBeAn('string');

expect(1).toMatch('string');
expect(1).toMatch({object: true});
expect(1).toNotMatch('string');
expect(1).toNotMatch({object: true});

expect(1).toBeFewerThan();
expect(1).toBeLessThanOrEqualTo();
expect(1).toBeMoreThan();
expect(1).toBeGreaterThanOrEqualTo();

expect(1).toInclude();
expect(1).toExclude();
expect(1).toNotContain();
expect(1).toNotInclude();

expect(1).toIncludeKey();
expect(1).toContainKey();
expect(1).toExcludeKey();
expect(1).toNotContainKey();
expect(1).toNotIncludeKey();

expect(1).toIncludeKeys([1]);
expect(1).toContainKeys([1]);
expect(1).toExcludeKeys([1]);
expect(1).toNotContainKeys([1]);
expect(1).toNotIncludeKeys([1]);

expect(1).toNotHaveBeenCalled();
