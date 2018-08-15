const { AST } = require('esparse');

class Path {

  constructor(node, parent = null, location = null) {
    this._node = node;
    this._location = location;
    this._parent = parent;
    this._scopeMap = parent ? parent._scopeMap : null;
  }

  get node() {
    return this._node;
  }

  get parent() {
    return this._parent;
  }

  get parentNode() {
    return this._parent ? this._parent._node : null;
  }

  forEachChild(fn) {
    AST.forEachChild(this._node, (child, key, index) => {
      fn(new Path(child, this, { key, index }));
    });
  }

  removeNode() {
    this.replaceNode(null);
  }

  replaceNode(newNode) {
    if (typeof newNode !== 'object') {
      throw new TypeError('Invalid node object');
    }

    if (this._parent) {
      let { key, index } = this._location;
      let parentNode = this._parent._node;

      if (typeof index !== 'number') {
        parentNode[key] = newNode;
      } else if (newNode) {
        parentNode[key].splice(index, 1, newNode);
      } else {
        parentNode[key].splice(index, 1);
      }
    }

    this._node = newNode;
  }

  visit(visitor) {
    // TODO: should we support preorder/postorder/both?
    this.forEachChild(childPath => childPath.visit(visitor));
    let method = visitor[this._node.type];
    if (typeof method === 'function') {
      method.call(visitor, this);
    }
    method = visitor.Node;
    if (typeof method === 'function') {
      method.call(visitor, this);
    }
  }

  uniqueIdentifier(baseName, options = {}) {
    let scope = getBlockScope(this);
    let ident = getUniqueIdentifier(baseName, scope);

    scope.free.push(ident);

    if (options.kind) {
      let { statements } = scope.node;
      let i = 0;

      while (i < statements.length) {
        if (statements[i].type !== 'VariableDeclaration') break;
        i += 1;
      }

      statements.splice(i, 0, {
        type: 'VariableDeclaration',
        kind: options.kind,
        declarations: [{
          type: 'VariableDeclarator',
          pattern: { type: 'Identifier', value: ident.value },
          initializer: options.initializer || null,
        }],
      });
    }

    return ident;
  }

  static fromParseResult(result) {
    let path = new Path(result.ast);
    path._scopeMap = mapScopes(result.scopeTree);
    return path;
  }

}

function mapScopes(scope, map = new Map()) {
  if (scope.node) {
    map.set(scope.node, scope);
  }
  scope.children.forEach(child => mapScopes(child, map));
  return map;
}

function getBlockScope(path) {
  while (path) {
    let scope = path._scopeMap.get(path.node);
    if (scope) {
      while (scope.type !== 'block') scope = scope.parent;
      return scope;
    }
    path = path.parent;
  }
  return null;
}

function isUniqueName(name, scope) {
  for (let free of scope.free) {
    if (free.value === name) return false;
  }

  for (let s = scope; s; s = s.parent) {
    if (s.names[name]) return false;
  }

  return true;
}

function getUniqueIdentifier(name, scope) {
  for (let i = 0; true; ++i) {
    let value = name;
    if (i > 0) value += '_' + i;
    if (isUniqueName(value, scope)) {
      return { type: 'Identifier', value };
    }
  }
}

module.exports = { Path };
