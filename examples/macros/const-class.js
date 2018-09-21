export function registerMacros({ define, templates, AST }) {
  define('constClass', path => {
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
        throw new SyntaxError('@constClass can only be applied to classes');
    }

    let className;

    if (classNode.type === 'ClassDeclaration') {

      // Add an identifier for default class exports
      if (!classNode.identifier) {
        classNode.identifier = new AST.Identifier(path.uniqueIdentifier('_class'));
      }

      className = classNode.identifier.value;

      path.insertNodesAfter(...templates.statementList`
        Object.freeze(${ className });
        Object.freeze(${ className }.prototype);
      `);

    } else {

      // Create an identifier for the class expression
      className = path.uniqueIdentifier('_class', { kind: 'let' });

      path.replaceNode(template.expression`
        (
          ${ className } = ${ classNode },
          Object.freeze(${ className }),
          Object.freeze(${ className }.prototype),
          ${ className }
        )
      `);

    }

    let ctor = null;

    // Find the class constructor
    for (let elem of classNode.body.elements) {
      if (elem.type === 'MethodDefinition' && elem.kind === 'constructor') {
        ctor = elem;
        break;
      }
    }

    // Create a constructor if necessary
    if (!ctor) {
      let decl = classNode.base ?
        templates.statement`class C extends B { constructor(...args) { super(...args); } }` :
        templates.statement`class C { constructor() {} }`;

      ctor = decl.body.elements[0];
      classNode.body.elements.push(ctor);
    }

    // Freeze instance if it is at the bottom of the constructor chain
    ctor.body.statements.push(templates.statement`
      if (new.target === ${ className }) Object.freeze(this);
    `);
  });
}
