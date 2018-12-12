export function registerMacros({ define, templates, AST }) {
  define('frozen', path => {
    let { node } = path;

    let targetNode =
      node.type === 'ExportDefault' ? node.binding :
      node.type === 'ExportDeclaration' ? node.declaration :
      node;

    switch (targetNode.type) {
      case 'ClassExpression':
      case 'ClassDeclaration':
      case 'ObjectLiteral':
        break;
      default:
        throw new SyntaxError('@frozen can only be applied to classes and object literals');
    }

    if (targetNode.type === 'ObjectLiteral') {
      path.replaceNode(template.expression`Object.freeze(${ targetNode })`);
      return;
    }

    let className;

    if (targetNode.type === 'ClassDeclaration') {

      // Add an identifier for default class exports
      if (!targetNode.identifier) {
        targetNode.identifier = new AST.Identifier(path.uniqueIdentifier('_class'));
      }

      className = targetNode.identifier.value;

      path.insertNodesAfter(...templates.statementList`
        Object.freeze(${ className });
        Object.freeze(${ className }.prototype);
      `);

    } else {

      // Create an identifier for the class expression
      className = path.uniqueIdentifier('_class', { kind: 'let' });

      path.replaceNode(template.expression`
        (
          ${ className } = ${ targetNode },
          Object.freeze(${ className }),
          Object.freeze(${ className }.prototype),
          ${ className }
        )
      `);

    }

    let ctor = null;

    // Find the class constructor
    for (let elem of targetNode.body.elements) {
      if (elem.type === 'MethodDefinition' && elem.kind === 'constructor') {
        ctor = elem;
        break;
      }
    }

    // Create a constructor if necessary
    if (!ctor) {
      let decl = targetNode.base ?
        templates.statement`class C extends B { constructor(...args) { super(...args); } }` :
        templates.statement`class C { constructor() {} }`;

      ctor = decl.body.elements[0];
      targetNode.body.elements.push(ctor);
    }

    // Freeze instance if it is at the bottom of the constructor chain
    ctor.body.statements.push(templates.statement`
      if (new.target === ${ className }) Object.freeze(this);
    `);
  });
}
