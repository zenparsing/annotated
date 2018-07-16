module.exports = require('esm')(module)('./src/default.js');

function isNodePreload() {
  try {
    return module.parent.id === 'internal/preload';
  } catch (e) {
    return false;
  }
}
