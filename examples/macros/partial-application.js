export function registerMacros(api) {
  api.define(path => path.visit(ast, new class PartialApplicationVisitor {

    CallExpression(path) {
      let { node } = path;
      let args = node.arguments;
      let hasPlaceholder = false;

      for (let i = 0; i < args.length; ++i) {
        let arg = args[i];
        if (arg.type === 'Identifier' && arg.value === '$') {
          args[i] = {
            type: 'MemberExpression',
            object: { type: 'Identifier', value: '$$' },
            property: {
              type: 'ComputedPropertyName',
              expression: {
                type: 'NumberLiteral',
                value: i,
              },
            },
          };
          hasPlaceholder = true;
        }
      }

      if (hasPlaceholder) {
        path.replaceNode(api.templates.expression`((...$$) => ${ node })`);
      }
    }

  }));
}
