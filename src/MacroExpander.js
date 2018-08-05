const { parse, print } = require('esparse');
const { ModuleLoader } = require('./ModuleLoader.js');
const { MacroRegistry } = require('./MacroRegistry.js');
const { Path } = require('./Path.js');
const ModuleTranslator = require('./ModuleTranslator.js');
const Templates = require('./Templates.js');

ModuleLoader.translate = (source, filename) => expandMacros(source, {
  translateModules: true,
  location: filename,
});

function registerLoader() {
  return ModuleLoader.startTranslation();
}

function expandMacros(source, options = {}) {
  let result = parse(source, { module: true, resolveScopes: true });

  let macros = [];
  if (options.translateModules) {
    macros.push(ModuleTranslator);
  }

  let rootPath = Path.fromParseResult(result);
  let linked = linkAnnotations(rootPath, result.annotations);
  let imports = getMacroImports(linked);
  let loader = new ModuleLoader(options.location);
  let registry = registerProcessors(imports, loader, macros);

  runProcessors(linked, registry, rootPath);

  return print(rootPath.node, { lineMap: result.lineMap });
}

function linkAnnotations(rootPath, annotations) {
  let output = [];
  let iterator = annotations[Symbol.iterator]();
  let annotation = iterator.next().value;

  function visit(path) {
    if (!annotation) {
      return;
    }

    let matching = [];

    while (path.node.start > annotation.end) {
      // Annotations are processed bottom-up
      matching.unshift(annotation);
      annotation = iterator.next().value;
      if (!annotation) break;
    }

    path.forEachChild(visit);

    if (matching.length > 0) {
      output.push({ path, annotations: matching });
    }
  }

  visit(rootPath);

  return output;
}

function getMacroImports(list) {
  let modules = [];

  for (let { path, annotations } of list) {
    let { node } = path;
    let importAnnotation = null;

    for (let annotation of annotations) {
      if (annotation.path.length > 1) break;
      let first = annotation.path[0];
      if (first.value !== 'import') break;
      importAnnotation = first;
      break;
    }

    if (!importAnnotation) continue;

    if (
      annotations.length > 1 ||
      node.type !== 'ExpressionStatement' ||
      node.expression.type !== 'StringLiteral'
    ) {
      throw new SyntaxError('Invalid macro import declaration');
    }

    modules.push(node.expression.value);
  }

  return modules;
}

function registerProcessors(imports, loader, macros) {
  let registry = new MacroRegistry();

  let api = {
    define(name, processor) { registry.define(name, processor); },
    templates: Templates,
  };

  for (let specifier of imports) {
    let module = loader.load(specifier);
    if (typeof module.registerMacros !== 'function') {
      throw new Error(`Module ${ specifier } does not export a reigsterMacros function`);
    }

    module.registerMacros(api);
  }

  api.define('import', path => path.removeNode());

  for (let module of macros) {
    module.registerMacros(api);
  }

  return registry;
}

function runProcessors(list, registry, rootPath) {
  for (let { path, annotations } of list) {
    for (let annotation of annotations) {
      let name = annotation.path.map(ident => ident.value).join('.');
      let processor = registry.getNamedMacro(name);
      processor(path, annotation);
      // A processor may remove the node
      if (!path.node) {
        break;
      }
    }
  }

  for (let processor of registry.globalMacros) {
    processor(rootPath);
  }
}

module.exports = { expandMacros, registerLoader };
