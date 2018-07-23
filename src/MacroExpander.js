const { AST, parse, print } = require('esparse');
const { ModuleLoader } = require('./ModuleLoader.js');
const { MacroRegistry } = require('./MacroRegistry.js');
const { Twister } = require('./Twister.js');
const ModuleTranslator = require('./ModuleTranslator.js');

ModuleLoader.translate = (source, filename) => expandMacros(source, {
  translateModules: true,
  location: filename,
});

function registerLoader(location) {
  return ModuleLoader.startTranslation();
}

function expandMacros(source, options = {}) {
  let result = parse(source, {
    module: true,
    resolveScopes: true,
    addParentLinks: true,
  });

  let macros = [];
  if (options.translateModules) {
    macros.push(ModuleTranslator);
  }

  let linked = linkAnnotations(result.ast, result.annotations);
  let imports = getMacroImports(linked);
  let loader = new ModuleLoader(options.location);
  let twister = new Twister(result);
  let registry = registerProcessors(imports, loader, twister, macros);

  runProcessors(result.ast, linked, registry);

  return print(result.ast, { lineMap: result.lineMap });
}

function linkAnnotations(ast, annotations) {
  let output = [];
  let iterator = annotations[Symbol.iterator]();
  let annotation = iterator.next().value;

  function visit(node) {
    if (!annotation) {
      return node;
    }

    let matching = [];

    // TODO: Currently annotations can appear as the last
    // item in a statement list or class body; in that
    // case the annotation will not be linked correctly

    while (node.start > annotation.end) {
      // Add annotations in reverse order
      matching.unshift(annotation);
      annotation = iterator.next().value;
      if (!annotation) break;
    }

    AST.forEachChild(node, visit);

    if (matching.length > 0) {
      output.push({ node, annotations: matching });
    }
  }

  visit(ast);

  return output;
}

function getMacroImports(list) {
  let modules = [];

  for (let { node, annotations } of list) {
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

function registerProcessors(imports, loader, api, macros) {
  let registry = new MacroRegistry();

  function define(name, processor) {
    registry.define(name, processor);
  }

  for (let specifier of imports) {
    let module = loader.load(specifier);
    if (typeof module.registerMacros !== 'function') {
      throw new Error(`Module ${ specifier } does not export a reigsterMacros function`);
    }

    module.registerMacros(define, api);
  }

  define('import', node => api.removeNode(node));

  for (let module of macros) {
    module.registerMacros(define, api);
  }

  return registry;
}

function runProcessors(root, list, registry) {
  for (let { node, annotations } of list) {
    for (let annotation of annotations) {
      let name = annotation.path.map(ident => ident.value).join('.');
      let processor = registry.getNamedMacro(name);
      processor(node, annotation);
    }
  }

  // TODO: Should we perform a single tree traversal and
  // run "global" processors on every node? This would ensure
  // a single traversal, rather than multiple traversals
  // for each global processor.
  for (let processor of registry.globalMacros) {
    processor(root);
  }
}

module.exports = { expandMacros, registerLoader };
