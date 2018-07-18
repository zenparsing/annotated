const Module = require('module');
const { translateModule } = require('./ModuleTranslator.js');

class ModuleLoader {

  // TODO: Should this be usable in the browser?
  // TODO: Use "new" module lookup rules?

  constructor(location) {
    if (!location) {
      location = process.cwd();
    }
    this._module = new Module(location, null);
    this._module.paths = Module._nodeModulePaths(location);
    this._location = location;
  }

  async resolve(specifier) {
    return Module._resolveFilename(specifier, this._module, false, {});
  }

  async load(specifier) {
    let done = startModuleTranslation();
    try {
      return this._module.require(await this.resolve(specifier));
    } finally {
      done();
    }
  }

}

const { _compile } = Module.prototype;

function startModuleTranslation() {
  if (Module.prototype._compile === compileOverride) {
    return () => {};
  }
  Module.prototype._compile = compileOverride;
  return () => { Module.prototype._compile = _compile };
}

function shouldTranslate(filename) {
  return !/[\/\\]node_modules[\/\\]/i.test(filename);
}

function compileOverride(content, filename) {
  if (shouldTranslate(filename)) {
    content = translateModule(removeShebang(content)).output;
  }
  return _compile.call(this, content, filename);
}

function removeShebang(content) {
  let match = content.startsWith('#!') && /[\r\n]/.exec(content);
  return match ? content.slice(match.index) : content;
}

module.exports = { ModuleLoader };