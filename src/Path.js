const { AST } = require('esparse');

class Path {

  constructor(node, parent = null, location = null) {
    this._node = node;
    this._location = location;
    this._parent = parent;
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

  /*
  switch(visitor) {
    let method = visitor[this._node.type] || visitor[this._node.Node];
    if (typeof method !== 'function') {
      throw new Error(`Visitor method "${ this._node.type }" does not exist`);
    }
    method.call(visitor, this);
  }
  */

  uniqueIdentifier(baseName) {
    // TODO: Use scope analysis
    return { type: 'Identifier', value: baseName };
  }

  uniqueVariable(baseName, options = {}) {
    let { kind = 'let', initializer = null } = options;
    let ident = this.uniqueIdentifier(baseName);
    // Install a declaration in scope (what happens for function params?)
    return ident;
  }

}

module.exports = { Path };
