export function registerMacros({ define, AST }) {
  define('bound', path => {
    if (
      path.node.type !== 'MethodDefinition' ||
      path.parentNode.type !== 'ClassBody'
    ) {
      throw new SyntaxError('@bound can only be applied to method definitions in classes');
    }

    let { node } = path;
    let { elements } = path.parentNode;
    let index = 0;

    while (elements[index].type === 'ClassField') {
      index++;
    }

    elements.splice(index, 0, new AST.ClassField(
      node.static,
      node.name,
      new AST.CallExpression(
        new AST.MemberExpression(
          new AST.MemberExpression(new AST.ThisExpression(), node.name),
          new AST.Identifier('bind')
        ),
        [new AST.ThisExpression()]
      )
    ));
  });
}
