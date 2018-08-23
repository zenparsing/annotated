export function registerMacros({ define, templates, AST }) {
  define('observed', path => {
    if (path.node.type !== 'ClassField' || path.node.static) {
      throw new SyntaxError('@observed can only be applied to class instance fields');
    }

    let { name } = path.node;
    let symbolName = '$' + name.value.replace(/^_/, '');

    path.node.name = new AST.ComputedPropertyName(
      path.uniqueIdentifier(symbolName, {
        kind: 'const',
        initializer: new AST.CallExpression(
          new AST.Identifier('Symbol'),
          [new AST.StringLiteral(symbolName)]
        ),
      })
    );

    path.insertNodesAfter(
      new AST.MethodDefinition(false, 'get', name, [], new AST.FunctionBody([
        new AST.ReturnStatement(
          new AST.MemberExpression(new AST.ThisExpression(), path.node.name)
        )
      ])),
      new AST.MethodDefinition(false, 'set', name,
        [new AST.Identifier('value')],
        new AST.FunctionBody(templates.statementList`
          this.${ path.node.name } = value;
          window.requestAnimationFrame(() => this.render());
        `)
      )
    );

  });
}
