import Module from 'module';
import * as path from 'path';

let translate = source => ({ output: source });

const translationMappings = new Map();

export class ModuleLoader {

  constructor(location) {
    if (!location) {
      location = path.join(process.cwd(), 'module-loader');
    }
    this._module = new Module(location, null);
    this._module.filename = location;
    this._module.paths = Module._nodeModulePaths(path.dirname(location));
    this._location = location;
  }

  resolve(specifier) {
    return Module._resolveFilename(specifier, this._module, false, {});
  }

  load(specifier) {
    let done = startModuleTranslation();
    try {
      return this._module.require(this.resolve(specifier));
    } finally {
      done();
    }
  }

  static get translate() {
    return translate;
  }

  static set translate(value) {
    translate = value;
  }

  static startTranslation() {
    return startModuleTranslation();
  }

}

let _compile = null;
let prepareStackTrace = null;

function startModuleTranslation() {
  if (_compile) {
    return () => {};
  }

  prepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = prepareStackTraceOverride;

  _compile = Module.prototype._compile;
  Module.prototype._compile = compileOverride;

  return () => {
    Module.prototype._compile = _compile;
    Error.prepareStackTrace = prepareStackTrace;
    _compile = null;
    prepareStackTrace = null;
  };
}

function shouldTranslate(filename) {
  // Don't translate files in node_modules
  return !/[/\\]node_modules[/\\]/i.test(filename);
}

function compileOverride(content, filename) {
  if (shouldTranslate(filename)) {
    let result = translate(removeShebang(content), filename);
    content = result.output;
    if (result.mappings) {
      translationMappings.set(filename, result.mappings);
    }
  }
  return _compile.call(this, content, filename);
}

function removeShebang(content) {
  let match = content.startsWith('#!') && /[\r\n]/.exec(content);
  return match ? content.slice(match.index) : content;
}

function prepareStackTraceOverride(error, stack) {
  function mapPosition(mappings, line, column) {
    let right = mappings.length - 1;
    let left = 0;

    if (right < 0) {
      return { line, column };
    }

    // Binary search over generated position
    while (left <= right) {
      let mid = (left + right) >> 1;
      let { generated } = mappings[mid];

      if (generated.line === line && generated.column === column) {
        right = mid;
        break;
      }

      if (
        generated.line < line ||
        generated.line === line && generated.column < column) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return mappings[right].original;
  }

  function stringifyCallSite(callSite) {
    if (callSite.isNative() || callSite.isEval()) {
      return null;
    }

    let source = callSite.getFileName() || callSite.getScriptNameOrSourceURL();
    if (!source) {
      return null;
    }

    let mappings = translationMappings.get(source);
    if (!mappings) {
      return null;
    }

    let line = callSite.getLineNumber();
    let column = callSite.getColumnNumber();
    if (typeof line !== 'number' || typeof column !== 'number') {
      return null;
    }

    // Remove node CJS wrapper header
    let headerLength = 62;
    if (line === 1 && column > headerLength && !callSite.isEval()) {
      column -= headerLength;
    }

    ({ line, column } = mapPosition(mappings, line - 1, column - 1));

    let location = `(${ source }:${ line + 1 }:${ column + 1 })`;
    let functionName = callSite.getFunctionName();

    if (callSite.isConstructor()) {
      return `new ${ functionName || '<anonymous>' } ${ location }`;
    }

    let methodName = callSite.getMethodName();
    if (methodName) {
      let typeName = callSite.getTypeName();
      if (!functionName) {
        functionName = `${ typeName }.${ methodName || '<anonymous>' }`;
      } else {
        if (!functionName.startsWith(typeName)) {
          functionName = typeName + '.' + functionName;
        }
        if (methodName && !functionName.endsWith('.' + methodName)) {
          functionName += `[as ${ methodName }]`;
        }
      }
    }

    if (functionName) {
      return `${ functionName } ${ location }`;
    }

    return location;
  }

  return error + stack
    .map(callSite => stringifyCallSite(callSite) || String(callSite))
    .map(frameString => '\n    at ' + frameString)
    .join('');
}
