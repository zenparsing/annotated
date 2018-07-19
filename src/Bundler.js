import * as Path from 'path';
import { readFile, writeFile } from './AsyncFS.js';
import { locateModule } from './Locator.js';
import { translate, wrapModule } from './Translator.js';
import { isLegacyScheme, removeScheme, isNodeModule, isPackageSpecifier } from './Specifier.js';

const path = require('path');
const { ModuleLoader } = require('./ModuleLoader.js');
const { expandFileToString } = require('./FileExpander.js');

const BUNDLE_INIT =
`
var __M;
(function(a) {
  var list = Array(a.length / 2);
  __M = function(i) {
    var m = list[i], f, e;
    if (typeof m === 'function') {
      f = m;
      m = i ? { exports: {} } : module;
      f(list[i] = m, m.exports);
    }
    return m.exports;
  };
  for (var i = 0; i < .length; i += 2) {
    var j = Math.abs(a[i]);
    list[j] = a[i + 1];
    if (a[i] >= 0) __M(j);
  }
})
`;

const BROKEN_LINK = '##broken_link##';

function isNodeModule(spec) {

}

function isPackageSpecifier(spec) {

}

class Node {
  constructor(path, id) {
    this.path = path;
    this.id = id;
    this.edges = new Map;
    this.output = null;
    this.legacy = false;
    this.importCount = 0;
    this.ignore = false;
  }
}

class GraphBuilder {

  constructor(root, options = {}) {
    this.nodes = new Map();
    this.nextID = 0;
    this.allowBrokenLinks = Boolean(options.allowBrokenLinks);
    this.deep = Boolean(options.deep);
    this.root = this.add(root);
  }

  has(key) {
    return this.nodes.has(key);
  }

  get(key) {
    return this.nodes.get(key);
  }

  add(key) {
    if (this.nodes.has(key)) {
      return this.nodes.get(key);
    }

    let node = new Node(key, this.nextID++);
    this.nodes.set(key, node);
    return node;
  }

  sort(key = this.root.path) {
    let visited = new Set;
    let list = [];

    let visit = key => {
      if (visited.has(key)) {
        return;
      }

      visited.add(key);
      let node = this.nodes.get(key);
      node.edges.forEach((node, key) => visit(key));
      list.push(node);
    };

    visit(key);
    return list;
  }

  addEdge(node, spec) {
    let key = spec;
    let ignore = false;

    if (isNodeModule(key) || (!this.deep && isPackageSpecifier(key))) {
      ignore = true;
    }

    // Not sure what this is about
    // if (ignore && fromRequire)
      // return null;

    if (!ignore) {
      try {
        key = new ModuleLoader(node.path).resolve(key);
      } catch (x) {
        if (!this.allowBrokenLinks) {
          throw x;
        }
        key = BROKEN_LINK;
      }
    }

    let target = this.nodes.get(key);

    if (!target) {
      target = this.add(key);
      target.ignore = ignore;
    }

    target.importCount++;
    node.edges.set(key, target);
    return target;
  }

  async process(node, input) {
    if (node.output !== null) {
      throw new Error('Node already processed');
    }

    let result = {};

    // TODO: Load JSON differently?
    // TODO: Remove shebang?
    // TODO: Allow for function context old-node stuff or just ESM?
    // TODO: Translated file should have require path replaced with __M(id)
    node.output = await expandFileToString(node.path, {
      translateModules: true,
    });

    /*
    node.output = translate(input, {
      identifyModule: path => `__M(${ this.addEdge(node, path, false).id }, 1)`,
      replaceRequire: path => {
        let n = this.addEdge(node, path, true);
        return n ? `__M(${ n.id }, 0)` : null;
      },
      module: !node.legacy,
      functionContext: node.legacy,
      noWrap: true,
      noShebang: true,
      result,
    });
    */
  }

}

function bundle(rootPath, options = {}) {
  rootPath = path.resolve(rootPath);

  let builder = new GraphBuilder(rootPath, options);
  let visited = new Set();
  let pending = 0;
  let resolver;
  let allFetched;

  allFetched = new Promise((resolve, reject) => resolver = { resolve, reject });

  function visit(node) {
    if (node.ignore || visited.has(node.path)) {
      return;
    }

    visited.add(node.path);
    pending += 1;

    let content = path === BROKEN_LINK ? '' : readFile(path, { encoding: 'utf8' });

    builder.process(node).then(() => {
      node.edges.forEach(visit);
      pending -= 1;
      if (pending === 0) {
        resolver.resolve(null);
      }
    }).catch(err => {
      resolver.reject(err);
    });
  }

  visit(builder.root);

  return allFetched.then(() => {
    let output = builder.sort().map(node => {
      let { id } = node;
      if (node.importCount === 0) {
        id = -id;
      }

      let init = node.output === null ?
        `function(m) { m.exports = require(${ JSON.stringify(node.path) }) }` :
        `function(module, exports) {\n\n${ node.output }\n\n}`;

      return `${ id }, ${ init }`;
    }).join(',\n');

    return BUNDLE_INIT + `([\n${ output }]);\n`;
  });
}
