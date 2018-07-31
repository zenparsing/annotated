const { parse } = require('esparse');
const { Path } = require('./Path.js');

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
      if (i < values.length) source += '$$MACRO';
    }
  }

  let result = parse(source, { module: true });
  let path = new Path(result.ast);

  if (values.length > 0) {
    let index = 0;
    path.visit({
      Identifier(path) {
        if (path.node.value === '$$MACRO') {
          path.replaceNode(values[index++]);
        }
      }
    });
  }

  return result.ast;
}

module.exports = { module: moduleTemplate, statement, expression };
