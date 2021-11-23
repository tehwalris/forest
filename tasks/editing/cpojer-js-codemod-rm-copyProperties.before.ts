var copyProperties = require('copyProperties');

copyProperties(a, {a: 1});

copyProperties({a: 1}, {b: 1});
