export function registerMacros(api) {
  api.define('bound', path => {
    if (
      path.node.type !== 'MethodDefinition' ||
      path.parentNode.type !== 'ClassBody'
    ) {
      throw new SyntaxError('@bound can only be applied to method definitions in classes');
    }

    let { elements } = path.parentNode;
    let index = 0;

    while (elements[index].type === 'ClassField') {
      index++;
    }

    elements.splice(index, 0, {
      type: 'ClassField',
      static: path.node.static,
      name: path.node.name,
      initializer: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'MemberExpression',
            object: { type: 'ThisExpression' },
            property: path.node.name,
          },
          property: { type: 'Identifier', value: 'bind' },
        },
        arguments: [{ type: 'ThisExpression' }],
      },
    });

  });
}
