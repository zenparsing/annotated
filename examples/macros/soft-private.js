export function registerMacros(api) {
  api.define(path => path.visit(new class SoftPrivateVisitor {

    constructor() {
      this.names = new Map();
    }

    getSymbolIdentifier(name) {
      if (name.startsWith('_')) {
        let value = this.names.get(name);
        if (value) {
          return { type: 'Identifier', value };
        }
        let ident = path.uniqueIdentifier(name);
        this.names.set(name, ident.value);
        return ident;
      }

      return null;
    }

    Module(node) {
      let statements = Array.from(this.names).map(([key, value]) => {
        let ident = { type: 'Identifier', value };
        let name = { type: 'StringLiteral', value: key };
        return api.templates.statement`const ${ ident } = Symbol(${ name })`;
      });

      node.statements.unshift(...statements);
    }

    MemberExpression(node) {
      let { property } = node;
      if (property.type === 'Identifier') {
        let name = this.getSymbolIdentifier(property.value);
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

  }));
}
