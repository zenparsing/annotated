const { AST } = require('esparse');

function mapScopes(scope, map = new Map()) {
  if (scope.node) {
    map.set(scope.node, scope);
  }
  scope.children.forEach(child => mapScopes(child, map));
  return map;
}

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
  }

  uniqueIdentifier(baseName) {
    let scope = null;
    for (let path = this; path && !scope; path = path.parent) {
      scope = this._scopeMap.get(path.node);
    }

    function isUnique(name) {
      for (let free of scope.free) {
        if (free.value === name) return false;
      }

      for (let s = scope; s; s = s.parent) {
        if (s.names[name]) return false;
      }

      return true;
    }

    for (let i = 0; true; ++i) {
      let value = baseName;
      if (i > 0) {
        value += '_' + i;
      }

      if (isUnique(value)) {
        let ident = { type: 'Identifier', value };
        scope.free.push(ident);
        return ident;
      }
    }
  }

  uniqueVariable(baseName, options = {}) {
    let { kind = 'let', initializer = null } = options;
    let ident = this.uniqueIdentifier(baseName);
    // TODO: Install a declaration in scope (what happens for function params?)
    return ident;
  }

  static fromParseResult(result) {
    let path = new Path(result.ast);
    path._scopeMap = mapScopes(result.scopeTree);
    return path;
  }

}

module.exports = { Path };
