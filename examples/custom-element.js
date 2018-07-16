export function registerMacros(Macro) {
  Macro.define('customElement', (node, annotation) => {
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
        Macro.template`
          window.customElements.define(
            ${ specifier },
            ${ classNode.identifier },
            ${ options }
          )
        `.statements[0]
      );
    } else {
      // Create an identifier for the class expression
      let ident = Macro.uniqueVariable('_class');

      // Wrap class definition in a sequence expression
      let wrapped = Macro.template`(
        ${ ident } = ${ classNode },
        window.customElements.define(
          ${ specifier },
          ${ ident },
          ${ options }
        ),
        ${ ident }
      )`;

      Macro.replaceNode(classNode, wrapped.statements[0].expression);
    }
  });
}
