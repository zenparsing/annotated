export function registerMacros(api) {
  api.define('observed', path => {
    if (path.node.type !== 'ClassField' || path.node.static) {
      throw new SyntaxError('@observed can only be applied to class instance fields');
    }

    let { name } = path.node;

    path.node.name = {
      type: 'ComputedPropertyName',
      expression: path.uniqueIdentifier(name.value + '$', {
        kind: 'const',
        initializer: {
          type: 'CallExpression',
          callee: { type: 'Identifier', value: 'Symbol' },
          arguments: [{ type: 'StringLiteral', value: name.value }],
        },
      }),
    };

    let { elements } = path.parentNode;
    let index = elements.indexOf(path.node) + 1;

    elements.splice(index, 0, {
      type: 'MethodDefinition',
      static: false,
      kind: 'get',
      name,
      params: [],
      body: {
        type: 'FunctionBody',
        statements: [{
          type: 'ReturnStatement',
          argument: {
            type: 'MemberExpression',
            object: { type: 'ThisExpression' },
            property: path.node.name,
          },
        }],
      },
    }, {
      type: 'MethodDefinition',
      static: false,
      kind: 'set',
      name,
      params: [{ type: 'Identifier', value: 'v' }],
      body: {
        type: 'FunctionBody',
        statements: api.templates.statementList`
          this.${ path.node.name } = v;
          window.requestAnimationFrame(() => this.render());
        `,
      },
    });

  });
}
