expect(1).toBeTruthy();
expect(1).toBeFalsy();
expect(1).not.toBe();
expect(1).not.toEqual();
expect(1).toThrow();
expect(1).not.toThrow();

expect(1).toBeInstanceOf(a);
expect(1).toBeInstanceOf(a);
expect(typeof 1).toBe('string');
expect(typeof 1).toBe('string');
expect(1).not.toBeInstanceOf(a);
expect(1).not.toBeInstanceOf(a);
expect(typeof 1).not.toBe('string');
expect(typeof 1).not.toBe('string');

expect(1).toMatch('string');
expect(1).toMatchObject({object: true});
expect(1).not.toMatch('string');
expect(1).not.toMatchObject({object: true});

expect(1).toBeLessThan();
expect(1).toBeLessThanOrEqual();
expect(1).toBeGreaterThan();
expect(1).toBeGreaterThanOrEqual();

expect(1).toContain();
expect(1).not.toContain();
expect(1).not.toContain();
expect(1).not.toContain();

expect(Object.keys(1)).toContain();
expect(Object.keys(1)).toContain();
expect(Object.keys(1)).not.toContain();
expect(Object.keys(1)).not.toContain();
expect(Object.keys(1)).not.toContain();

e.forEach(e => {
  expect(1).toContain(e);
});
e.forEach(e => {
  expect(1).toContain(e);
});
e.forEach(e => {
  expect(1).not.toContain(e);
});
e.forEach(e => {
  expect(1).not.toContain(e);
});
e.forEach(e => {
  expect(1).not.toContain(e);
});

expect(1).not.toHaveBeenCalled();
