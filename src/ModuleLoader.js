import Module from 'module';
import * as path from 'path';

let translate = source => ({ output: source });

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

const { _compile } = Module.prototype;

function startModuleTranslation() {
  if (Module.prototype._compile === compileOverride) {
    return () => {};
  }
  // TODO: Override node and V8 error reporting to use
  // mappings from translate hook (see node-source-map-support)
  Module.prototype._compile = compileOverride;
  return () => { Module.prototype._compile = _compile; };
}

function shouldTranslate(filename) {
  // Don't translate files in node_modules
  return !/[/\\]node_modules[/\\]/i.test(filename);
}

function compileOverride(content, filename) {
  if (shouldTranslate(filename)) {
    content = translate(removeShebang(content), filename).output;
  }
  return _compile.call(this, content, filename);
}

function removeShebang(content) {
  let match = content.startsWith('#!') && /[\r\n]/.exec(content);
  return match ? content.slice(match.index) : content;
}
