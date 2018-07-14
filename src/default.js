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
import { Loader } from './Loader.js';
import { Registry } from './Registry.js';
import { MacroAPI } from './MacroAPI.js';

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

async function registerProcessors(imports, loader) {
  let registry = new Registry();
  let api = new MacroAPI(registry);

  for (let specifier of imports) {
    let module = await loader.load(specifier);
    if (typeof module.registerMacros !== 'function') {
      throw new Error(`Module ${ specifier } does not export a reigsterMacros function`);
    }

    await module.registerMacros(api);
  }

  registry.define('import', node => api.removeNode(node));

  return registry;
}

async function runProcessors(root, list, registry) {
  for (let { node, annotations } of list) {
    for (let annotation of annotations) {
      let name = annotation.path.map(ident => ident.value).join('.');
      let processor = registry.getNamedMacro(name);
      await processor(node, annotation);
    }
  }

  for (let processor of registry.globalMacros)
    await processor(root);
}

async function expandMacros(source, location) {
  let loader = new Loader(location);
  let result = parse(source, { addParentLinks: true });
  let linked = linkAnnotations(result.ast, result.annotations);
  let imports = getMacroImports(linked);
  let registry = await registerProcessors(imports, loader);
  await runProcessors(result.ast, linked, registry);
  return print(result.ast);
}

let source = `
  @import '../examples/custom-element.js';

  @customElement('foo-bar')
  class C extends HTMLElement {}
`;

expandMacros(source, __filename).then(console.log);
