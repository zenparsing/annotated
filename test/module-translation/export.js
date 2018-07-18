const { test } = require('./helpers.js');

test('export default from', `
  export x from 'a';
`, `
  'use strict';
  exports.x = require('a').default;
`);

test('export namespace', `
  export * as x from 'a';
`, `
  'use strict';
  exports.x = require('a');
`);

test('export one from', `
  export { x as y } from 'a';
`, `
  'use strict';
  exports.y = require('a').x;
`);

test('export multiple from', `
  export { x, y as z } from 'a';
`, `
  'use strict';
  const _a = require('a');
  exports.x = _a.x;
  exports.z = _a.y;
`);

test('export default function', `
  export default function f() {}
`, `
  'use strict';
  exports.default = f;
  function f() {

  }
`);

test('export default anonymous function', `
  export default function() {}
`, `
  'use strict';
  exports.default = __default;
  function __default() {

  }
`);

test('export default class', `
  export default class C {}
`, `
  'use strict';
  exports.default = undefined;
  class C {

  }
  exports.default = C;
`);

test('export default anonymous class', `
  export default class {}
`, `
  'use strict';
  exports.default = undefined;
  class __default {

  }
  exports.default = __default;
`);

test('export default expression', `
  export default { x: 1, y: 2 };
`, `
  'use strict';
  exports.default = undefined;
  exports.default = {
    x: 1,
    y: 2
  };
`)

test('export function', `
  export function f() {}
`, `
  'use strict';
  exports.f = f;
  function f() {

  }
`);

test('export class', `
  export class C {}
`, `
  'use strict';
  exports.C = undefined;
  class C {

  }
  exports.C = C;
`);

test('export variables', `
  export let x = 1, y = 2, { z } = a, [m] = b;
`, `
  'use strict';
  exports.x = undefined;
  exports.y = undefined;
  exports.z = undefined;
  exports.m = undefined;
  let x = 1, y = 2, {
    z
  } = a, [m] = b;
  exports.x = x;
  exports.y = y;
  exports.z = z;
  exports.m = m;
`);

test('export locals', `
  const x = 1;
  export { x as y };
`, `
  'use strict';
  exports.y = undefined;
  const x = 1;
  exports.y = x;
`);