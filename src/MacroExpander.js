import { parse, print, AST } from 'esparse';
import { ModuleLoader } from './ModuleLoader.js';
import { MacroRegistry } from './MacroRegistry.js';
import { Path } from './Path.js';
import { generateSourceMap, encodeInlineSourceMap } from './SourceMap.js';
import * as ModuleTranslator from './ModuleTranslator.js';
import * as Templates from './Templates.js';

function basename(file) {
  return file.replace(/^[^]*[\\/]([^\\/])|[\\/]+$/g, '$1');
}

ModuleLoader.translate = (source, filename) => expandMacros(source, {
  translateModules: true,
  location: filename,
});

export function registerLoader() {
  return ModuleLoader.startTranslation();
}

export function expandMacros(source, options = {}) {
  let parseResult = parse(source, { module: true, resolveScopes: true });

  let macros = [];
  if (options.translateModules) {
    macros.push(ModuleTranslator);
  }

  let rootPath = Path.fromParseResult(parseResult);
  let linked = linkAnnotations(rootPath, parseResult.annotations);
  let imports = getMacroImports(linked, options.imports);
  let loader = new ModuleLoader(options.location);
  let registry = registerProcessors(imports, loader, macros);

  runProcessors(linked, registry, rootPath);

  let result = print(rootPath.node, { lineMap: parseResult.lineMap });

  if (options.sourceMap) {
    let map = generateSourceMap(result.mappings, {
      sources: [{
        file: basename(options.location),
        content: source,
        default: true,
      }],
    });

    if (options.sourceMap === 'inline') {
      result.output += encodeInlineSourceMap(map);
    } else {
      result.sourceMap = map;
    }
  }

  return result;
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

function getMacroImports(list, modules = []) {
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
    AST,
  };

  for (let specifier of imports) {
    let module = loader.load(specifier);
    if (typeof module.registerMacros !== 'function') {
      throw new Error(`Module ${ specifier } does not export a registerMacros function`);
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
