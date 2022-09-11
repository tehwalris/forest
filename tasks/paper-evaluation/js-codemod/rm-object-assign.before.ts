let x = Object.assign({}, { a: 1 }, { b: 2 });
Object.assign({}, a);
Object.assign({ a: 1 }, b, { c: 3 });
Object.assign(a, b);
Object.assign({}, ...b);
Object.assign({ a: 1 }, { b: 2 }, c, d);
