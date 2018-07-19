const MacroExpander = require('./MacroExpander.js');
const FileExpander = require('./FileExpander.js');

module.exports = Object.assign({}, MacroExpander, FileExpander);

function isNodePreload() {
  try {
    return module.parent.id === 'internal/preload';
  } catch (e) {
    return false;
  }
}

if (isNodePreload()) {
  // TODO: Should we attempt to translate stuff in the REPL
  // or expressions on the command line?
  MacroExpander.registerLoader();
}
