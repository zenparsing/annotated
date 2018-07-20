const Module = require('module');

let translate = source => ({ output: source });

class ModuleLoader {

  constructor(location) {
    if (!location) {
      location = process.cwd();
    }
    this._module = new Module(location, null);
    this._module.paths = Module._nodeModulePaths(location);
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

const { _compile } = Module.prototype;

function startModuleTranslation() {
  if (Module.prototype._compile === compileOverride) {
    return () => {};
  }
  // TODO: Override node and V8 error reporting to use
  // mappings from translate hook (see node-source-map-support)
  Module.prototype._compile = compileOverride;
  return () => { Module.prototype._compile = _compile };
}

function shouldTranslate(filename) {
  // Don't translate files in node_modules
  return !/[\/\\]node_modules[\/\\]/i.test(filename);
}

function compileOverride(content, filename) {
  if (shouldTranslate(filename)) {
    content = translate(removeShebang(content)).output;
  }
  return _compile.call(this, content, filename);
}

function removeShebang(content) {
  let match = content.startsWith('#!') && /[\r\n]/.exec(content);
  return match ? content.slice(match.index) : content;
}

module.exports = { ModuleLoader };
