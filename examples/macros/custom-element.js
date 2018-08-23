export function registerMacros(api) {
  api.define('customElement', (path, annotation) => {
    let { node } = path;

    let classNode =
      node.type === 'ExportDefault' ? node.binding :
      node.type === 'ExportDeclaration' ? node.declaration :
      node;

    switch (classNode.type) {
      case 'ClassExpression':
      case 'ClassDeclaration':
        break;
      default:
        throw new SyntaxError('@customElement can only be applied to classes');
    }

    let specifier = annotation.arguments[0];
    let options = annotation.arguments[1] || { type: 'NullLiteral' };

    if (classNode.type === 'ClassDeclaration') {

      // Add an identifier for default class exports
      if (!classNode.identifier) {
        classNode.identifier = path.uniqueIdentifier('_class');
      }

      // Insert a define statement after class definition
      path.insertNodesAfter(api.templates.statement`
        window.customElements.define(
          ${ specifier },
          ${ classNode.identifier },
          ${ options }
        )
      `);

    } else {

      // Create an identifier for the class expression
      let  ident = path.uniqueIdentifier('_class', { kind: 'let' });

      // TODO: Is "path" always right here? It couldn't be an export
      // declaration?
      path.replaceNode(api.template.expression`
        (
          ${ ident } = ${ classNode },
          window.customElements.define(
            ${ specifier },
            ${ ident },
            ${ options }
          ),
          ${ ident }
        )
      `);

    }
  });
}
