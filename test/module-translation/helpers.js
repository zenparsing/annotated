import { expandMacros } from '../../src/default.js';
import * as assert from 'assert';

function normalize(code) {
  return code.trim().replace(/\n[ ]+/g, '\n');
}

export function test(name, input, expected) {
  expected = normalize(expected);
  let raw = expandMacros(input, { translateModules: true }).output;
  let actual = normalize(raw);
  if (expected !== actual) {
    console.log(raw);
  }
  assert.equal(actual, expected, name);
}
