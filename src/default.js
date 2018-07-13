/*

MVP Goals:

- Command line
  - Translate file and write to stdout or file
  - Translate directory and write to an output directory
  - Run code that expands macros
    - This is fuzzy
- API that mirrors the command line
- Loader (require -r macros)

Not MVP:

- Helper library for doing transforms
- Source maps

*/


import { AST, parse, print } from './parser.js';

function addToParentScope(node, newNode) {
  let { parent } = node;
  switch (parent.type) {
    case 'Script':
    case 'Module':
    case 'Block':
    case 'FunctionBody':
      this.statements.push(newNode);
      break;
    default:
      addToParentScope(parent, newNode);
  }
}

function astString(node, output, indent) {
  return JSON.stringify(node, (key, value) => {
    switch (key) {
      case 'start':
      case 'end':
      case 'parent':
        return undefined;
      default:
        return value;
    }
  }, 2);
}

function linkAnnotations(ast, annotations) {
  let output = [];
  let iterator = annotations[Symbol.iterator]();
  let annotation = iterator.next().value;

  function visit(node) {
    if (!annotation)
      return node;

    let matching = [];

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

function removeImportMacro(node) {
  // TODO: Does parent always have "statements"?
  let { statements } = node.parent;
  let pos = statements.indexOf(node);
  // Assert: pos >= 0
  statements.splice(pos, 1);
}

async function registerProcessors(imports, importModule) {
  let globalProcessors = [];
  let registry = new Map();

  for (let specifier of imports) {
    let module = await importModule(specifier);

    if (typeof module.registerMacros !== 'function')
      throw new Error(`Module ${ specifier } does not export a reigsterMacros function`);

    let processor = await module.registerMacros(registry);
    if (processor)
      globalProcessors.push(processor);
  }

  registry.set('import', removeImportMacro);
  registry.globalProcessors = globalProcessors;

  return registry;
}

async function runProcessors(list, registry) {
  for (let { node, annotations } of list) {
    for (let annotation of annotations) {
      let name = annotation.path.map(ident => ident.value).join('.');
      if (!registry.has(name))
        throw new SyntaxError(`Macro processor '${ name }' not found`);

      let processor = registry.get(name);
      if (typeof processor !== 'function')
        throw new SyntaxError(`Macro processor '${ name }' is not a function`);

      await processor(node);
    }
  }

  for (let processor of registry.globalProcessors)
    await processor(node);
}

async function importModule(specifier) {
  return {
    registerMacros(registry) {
      registry.set('private', () => {});
      registry.set('customElement', () => {});
    }
  }
  // TODO: this is completely wrong. It needs to be resolved
  // relative to the input file.
  return require(specifier);
}

async function expandMacros(source) {
  let result = parse(source, { addParentLinks: true });
  let linked = linkAnnotations(result.ast, result.annotations);
  let imports = getMacroImports(linked);
  let registry = await registerProcessors(imports, importModule);
  await runProcessors(linked, registry);
  return print(result.ast);
}

let source = `
  @import 'foo'
  @import 'bar'

  @private _x, _y, _z

  @customElement('foo-bar')
  class C extends HTMLElement {}
`;

expandMacros(source).then(console.log);
