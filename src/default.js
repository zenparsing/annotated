import { AST, parse, print } from './parser.js';

function astString(node, output, indent) {
  return JSON.stringify(node, (key, value) => {
    switch (key) {
      case 'start':
      case 'end':
      case 'parent':
        return undefined;
      default:
        return value;
    }
  }, 2);
}

function processAnnotations(ast, annotations, processor) {
  let iterator = annotations[Symbol.iterator]();
  let annotation = iterator.next().value;

  function visit(node) {
    if (!annotation)
      return node;

    let matching = [];
    let output = null;

    while (node.start > annotation.end) {
      matching.push(annotation);
      annotation = iterator.next().value;
      if (!annotation) break;
    }

    node.children().forEach(visit);

    if (matching.length > 0)
      output = processor(node, matching);

    return output || node;
  }

  return visit(ast);
}

function addToParentScope(node, newNode) {
  let { parent } = node;
  switch (parent.type) {
    case 'Script':
    case 'Module':
    case 'Block':
    case 'FunctionBody':
      this.statements.push(newNode);
      break;
    default:
      addToParentScope(parent, newNode);
  }
}

function createAnnotationGetter(input, list) {
  let calls = list.map(annotation => {
    return input.slice(annotation.start, annotation.end)
  }).join(',');

  return parse(`(function() { return [${calls}] })`)
    .ast
    .statements[0]
    .expression
    .expression;
}

function addAnnotationGetters({ ast, annotations, input }) {
  function process(node, list) {
    switch (node.type) {
      case 'ClassDeclaration':
        console.log(print(createAnnotationGetter(input, list)));
        break;
      case 'ClassExpression':
        break;
      case 'FunctionDeclaration':
        break;
      case 'FunctionExpression':
        break;
      case 'ExportDeclaration':
        node.declaration = process(node, list);
        break;
      case 'ExportDefault':
        node.binding = process(node, list);
        break;
    }
  }

  return processAnnotations(ast, annotations, process);
}

let result = parse(`
  @customElement('foo-bar')
  class C extends HTMLElement {}
`, {
  addParentLinks: true,
});

addAnnotationGetters(result);
