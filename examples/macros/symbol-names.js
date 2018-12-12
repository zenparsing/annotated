export function registerMacros({ define, AST }) {
  define(rootPath => rootPath.visit(new class SoftPrivateVisitor {

    constructor() {
      this.names = new Map();
    }

    getSymbolIdentifier(name) {
      if (!name.startsWith('_')) {
        return null;
      }

      let value = this.names.get(name);
      if (value) {
        return new AST.Identifier(value);
      }

      let ident = rootPath.uniqueIdentifier(name, {
        kind: 'const',
        initializer: new AST.CallExpression(
          new AST.Identifier('Symbol'),
          [new AST.StringLiteral(name.slice(1))]
        ),
      });

      this.names.set(name, ident);

      return new AST.Identifier(ident);
    }

    MemberExpression(path) {
      path.visitChildren(this);
      let { node } = path;
      let { property } = node;
      if (property.type === 'Identifier') {
        let name = this.getSymbolIdentifier(property.value);
        if (name) {
          node.property = new AST.ComputedPropertyName(name);
        }
      }
    }

    ComputedPropertyName(path) {
      path.visitChildren(this);
      let { node } = path;
      if (node.expression.type === 'StringLiteral') {
        let name = this.getSymbolIdentifier(node.expression.value);
        if (name) {
          node.expression = name;
        }
      }
    }

    BinaryExpression(path) {
      path.visitChildren(this);
      let { node } = path;
      if (node.operator === 'in' && node.left.type === 'StringLiteral') {
        let name = this.getSymbolIdentifier(node.left.value);
        if (name) {
          node.left = name;
        }
      }
    }

    PropertyDefinition(path) {
      path.visitChildren(this);
      let { node } = path;
      if (node.name.type === 'Identifier') {
        let name = this.getSymbolIdentifier(node.name.value);
        if (name) {
          node.name = new AST.ComputedPropertyName(name);
        }
      }
    }

    PatternProperty(path) {
      this.PropertyDefinition(path);
    }

    MethodDefinition(path) {
      this.PropertyDefinition(path);
    }

    ClassField(path) {
      this.PropertyDefinition(path);
    }

  }));
}
