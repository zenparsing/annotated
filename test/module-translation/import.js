import { test } from './helpers.js';

test('import default', `
  import x from 'a';
`, `
  'use strict';

  const _a = require('a');
  const x = typeof _a === 'function' ? _a : _a.default;
`);

test('import names', `
  import { x, y as z } from 'a';
`, `
  'use strict';

  const _a = require('a');
  const x = _a.x;
  const z = _a.y;
`);

test('import twice', `
  import { x } from 'a';
  import { y } from 'a';
`, `
  'use strict';

  const _a = require('a');
  const x = _a.x;
  const _a_1 = require('a');
  const y = _a_1.y;
`);

test('import no shadowing', `
  import { x } from 'a';
  import { y } from 'b';
  let _a;
  _b();
`, `
  'use strict';

  const _a_1 = require('a');
  const x = _a_1.x;
  const _b_1 = require('b');
  const y = _b_1.y;
  let _a;
  _b();
`);
