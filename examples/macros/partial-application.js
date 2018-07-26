export function registerMacros(define, api) {
  define(ast => {
    api.visit(ast, new class PartialApplicationVisitor {

      CallExpression(node) {
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
          api.replaceNode(node, api.expression`((...$$) => ${ node })`);
        }
      }

    });
  });
}
