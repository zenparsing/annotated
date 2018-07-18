import { parse, print } from './parser.js';
import { Twister } from './Twister.js';

export function translateModule(source) {
  let parseResult = parse(source, {
    module: true,
    addParentLinks: true,
    resolveScopes: true,
  });

  ImportExportVisitor.process(parse(`
    import x from 'foo';
    export default function() {}
    export y from 'bar';
  `, {
    module: true,
    addParentLinks: true,
    resolveScopes: true,
  }));

  return source;
}

class ImportExportVisitor {
  constructor(parseResult) {
    this.twister = new Twister(parseResult);
    this.reexports = [];
    this.exports = [];
    this.imports = [];
    this.replacements = null;
    this.index = 0;
  }

  static process(parseResult) {
    return new this(parseResult).process();
  }

  process() {
    this.visit(this.twister.ast);
    console.log(print(this.twister.ast).output);
  }

  visit(node) {
    if (node && this[node.type]) {
      this[node.type](node);
    }
  }

  replaceWith(newNode) {
    this.replacements[this.index] = newNode;
  }

  moduleIdentifier(value) {
    return {
      type: 'Identifier',
      value: '_' + value.replace(/[^a-zA-Z0-1_$]/g, '_'),
    };
  }

  Module(node) {
    this.replacements = Array.from(node.statements);

    for (let i = 0; i < node.statements.length; ++i) {
      this.index = i;
      this.visit(node.statements[i]);
    }

    let statements = [this.twister.statement`"use strict"`];

    for (let { names, from, exporting } of this.imports) {
      let ident = this.moduleIdentifier(from.value);

      statements.push(this.twister.statement`
        const ${ ident } = require(${ from })
      `);

      for (let { imported, local } of names) {
        if (exporting) {
          statements.push(this.twister.statement`
            exports.${ imported } = ${ ident }.${ local }
          `);
        } else {
          statements.push(this.twister.statement`
            const ${ local } = ${ ident }.${ imported }
          `);
        }
      }
    }

    for (let { local, exported, hoist } of this.exports) {
      let value = hoist ? local : { type: 'Identifier', value: 'undefined' };
      statements.push(this.twister.statement`
        exports.${ exported } = ${ value }
      `);
    }

    for (let node of this.replacements) {
      if (node) statements.push(node);
    }

    node.statements = statements;
  }

  ImportDeclaration(node) {
    this.imports.push(this.topImport = {
      names: [],
      from: node.from,
      exporting: false,
    });
    this.visit(node.imports);
    this.replaceWith(null);
  }

  NamedImports(node) {
    for (let child of node.specifiers) {
      this.visit(child);
    }
  }

  ImportSpecifier(node) {
    this.topImport.names.push({
      imported: node.imported,
      local: node.local ? node.local : node.imported,
    });
  }

  DefaultImport(node) {
    this.topImport.names.push({
      imported: { type: 'Identifier', value: 'default' },
      local: node.identifier,
    })
    this.visit(node.imports);
  }

  NamespaceImport(node) {
    this.topImport.names.push({
      imported: '*',
      local: node.identifier,
    });
  }

  ExportDeclaration(node) {
    let ident = node.declaration.identifier;
    this.exports.push({
      local: ident,
      exported: ident,
      hoist: true,
    });
    this.replaceWith(node.declaration);
  }

  ExportNameList(node) {
    if (node.from) {
      let reexport = { names: [], from: node.from, exporting: true };
      for (let child of node.specifiers) {
        reexport.names.push({
          local: child.local,
          exported: child.exported ? child.exported : child.local,
        });
      }
      this.imports.push(reexport);
    } else {
      for (let child of node.specifiers) {
        this.exports.push({
          local: child.local,
          exported: child.exported ? child.exported : child.local,
          hoist: false,
        });
      }
    }
    this.replaceWith(null);
  }

  ExportDefault(node) {
    let { binding } = node;
    if (binding.type === 'FunctionDeclaration' || binding.type === 'ClassDeclaration') {
      if (!binding.identifier) {
        binding.identifier = {
          type: 'Identifier',
          value: '__default', // TODO: uniquify
        };
      }
      this.exports.push({
        local: binding.identifier,
        exported: { type: 'Identifier', value: 'default' },
        hoist: true,
      });
      this.replaceWith(binding);
    } else {
      this.exports.push({
        local: null,
        exported: { type: 'Identifier', value: 'default' },
        hoist: false,
      });
      this.replaceWith(this.twister.statement`
        exports.default = ${ node.binding };
      `);
    }
  }

  ExportNamespace(node) {
    this.imports.push({
      names: [{
        local: '*',
        exported: node.identifier,
      }],
      from: node.from,
      exporting: true,
    });
    this.replaceWith(null);
  }

  ExportDefaultFrom(node) {
    this.imports.push({
      names: [{
        local: { type: 'Identifier', value: 'default' },
        exported: node.identifier,
      }],
      from: node.from,
      exporting: true,
    });
    this.replaceWith(null);
  }

}
