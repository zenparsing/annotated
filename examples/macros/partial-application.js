export function registerMacros({ define, templates, AST }) {
  define(rootPath => rootPath.visit(new class PartialApplicationVisitor {

    CallExpression(path) {
      path.visitChildren(this);

      let { node } = path;
      let args = node.arguments;
      let hasPlaceholder = false;

      for (let i = 0; i < args.length; ++i) {
        let arg = args[i];
        if (arg.type === 'Identifier' && arg.value === '$') {
          args[i] = new AST.MemberExpression(
            new AST.Identifier('$$'),
            new AST.ComputedPropertyName(new AST.NumberLiteral(i))
          );
          hasPlaceholder = true;
        }
      }

      if (hasPlaceholder) {
        path.replaceNode(templates.expression`((...$$) => ${ node })`);
      }
    }

  }));
}
