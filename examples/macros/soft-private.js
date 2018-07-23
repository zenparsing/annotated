export function registerMacros(define, api) {
  define(ast => {
    api.visit(new class Visitor {

      constructor() {
        this.names = new Set();
      }

      getSymbolIdentifier(name) {
        if (name.startsWith('_')) {
          // TODO: uniquify name, store in names
          return { type: 'Identifier', value: name };
        }

        return null;
      }

      MemberExpression(node) {
        let prop = node.left;
        if (prop.type === 'Identifier') {
          let name = this.getSymbolIdentifier(prop.value);
          if (name) {
            node.property = {
              type: 'ComputedPropertyName',
              expression: name,
            };
          }
        }
      }

      ComputedPropertyName(node) {
        if (node.expression.type === 'StringLiteral') {
          let name = this.getSymbolIdentifier(node.expression.value);
          if (name) {
            node.expression = name;
          }
        }
      }

      BinaryExpression(node) {
        if (node.operator === 'in' && node.left.type === 'StringLiteral') {
          let name = this.getSymbolIdentifier(node.left.value);
          if (name) {
            node.left = name;
          }
        }
      }

      PropertyDefinition(node) {
        if (node.name.type === 'Identifier') {
          let name = this.getSymbolIdentifier(node.name.value);
          if (name) {
            node.name = {
              type: 'ComputedPropertyName',
              expression: name,
            };
          }
        }
      }

      PatternProperty(node) {
        this.PropertyDefinition(node);
      }

      MethodDefinition(node) {
        this.PropertyDefinition(node);
      }

      ClassField(node) {
        this.PropertyDefinition(node);
      }

    });
  });
}
