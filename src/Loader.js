import Module from 'module';

export class Loader {

  // TODO: Should this be usable in the browser?

  // TODO: We need to translate "import" and "export" as ESM does
  // so that we can pick up all of the dependencies that we need
  // to pick up.

  constructor(location) {
    if (!location) {
      location = process.cwd();
    }
    this._module = new Module(location, null);
    this._module.paths = Module._nodeModulePaths(location);
    this._location = location;
  }

  resolve(specifier) {
    // TODO: Update for ESM module lookup rules
    return Module._resolveFilename(specifier, this._module, false, {});
  }

  load(specifier) {
    // TODO: Update for ESM modules
    return require(this.resolve(specifier));
  }

}
