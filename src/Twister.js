const { parse, AST } = require('esparse');

function createScopeMap(root) {
  function visit(scope) {
    if (scope.node) {
      map.set(scope.node, scope);
    }
    scope.children.forEach(visit);
  }

  let map = new Map();
  visit(root);
  return map;
}

class Twister {

  constructor({ ast, scopeTree }) {
    this._ast = ast;
    this._scopeTree = scopeTree;
    this._scopeMap = null;
  }

  get ast() {
    return this._ast;
  }

  get scopeTree() {
    return this._scopeTree;
  }

  uniqueIdentifier(base, node = null) {
    // TODO: This probably breaks horribly as we mutate the tree
    // and add declarations and other things
    let scope = this._scopeTree;

    if (node) {
      if (!this._scopeMap) {
        this._scopeMap = createScopeMap(this._scopeTree);
      }

      while (!this._scopeMap.has(node)) {
        node = node.parent;
      }

      scope = this._scopeMap.get(node);
    }

    nextIdentifier:
    for (let i = 0; true; ++i) {
      let value = base;
      if (i > 0) {
        value += '$' + i;
      }

      for (let free of scope.free) {
        if (free === value) continue nextIdentifier;
      }

      for (let s = scope; s; s = s.parent) {
        if (s.names[value]) continue nextIdentifier;
      }

      // TODO: Storing the name so that it can't be reused for
      // the same scope later. We'll probably break things by
      // not having the right shaped object here, though.
      scope.names[value] = {};

      return { type: 'Identifier', value };
    }
  }

  removeNode(node) {
    this.replaceNode(node, null);
  }

  replaceNode(oldNode, newNode) {
    // TODO: Worry about fixing "parent" pointers?
    let { parent } = oldNode;
    AST.forEachChild(parent, (child, key, index) => {
      if (child !== oldNode) return;

      if (index === null) {
        parent[key] = newNode;
      } else if (newNode) {
        parent[key].splice(index, 1, newNode);
      } else {
        parent[key].splice(index, 1);
      }
    });
  }

  visit(node, visitor) {
    AST.forEachChild(node, child => this.visit(child, visitor));
    if (typeof visitor[node.type] === 'function') {
      visitor[node.type](node);
    }
  }

  validateNodeType(node, types) {
    for (let type of types) {
      if (node.type === type) return;
    }
    throw new SyntaxError(`Invalid node ${ node.type }`);
  }

  statement(literals, ...values) {
    return this.template(literals, ...values).statements[0];
  }

  expression(literals, ...values) {
    return this.template(literals, ...values).statements[0].expression;
  }

  template(literals, ...values) {
    let source = '';

    if (typeof literals === 'string') {
      source = literals;
    } else {
      for (let i = 0; i < literals.length; ++i) {
        source += literals[i];
        if (i < values.length) source += '$$MACRO';
      }
    }

    let result = parse(source, { module: true, addParentLinks: true });

    if (values.length > 0) {
      let index = 0;
      this.visit(result.ast, {
        Identifier: node => {
          if (node.value === '$$MACRO') {
            this.replaceNode(node, values[index++]);
          }
        }
      });
    }

    return result.ast;
  }

}

module.exports = { Twister };
