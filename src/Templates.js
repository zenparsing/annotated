const { parse } = require('esparse');
const { Path } = require('./Path.js');

const PLACEHOLDER = '$$MACRO$$';

function statement(literals, ...values) {
  return moduleTemplate(literals, ...values).statements[0];
}

function expression(literals, ...values) {
  return moduleTemplate(literals, ...values).statements[0].expression;
}

function moduleTemplate(literals, ...values) {
  let source = '';

  if (typeof literals === 'string') {
    source = literals;
  } else {
    for (let i = 0; i < literals.length; ++i) {
      source += literals[i];
      if (i < values.length) source += PLACEHOLDER;
    }
  }

  let result = parse(source, { module: true });
  if (values.length === 0) {
    return result.ast;
  }

  let path = new Path(result.ast);
  let index = 0;

  path.visit({
    Identifier(path) {
      if (path.node.value === PLACEHOLDER) {
        let value = values[index++];
        path.replaceNode(value);
      }
    }
  });

  return result.ast;
}

module.exports = { module: moduleTemplate, statement, expression };
