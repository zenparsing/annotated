import { C } from './original.js';
import * as assert from 'assert';

try {
  new C().m();
} catch (err) {
  let lines = err.stack
    .split(/\n/g)
    .slice(1, 4)
    .map(line => line.replace(__dirname, '').replace(/\\/g, '/'));

  assert.deepEqual(lines, [
    '    at C.t (/original.js:4:15)',
    '    at C.m (/original.js:3:14)',
    '    at (/stack-trace.js:5:11)',
  ]);
}
