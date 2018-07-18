const { test } = require('./helpers.js');

test('import default', `
  import x from 'a';
`, `
  'use strict';
  const _a = require('a');
  const x = _a.default;
`);

test('import names', `
  import { x, y as z } from 'a';
`, `
  'use strict';
  const _a = require('a');
  const x = _a.x;
  const z = _a.y;
`);