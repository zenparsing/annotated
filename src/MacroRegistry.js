function validateProcessor(p) {
  if (typeof p !== 'function') {
    throw new TypeError('Macro processor is not a function');
  }
  return p;
}

export class MacroRegistry {
  constructor() {
    this._namedMacros = new Map();
    this._globalMacros = [];
  }

  get globalMacros() {
    return this._globalMacros;
  }

  define(name, processor) {
    if (typeof name === 'string') {
      this._namedMacros.set(name, validateProcessor(processor));
    } else {
      this._globalMacros.push(validateProcessor(name));
    }
  }

  getNamedMacro(name) {
    if (!this._namedMacros.has(name)) {
      throw new SyntaxError(`Macro processor '${ name }' not found`);
    }

    return this._namedMacros.get(name);
  }
}
