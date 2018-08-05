function registerMacros(api) {
  api.define(rootPath => new ImportExportProcessor(api).execute(rootPath));
}

class ImportExportProcessor {

  constructor(api) {
    this.templates = api.templates;
    this.rootPath = null;
    this.moduleNames = new Map();
    this.reexports = [];
    this.exports = [];
    this.imports = [];
    this.replacements = null;
    this.index = 0;
  }

  execute(rootPath) {
    this.rootPath = rootPath;
    this.visit(rootPath.node);
  }

  visit(node) {
    if (node && this[node.type]) {
      this[node.type](node);
    }
  }

  replaceWith(newNode) {
    this.replacements[this.index] = newNode;
  }

  moduleIdentifier(from) {
    let value = this.moduleNames.get(from.value);
    if (value) {
      return { type: 'Identifier', value };
    }

    value = '_' + from.value
      .replace(/.*[/\\](?=[^/\\]+$)/, '')
      .replace(/\..*$/, '')
      .replace(/[^a-zA-Z0-1_$]/g, '_');

    let ident = this.rootPath.uniqueIdentifier(value);
    this.moduleNames.set(value, ident.value);
    return ident;
  }

  Module(node) {
    this.replacements = Array.from(node.statements);

    for (let i = 0; i < node.statements.length; ++i) {
      this.index = i;
      this.visit(node.statements[i]);
    }

    let statements = [this.templates.statement`'use strict'`];

    for (let { names, from, exporting } of this.imports) {
      if (exporting && names.length === 1) {
        let { imported, local } = names[0];
        if (imported) {
          statements.push(this.templates.statement`
            exports.${ local } = require(${ from }).${ imported }
          `);
        } else {
          statements.push(this.templates.statement`
            exports.${ local } = require(${ from })
          `);
        }
        continue;
      }

      let ident = this.moduleIdentifier(from);

      statements.push(this.templates.statement`
        const ${ ident } = require(${ from })
      `);

      for (let { imported, local } of names) {
        let statement;

        if (exporting) {
          if (imported) {
            statement = this.templates.statement`
              exports.${ local } = ${ ident }.${ imported }
            `;
          } else {
            statement = this.templates.statement`
              exports.${ local } = ${ ident }
            `;
          }
        } else {
          if (imported) {
            if (imported.value === 'default') {
              statement = this.templates.statement`
                const ${ local } = typeof ${ ident } === 'function' ?
                  ${ ident } :
                  ${ ident }.default
              `;
            } else {
              statement = this.templates.statement`
                const ${ local } = ${ ident }.${ imported }
              `;
            }
          } else {
            statement = this.templates.statement`
              const ${ local } = ${ ident }
            `;
          }
        }

        statements.push(statement);
      }
    }

    for (let { local, exported, hoist } of this.exports) {
      let value = hoist ? local : { type: 'Identifier', value: 'undefined' };
      statements.push(this.templates.statement`
        exports.${ exported } = ${ value }
      `);
    }

    for (let node of this.replacements) {
      if (Array.isArray(node)) {
        node.forEach(n => statements.push(n));
      } else if (node) {
        statements.push(node);
      }
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
    });
    this.visit(node.imports);
  }

  NamespaceImport(node) {
    this.topImport.names.push({
      imported: null,
      local: node.identifier,
    });
  }

  getPatternDeclarations(node, list) {
    switch (node.type) {
      case 'VariableDeclaration':
        node.declarations.forEach(c => this.getPatternDeclarations(c, list));
        break;
      case 'VariableDeclarator':
        this.getPatternDeclarations(node.pattern, list);
        break;
      case 'Identifier':
        list.push(node);
        break;
      case 'ObjectPattern':
        node.properties.forEach(p => this.getPatternDeclarations(p.pattern || p.name, list));
        break;
      case 'ArrayPattern':
        node.elements.forEach(p => this.getPatternDeclarations(p.pattern, list));
        break;
    }
  }

  ExportDeclaration(node) {
    let { declaration } = node;
    if (declaration.type === 'VariableDeclaration') {
      let statements = [declaration];
      let bindings = [];
      this.getPatternDeclarations(declaration, bindings);
      for (let ident of bindings) {
        this.exports.push({
          local: ident,
          exported: ident,
          hoist: false,
        });
        statements.push(this.templates.statement`
          exports.${ ident } = ${ ident }
        `);
      }
      this.replaceWith(statements);
    } else {
      let ident = declaration.identifier;
      let exportName = {
        local: ident,
        exported: ident,
        hoist: false,
      };
      if (declaration.type === 'FunctionDeclaration') {
        exportName.hoist = true;
        this.replaceWith(declaration);
      } else {
        this.replaceWith([
          declaration,
          this.templates.statement`exports.${ ident } = ${ ident }`,
        ]);
      }
      this.exports.push(exportName);
    }
  }

  ExportNameList(node) {
    if (node.from) {
      let reexport = { names: [], from: node.from, exporting: true };
      for (let child of node.specifiers) {
        reexport.names.push({
          imported: child.local,
          local: child.exported ? child.exported : child.local,
        });
      }
      this.imports.push(reexport);
      this.replaceWith(null);
    } else {
      let statements = [];
      for (let child of node.specifiers) {
        let name = {
          local: child.local,
          exported: child.exported ? child.exported : child.local,
          hoist: false,
        };

        this.exports.push(name);

        statements.push(this.templates.statement`
          exports.${ name.exported } = ${ name.local }
        `);
      }
      this.replaceWith(statements);
    }
  }

  ExportDefault(node) {
    let { binding } = node;

    if (binding.type === 'FunctionDeclaration' || binding.type === 'ClassDeclaration') {
      if (!binding.identifier) {
        binding.identifier = this.rootPath.uniqueIdentifier('_default');
      }

      let exportName = {
        local: binding.identifier,
        exported: { type: 'Identifier', value: 'default' },
        hoist: false,
      };

      if (binding.type === 'FunctionDeclaration') {
        exportName.hoist = true;
        this.replaceWith(binding);
      } else {
        this.replaceWith([
          binding,
          this.templates.statement`exports.default = ${ binding.identifier }`,
        ]);
      }

      this.exports.push(exportName);

    } else {

      this.exports.push({
        local: null,
        exported: { type: 'Identifier', value: 'default' },
        hoist: false,
      });

      this.replaceWith(this.templates.statement`
        exports.default = ${ node.binding };
      `);

    }
  }

  ExportNamespace(node) {
    this.imports.push({
      names: [{
        imported: null,
        local: node.identifier,
      }],
      from: node.from,
      exporting: true,
    });
    this.replaceWith(null);
  }

  ExportDefaultFrom(node) {
    this.imports.push({
      names: [{
        imported: { type: 'Identifier', value: 'default' },
        local: node.identifier,
      }],
      from: node.from,
      exporting: true,
    });
    this.replaceWith(null);
  }

}

module.exports = { registerMacros };
