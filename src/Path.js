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
      getLocation(this, (parent, key, index) => {
        if (typeof index !== 'number') {
          parent[key] = newNode;
        } else if (newNode) {
          parent[key].splice(index, 1, newNode);
        } else {
          parent[key].splice(index, 1);
        }
      });
    }

    this._node = newNode;
  }

  insertNodesAfter(...nodes) {
    getLocation(this, (parent, key, index) => {
      if (typeof index !== 'number') {
        throw new Error('Node is not contained within a node list');
      }
      parent[key].splice(index + 1, 0, ...nodes);
    });
  }

  insertNodesBefore(...nodes) {
    getLocation(this, (parent, key, index) => {
      if (typeof index !== 'number') {
        throw new Error('Node is not contained within a node list');
      }
      parent[key].splice(index, 0, ...nodes);
    });
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

function getLocation(path, fn) {
  if (!path._parent) {
    throw new Error('Node does not have a parent');
  }

  let { key, index } = path._location;
  let node = path._node;
  let parent = path._parent._node;

  let valid = typeof index === 'number' ?
    parent[key][index] === node :
    parent[key] === node;

  if (!valid) {
    AST.forEachChild(parent, (child, k, i, stop) => {
      if (child === node) {
        valid = true;
        path._location = { key: (key = k), index: (index = i) };
        return stop;
      }
    });
  }

  if (!valid) {
    throw new Error('Unable to determine node location');
  }

  fn(parent, key, index);
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
