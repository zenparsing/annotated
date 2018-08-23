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

      let symbolName = name.slice(1);

      let ident = rootPath.uniqueIdentifier(symbolName, {
        kind: 'const',
        initializer: new AST.CallExpression(
          new AST.Identifier('Symbol'),
          [new AST.StringLiteral(symbolName)]
        ),
      });

      this.names.set(name, ident.value);

      return ident;
    }

    MemberExpression({ node }) {
      let { property } = node;
      if (property.type === 'Identifier') {
        let name = this.getSymbolIdentifier(property.value);
        if (name) {
          node.property = new AST.ComputedPropertyName(name);
        }
      }
    }

    ComputedPropertyName({ node }) {
      if (node.expression.type === 'StringLiteral') {
        let name = this.getSymbolIdentifier(node.expression.value);
        if (name) {
          node.expression = name;
        }
      }
    }

    BinaryExpression({ node }) {
      if (node.operator === 'in' && node.left.type === 'StringLiteral') {
        let name = this.getSymbolIdentifier(node.left.value);
        if (name) {
          node.left = name;
        }
      }
    }

    PropertyDefinition({ node }) {
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
