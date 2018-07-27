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

function mapParentNodes(root, map) {
  AST.forEachChild(root, child => {
    map.set(child, root);
    mapParentNodes(child, map);
  });
}

class Twister {

  constructor({ ast, scopeTree }) {
    this._ast = ast;
    this._scopeTree = scopeTree;
    this._scopeMap = null;
    this._parentMap = new WeakMap();

    mapParentNodes(this._ast, this._parentMap);
  }

  get ast() {
    return this._ast;
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
        node = this.getParentNode(node);
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

  getParentNode(node) {
    return this._parentMap.get(node);
  }

  removeNode(node) {
    this.replaceNode(node, null);
  }

  replaceNode(oldNode, newNode) {
    let parent = this.getParentNode(oldNode);
    AST.forEachChild(parent, (child, key, index) => {
      if (child !== oldNode) return;

      if (index === null) {
        parent[key] = newNode;
      } else if (newNode) {
        parent[key].splice(index, 1, newNode);
      } else {
        parent[key].splice(index, 1);
      }

      if (newNode) {
        this._parentMap.set(newNode, parent);
      }

      // TODO: break computation when first match is found
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

    let result = parse(source, { module: true });

    mapParentNodes(result.ast, this._parentMap);

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
