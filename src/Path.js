import { AST } from 'esparse';

const Node = Symbol();
const Location = Symbol();
const Parent = Symbol();
const ScopeInfo = Symbol();

export class Path {

  constructor(node, parent = null, location = null) {
    this[Node] = node;
    this[Location] = location;
    this[Parent] = parent;
    this[ScopeInfo] = parent ? parent[ScopeInfo] : null;
  }

  get node() {
    return this[Node];
  }

  get parent() {
    return this[Parent];
  }

  get parentNode() {
    return this[Parent] ? this[Parent][Node] : null;
  }

  forEachChild(fn) {
    if (!this[Node]) {
      return;
    }
    AST.forEachChild(this[Node], (child, key, index) => {
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

    if (this[Parent]) {
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

    this[Node] = newNode;
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
    if (!this[Node]) {
      return;
    }

    let method = visitor[this[Node].type];
    if (typeof method === 'function') {
      method.call(visitor, this);
    }

    if (!this[Node]) {
      return;
    }

    method = visitor.Node;
    if (typeof method === 'function') {
      method.call(visitor, this);
    }
  }

  uniqueIdentifier(baseName, options = {}) {
    let scopeInfo = this[ScopeInfo];
    let ident = null;

    for (let i = 0; true; ++i) {
      let value = baseName;
      if (i > 0) value += '_' + i;
      if (!scopeInfo.names.has(value)) {
        ident = { type: 'Identifier', value };
        break;
      }
    }

    scopeInfo.names.add(ident.value);

    if (options.kind) {
      let { statements } = getBlockScope(this, scopeInfo.map).node;
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
    path[ScopeInfo] = getScopeInfo(result.scopeTree);
    return path;
  }

}

function getLocation(path, fn) {
  if (!path[Parent]) {
    throw new Error('Node does not have a parent');
  }

  let { key, index } = path[Location];
  let node = path[Node];
  let parent = path[Parent][Node];

  let valid = typeof index === 'number' ?
    parent[key][index] === node :
    parent[key] === node;

  if (!valid) {
    AST.forEachChild(parent, (child, k, i, stop) => {
      if (child === node) {
        valid = true;
        path[Location] = { key: (key = k), index: (index = i) };
        return stop;
      }
    });
  }

  if (!valid) {
    throw new Error('Unable to determine node location');
  }

  fn(parent, key, index);
}

function getScopeInfo(scopeTree) {
  let map = new Map();
  let names = new Set();

  function visit(scope) {
    if (scope.node) {
      map.set(scope.node, scope);
    }
    scope.names.forEach((value, key) => names.add(key));
    scope.free.forEach(ident => names.add(ident.value));
    scope.children.forEach(visit);
  }

  visit(scopeTree);

  return { root: scopeTree, map, names };
}

function getBlockScope(path, scopeMap) {
  while (path) {
    let scope = scopeMap.get(path.node);
    if (scope) {
      while (scope.type !== 'block') scope = scope.parent;
      return scope;
    }
    path = path.parent;
  }
  return null;
}
