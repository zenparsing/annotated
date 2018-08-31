import { expandMacros } from '../../src/index.js';
import * as assert from 'assert';

function normalize(code) {
  return code.trim().replace(/\n[ ]+/g, '\n');
}

export function test(name, input, expected) {
  expected = normalize(expected);
  let result = expandMacros(input, { translateModules: true });
  let actual = normalize(result.output);
  if (expected !== actual) {
    console.log(result.output);
  }
  assert.equal(actual, expected, name);
}
