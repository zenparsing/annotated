const MacroExpander = require('./MacroExpander.js');
const FileExpander = require('./FileExpander.js');

module.exports = Object.assign({}, MacroExpander, FileExpander);
