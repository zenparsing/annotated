const { parse } = require('./parser.js');

class MacroAPI {

  constructor(options = {}) {
    this._ast = options.ast;
    this._registry = options.registry;
    this._scopeTree = options.scopeTree;
  }

  define(name, processor) {
    this._registry.define(name, processor);
  }

  get ast() {
    return this._ast;
  }

  get scopeTree() {
    return this._scopeTree;
  }

  uniqueIdentifier(base) {
    // TODO: Use scope analysis to determine whether this
    // identifier is unique
    return { type: 'Identifier', value: base };
  }

  uniqueVariable(base) {
    // TODO: Add declaration to scope
    return this.uniqueIdentifier(base);
  }

  insertStatementAfter(node, newNode) {
    let { statements } = node.parent;
    let pos = statements.indexOf(node);
    statements.splice(pos + 1, 0, newNode);
  }

  findChildPosition(node) {
    // TODO: We should probably use a more generic tree structure
    // so that we don't have to do all of this property key magic
    let parent = node.parent;
    let keys = Object.keys(parent);

    for (let key of keys) {
      if (key === 'parent') continue;

      let value = parent[key];
      if (value === node) return { parent, key, index: null };

      if (Array.isArray(value)) {
        for (let j = 0; j < value.length; ++j) {
          if (value[j] === node) return { parent, key, index: j };
        }
      }
    }

    throw new Error('Node not found in parent');
  }

  removeNode(node) {
    this.replaceNode(node, null);
  }

  replaceNode(oldNode, newNode) {
    // TODO: Worry about fixing "parent" pointers?
    let pos = this.findChildPosition(oldNode);
    if (pos.index !== null) {
      if (newNode) {
        pos.parent[pos.key].splice(pos.index, 1, newNode);
      } else {
        pos.parent[pos.key].splice(pos.index, 1);
      }
    } else {
      pos.parent[pos.key] = newNode;
    }
  }

  visit(node, visitor) {
    node.children().forEach(child => this.visit(child, visitor));
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

  template(literals, ...values) {
    let source = '';
    for (let i = 0; i < literals.length; ++i) {
      source += literals[i];
      if (i < values.length) source += '$$MACRO';
    }

    let result = parse(source, { addParentLinks: true });
    let index = 0;
    let utils = this;

    this.visit(result.ast, {
      Identifier(node) {
        if (node.value === '$$MACRO') {
          utils.replaceNode(node, values[index++]);
        }
      }
    });

    return result.ast;
  }

}

module.exports = { MacroAPI };
