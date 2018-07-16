import Module from 'module';

export class Loader {

  // TODO: Should this be usable in the browser?

  constructor(location) {
    if (!location) {
      location = process.cwd();
    }
    this._module = new Module(location, null);
    this._module.paths = Module._nodeModulePaths(location);
    this._location = location;
  }

  async resolve(specifier) {
    // TODO: Update for ESM module lookup rules
    return Module._resolveFilename(specifier, this._module, false, {});
  }

  async load(specifier) {
    // TODO: Update for ESM modules
    return require(await this.resolve(specifier));
  }

}
