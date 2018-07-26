export function registerMacros(define) {
  define('customElement', (node, annotation, api) => {
    let classNode =
      node.type === 'ExportDefault' ? node.binding :
      node.type === 'ExportDeclaration' ? node.declaration :
      node;

    api.validateNodeType(classNode, ['ClassExpression', 'ClassDeclaration']);

    let specifier = annotation.arguments[0];
    let options = annotation.arguments[1] || { type: 'NullLiteral' };

    if (classNode.type === 'ClassDeclaration') {
      // Add an identifier for default class exports
      if (!classNode.identifier) {
        classNode.identifier = api.uniqueIdentifier(node, '_class');
      }
      // Insert a define statement after class definition
      let { statements } = node.parent;
      statements.splice(statements.indexOf(node) + 1, 0, api.statement`
        window.customElements.define(
          ${ specifier },
          ${ classNode.identifier },
          ${ options }
        )
      `);
    } else {
      // Create an identifier for the class expression
      let  ident = api.uniqueIdentifier('_class');

      // TODO: Insert variable declaration

      // Wrap class definition in a sequence expression
      api.replaceNode(classNode, api.expression`
        (
          ${ ident } = ${ classNode },
          window.customElements.define(
            ${ specifier },
            ${ ident },
            ${ options }
          ),
          ${ ident }
        )`
      );
    }
  });
}
