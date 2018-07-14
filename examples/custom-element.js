export function registerMacros(Macro) {
  function defineStatement(annotation, ident) {
    let node = Macro.template`
      window.customElements.define(
        ${ annotation.arguments[0] },
        ${ ident },
        ${ annotation.arguments[1] || { type: 'NullLiteral' } }
      )
    `;
    return node.statements[0];
  }

  Macro.define('customElement', (node, annotation) => {
    let classNode =
      node.type === 'ExportDefault' ? node.binding :
      node.type === 'ExportDeclaration' ? node.declaration :
      node;

    Macro.validateNodeType(classNode, ['ClassExpression', 'ClassDeclaration']);

    if (classNode.type === 'ClassDeclaration') {
      // Add an identifier for default class exports
      if (!classNode.identifier) {
        classNode.identifier = Macro.uniqueIdentifier('_class');
      }
      // Insert a define statement after class definition
      Macro.insertStatementAfter(
        classNode,
        defineStatement(annotation, classNode.identifier)
      );
    } else {
      // Create an identifier for the class expression
      let ident = Macro.uniqueVariable('_class');

      // Wrap class definition in a sequence expression
      let wrapped = Macro.template`(
        ${ ident } = ${ classNode },
        ${ defineStatement(annotation, ident).expression },
        ${ ident }
      )`;

      Macro.replaceNode(classNode, wrapped.statements[0].expression);
    }
  });
}
