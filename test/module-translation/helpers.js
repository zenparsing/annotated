const { translateModule } = require('../../src/ModuleTranslator.js');
const assert = require('assert');

function normalize(code) {
  return code.trim().replace(/\n[ ]+/g, '\n');
}

function test(name, input, expected) {
  expected = normalize(expected);
  let raw = translateModule(input).output;
  let actual = normalize(raw);
  if (expected !== actual) {
    console.log(raw);
  }
  assert.equal(actual, expected, name);
}

module.exports = { test };
