export function registerMacros({ define, templates, AST }) {
  const internals = new WeakMap();

  define('internal', path => {
    let { node } = path;

    if (
      path.node.type !== 'MethodDefinition' &&
      path.node.type !== 'ClassField' ||
      path.node.name.type !== 'Identifier' ||
      path.parentNode.type !== 'ClassBody'
    ) {
      throw new SyntaxError('@internal can only be applied to methods and fields in classes');
    }

    let classNode = path.parent.parentNode;
    let classData = internals.get(classNode);

    if (!classData) {
      let ident = classNode.identifier;
      let mapName = '_data' + (ident ? ident.value : '');
      let mapIdent = path.uniqueIdentifier(mapName, {
        kind: 'const',
        initializer: new AST.NewExpression(new AST.Identifier('WeakMap'), []),
      });

      classData = { mapName, initialized: false, members: new Map() };
      internals.set(classNode, classData);
    }

    classData.members.set(path.node.name.value, path.node);
    path.removeNode();
  });

  define(rootPath => rootPath.visit(new class InternalVisitor {

    constructor() {
      this.scopes = [];
    }

    get topScope() {
      return this.scopes.length > 0 ? this.scopes[this.scopes.length - 1] : undefined;
    }

    lookup(name) {
      for (let i = this.scopes.length - 1; i >= 0; --i) {
        let scope = this.scopes[i];
        if (scope && scope.members.has(name)) {
          return scope.mapName;
        }
      }

      return null;
    }

    createInitializer() {
      let props = [];
      let scope = this.topScope;
      for (let [name, node] of scope.members) {
        if (node.type === 'ClassField') {
          props.push(new AST.PropertyDefinition(
            new AST.Identifier(name),
            node.initializer || new AST.Identifier('undefined')
          ));
        }
      }
      return new AST.CallExpression(
        new AST.MemberExpression(
          new AST.Identifier(scope.mapName),
          new AST.Identifier('set')
        ),
        [new AST.ThisExpression(), new AST.ObjectLiteral(props)]
      );
    }

    ClassExpression(path) {
      let { node } = path;
      this.scopes.push(internals.get(node));

      // TODO: Add mapData.set(this) to constructor

      path.visitChildren(this);

      if (!this.topScope.initialized) {
        let ctor = null;

        // Find the class constructor
        for (let elem of node.body.elements) {
          if (elem.type === 'MethodDefinition' && elem.kind === 'constructor') {
            ctor = elem;
            break;
          }
        }

        // Create a constructor if necessary
        if (!ctor) {
          let decl = node.base ?
            templates.statement`
              class C extends B {
                constructor(...args) { super(...args); ${ this.createInitializer() }; }
              }
            ` :
            templates.statement`
              class C {
                constructor() { ${ this.createInitializer() }; }
              }`;

          ctor = decl.body.elements[0];
          node.body.elements.push(ctor);
        }
      }

      this.scopes.pop();
    }

    CallExpression(path) {
      if (path.node.callee.type === 'SuperKeyword') {
        let scope = this.topScope;
        if (scope) {
          scope.initialized = true;
          path.replaceNode(templates.expression`
            (${ path.node }, ${ this.createInitializer() }, this)
          `);
        }
      }
    }

    ClassDeclaration(path) {
      this.ClassExpression(path);
    }

    MemberExpression(path) {
      let { node } = path;
      let { property } = node;
      if (property.type !== 'Identifier') {
        return;
      }
      let name = property.value;
      let mapName = this.lookup(name);
      if (mapName) {
        // TODO: Call
        path.replaceNode(templates.expression`${ mapName }.get(${ node.object }).${ name }`);
      }
    }

  }));
}
