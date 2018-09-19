import { resolveScopes } from 'esparse';

export function registerMacros({ define, templates, AST }) {
  define(rootPath => new ImportExportProcessor().execute(rootPath));

  class ImportExportProcessor {

    constructor() {
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

    Module(node) {
      let moduleScope = resolveScopes(node).children[0];
      let replaceMap = new Map();

      this.replacements = Array.from(node.statements);

      for (let i = 0; i < node.statements.length; ++i) {
        this.index = i;
        this.visit(node.statements[i]);
      }

      let statements = [new AST.Directive('use strict', new AST.StringLiteral('use strict'))];

      for (let { names, from, exporting } of this.imports) {
        if (exporting && names.length === 1) {
          let { imported, local } = names[0];
          if (imported) {
            statements.push(templates.statement`
              exports.${ local } = require(${ from }).${ imported }
            `);
          } else if (local) {
            statements.push(templates.statement`
              exports.${ local } = require(${ from })
            `);
          } else {
            statements.push(templates.statement`
              Object.assign(exports, require(${ from }))
            `);
          }
          continue;
        }

        let name = this.moduleNames.get(from.value);
        let ident = name ? new AST.Identifier(name) : null;

        if (!ident) {
          name = this.rootPath.uniqueIdentifier('_' + from.value
            .replace(/.*[/\\](?=[^/\\]+$)/, '')
            .replace(/\..*$/, '')
            .replace(/[^a-zA-Z0-1_$]/g, '_')
          );
          this.moduleNames.set(from.value, name);
          ident = new AST.Identifier(name);
          statements.push(templates.statement`
            let ${ ident } = require(${ from })
          `);
        }

        for (let { imported, local } of names) {
          let statement = null;

          if (exporting) {
            if (imported) {
              statement = templates.statement`
                exports.${ local } = ${ ident }.${ imported }
              `;
            } else if (local) {
              statement = templates.statement`
                exports.${ local } = ${ ident }
              `;
            } else {
              statement = templates.statement`
                Object.assign(exports, ${ ident })
              `;
            }
          } else {
            if (imported) {
              if (imported.value === 'default') {
                statement = templates.statement`
                  if (typeof ${ ident } === 'function') {
                    ${ ident } = { default: ${ ident } };
                  }
                `;
              }
              for (let ref of moduleScope.names.get(local.value).references) {
                replaceMap.set(ref, new AST.MemberExpression(ident, imported));
              }
            } else {
              statement = templates.statement`
                const ${ local } = ${ ident }
              `;
            }
          }

          if (statement) {
            statements.push(statement);
          }
        }
      }

      for (let { local, exported, hoist } of this.exports) {
        let value = hoist ? local : new AST.Identifier('undefined');
        statements.push(templates.statement`
          exports.${ new AST.Identifier(exported.value) } = ${ value }
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

      this.rootPath.visit({
        Identifier(path) {
          let expr = replaceMap.get(path.node);
          if (!expr) {
            return;
          }

          let { parentNode } = path;

          switch (parentNode.type) {
            case 'PatternProperty':
              if (parentNode.name === path.node && !parentNode.pattern) {
                parentNode.pattern = expr;
              }
              break;
            case 'PropertyDefinition':
              if (!parentNode.expression) {
                parentNode.expression = expr;
              }
              break;
            default:
              path.replaceNode(expr);
              break;
          }
        },

        ImportCall(path) {
          path.replaceNode(templates.expression`
            Promise.resolve(require(${ path.node.argument }))
          `);
        },
      });
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
        imported: new AST.Identifier('default'),
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
          statements.push(templates.statement`
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
            templates.statement`exports.${ ident } = ${ ident }`,
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
            exported: new AST.Identifier(child.exported ? child.exported.value : child.local.value),
            hoist: false,
          };

          this.exports.push(name);

          statements.push(templates.statement`
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
          exported: new AST.Identifier('default'),
          hoist: false,
        };

        if (binding.type === 'FunctionDeclaration') {
          exportName.hoist = true;
          this.replaceWith(binding);
        } else {
          this.replaceWith([
            binding,
            templates.statement`exports.default = ${ binding.identifier }`,
          ]);
        }

        this.exports.push(exportName);

      } else {

        this.exports.push({
          local: null,
          exported: new AST.Identifier('default'),
          hoist: false,
        });

        this.replaceWith(templates.statement`
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
          imported: new AST.Identifier('default'),
          local: node.identifier,
        }],
        from: node.from,
        exporting: true,
      });
      this.replaceWith(null);
    }

  }
}
