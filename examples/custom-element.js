export function registerMacros(define, Macro) {
  define('customElement', (node, annotation) => {
    let classNode =
      node.type === 'ExportDefault' ? node.binding :
      node.type === 'ExportDeclaration' ? node.declaration :
      node;

    Macro.validateNodeType(classNode, ['ClassExpression', 'ClassDeclaration']);

    let specifier = annotation.arguments[0];
    let options = annotation.arguments[1] || { type: 'NullLiteral' };

    if (classNode.type === 'ClassDeclaration') {
      // Add an identifier for default class exports
      if (!classNode.identifier) {
        classNode.identifier = Macro.uniqueIdentifier('_class');
      }
      // Insert a define statement after class definition
      Macro.insertStatementAfter(
        classNode,
        Macro.statement`
          window.customElements.define(
            ${ specifier },
            ${ classNode.identifier },
            ${ options }
          )
        `
      );
    } else {
      // Create an identifier for the class expression
      let ident = Macro.uniqueVariable('_class');

      // Wrap class definition in a sequence expression
      Macro.replaceNode(classNode, Macro.expression`
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
