import { translateModule } from '../../src/ModuleTranslator.js';
import assert from 'assert';

function normalize(code) {
  return code.trim().replace(/\n[ ]+/g, '\n');
}

export function test(name, input, expected) {
  expected = normalize(expected);
  let raw = translateModule(input).output;
  let actual = normalize(raw);
  if (expected !== actual) {
    console.log(raw);
  }
  assert.equal(actual, expected, name);
}
