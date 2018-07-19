/*

MVP Goals:

- Command line
  - Translate directory and write to an output directory
  - Translate file and write to stdout or file
- Loader (require -r annotated)
- Bundler plugins
  - Webpack
  - Rollup
  - Parcel
- Source mapping

Not MVP:

- Helper library for doing transforms
- General purpose compile-to-JS toolchain

Notes:

- Translation is async, which will cause problems if we are wanting to run it
  like a preloader
- Source mapping for errors on Node is henious (see node-source-map-support)
  but this seems to be a requirement for transparent runtime compilation.

Compile-to-JS toolchain

- Output AST
- Output code generation
- Source map generation
- Node error stack mapping

*/


const { parse, print } = require('./parser.js');
const { ModuleLoader } = require('./ModuleLoader.js');
const { MacroRegistry } = require('./MacroRegistry.js');
const { Twister } = require('./Twister.js');
const ModuleTranslator = require('./ModuleTranslator.js');

ModuleLoader.translate = source => expandMacros(source, {
  translateModules: true,
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

  let linked = linkAnnotations(result.ast, result.annotations);
  let imports = getMacroImports(linked);
  let loader = new ModuleLoader(options.location);
  let twister = new Twister(result);
  let registry = registerProcessors(imports, loader, twister, options.translateModules);

  runProcessors(result.ast, linked, registry);

  return print(result.ast);
}

function linkAnnotations(ast, annotations) {
  let output = [];
  let iterator = annotations[Symbol.iterator]();
  let annotation = iterator.next().value;

  function visit(node) {
    if (!annotation)
      return node;

    let matching = [];

    // TODO: What happens if we have an annotation right before }?
    // Should we lock down more forcefully where these things
    // can appear?

    while (node.start > annotation.end) {
      // Add annotations in reverse order
      matching.unshift(annotation);
      annotation = iterator.next().value;
      if (!annotation) break;
    }

    node.children().forEach(visit);

    if (matching.length > 0)
      output.push({ node, annotations: matching });
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

function registerProcessors(imports, loader, api, translateModules) {
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

  if (translateModules) {
    ModuleTranslator.registerMacros(define, api);
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
  for (let processor of registry.globalMacros)
    processor(root);
}

/*
console.log(expandMacros(`
  @import '../examples/custom-element.js';

  @customElement('p-foo')
  class X extends HTMLElement {}
`).output);
*/

module.exports = { expandMacros, registerLoader };