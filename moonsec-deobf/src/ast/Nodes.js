'use strict';

const { Node, Expression, Statement, Literal } = require('./Node.js');
const { NodeList } = require('./NodeList.js');

class Name extends Expression {
    constructor(value) {
        super();
        this.value = value;
    }

    isVariable() {
        return true;
    }

    childNodes() {
        return [];
    }

    clone() {
        return new Name(this.value);
    }
}

class ElementAccess extends Expression {
    constructor(table, key) {
        super();
        this.table = table;
        this.key = key;
    }

    isVariable() {
        return true;
    }

    childNodes() {
        return [this.table, this.key];
    }

    clone() {
        return new ElementAccess(this.table.clone(), this.key.clone());
    }
}

class MemberAccess extends Expression {
    constructor(table, key) {
        super();
        this.table = table;
        this.key = key;
    }

    isVariable() {
        return true;
    }

    childNodes() {
        return [this.table, this.key];
    }

    clone() {
        return new MemberAccess(this.table.clone(), this.key.clone());
    }
}

class BinaryExpression extends Expression {
    constructor(operator, left, right) {
        super();
        this.operator = operator;
        this.left = left;
        this.right = right;
    }

    childNodes() {
        return [this.left, this.right];
    }

    clone() {
        return new BinaryExpression(this.operator, this.left.clone(), this.right.clone());
    }
}

class UnaryExpression extends Expression {
    constructor(operator, operand) {
        super();
        this.operator = operator;
        this.operand = operand;
    }

    childNodes() {
        return [this.operand];
    }

    clone() {
        return new UnaryExpression(this.operator, this.operand.clone());
    }
}

class Call extends Expression {
    constructor(fn, arguments_) {
        super();
        this.function = fn;
        this.arguments = arguments_ || new NodeList();
    }

    childNodes() {
        return [this.function, ...this.arguments];
    }

    clone() {
        return new Call(this.function.clone(), NodeList.of(...this.arguments.map(a => a.clone())));
    }
}

class MethodCall extends Expression {
    constructor(fn, methodName, arguments_) {
        super();
        this.function = fn;
        this.methodName = methodName;
        this.arguments = arguments_ || new NodeList();
    }

    childNodes() {
        return [this.function, this.methodName, ...this.arguments];
    }

    clone() {
        return new MethodCall(
            this.function.clone(),
            this.methodName.clone(),
            NodeList.of(...this.arguments.map(a => a.clone()))
        );
    }
}

class Table extends Expression {
    constructor(entries) {
        super();
        this.entries = entries || new NodeList();
    }

    childNodes() {
        return [...this.entries];
    }

    clone() {
        return new Table(NodeList.of(...this.entries.map(e => e.clone())));
    }
}

Table.Entry = class Entry extends Node {
    constructor(key, value) {
        super();
        this.key = key || null;
        this.value = value;
    }

    childNodes() {
        return this.key !== null ? [this.key, this.value] : [this.value];
    }

    clone() {
        return new Table.Entry(this.key !== null ? this.key.clone() : null, this.value.clone());
    }
};

class AnonymousFunction extends Expression {
    constructor(parameters, body) {
        super();
        this.parameters = parameters;
        this.body = body;
    }

    childNodes() {
        return [this.parameters, this.body];
    }

    clone() {
        return new AnonymousFunction(this.parameters.clone(), this.body.clone());
    }
}

class VarArg extends Expression {
    childNodes() {
        return [];
    }

    clone() {
        return new VarArg();
    }
}

class ExpressionStatement extends Statement {
    constructor(expression) {
        super();
        this.expression = expression;
    }

    childNodes() {
        return [this.expression];
    }

    clone() {
        return new ExpressionStatement(this.expression.clone());
    }
}

class While extends Statement {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }

    childNodes() {
        return [this.condition, this.body];
    }

    clone() {
        return new While(this.condition.clone(), this.body.clone());
    }
}

class LocalDeclare extends Statement {
    constructor(names, values) {
        super();
        this.names = names || new NodeList();
        this.values = values || new NodeList();
    }

    childNodes() {
        return [...this.names, ...this.values];
    }

    clone() {
        return new LocalDeclare(
            NodeList.of(...this.names.map(n => n.clone())),
            NodeList.of(...this.values.map(v => v.clone()))
        );
    }
}

class Assign extends Statement {
    constructor(variables, values) {
        super();
        this.variables = variables || new NodeList();
        this.values = values || new NodeList();
    }

    childNodes() {
        return [...this.variables, ...this.values];
    }

    clone() {
        return new Assign(
            NodeList.of(...this.variables.map(v => v.clone())),
            NodeList.of(...this.values.map(v => v.clone()))
        );
    }
}

class GenericFor extends Statement {
    constructor(names, expressions, body) {
        super();
        this.names = names;
        this.expressions = expressions;
        this.body = body;
    }

    childNodes() {
        return [...this.names, ...this.expressions, this.body];
    }

    clone() {
        return new GenericFor(
            NodeList.of(...this.names.map(n => n.clone())),
            NodeList.of(...this.expressions.map(e => e.clone())),
            this.body.clone()
        );
    }
}

class NumericFor extends Statement {
    constructor(iteratorName, initialValue, finalValue, step, body) {
        super();
        this.iteratorName = iteratorName;
        this.initialValue = initialValue;
        this.finalValue = finalValue;
        this.step = step || null;
        this.body = body;
    }

    childNodes() {
        return [this.iteratorName, this.initialValue, this.finalValue, ...(this.step ? [this.step] : []), this.body];
    }

    clone() {
        return new NumericFor(
            this.iteratorName.clone(),
            this.initialValue.clone(),
            this.finalValue.clone(),
            this.step ? this.step.clone() : null,
            this.body.clone()
        );
    }
}

class If extends Statement {
    constructor(ifClause, elseIfClauses, elseBody) {
        super();
        this.ifClause = ifClause;
        this.elseIfClauses = elseIfClauses || new NodeList();
        this.elseBody = elseBody || null;
    }

    childNodes() {
        return this.elseBody !== null
            ? [this.ifClause, ...this.elseIfClauses, this.elseBody]
            : [this.ifClause, ...this.elseIfClauses];
    }

    clone() {
        return new If(
            this.ifClause.clone(),
            NodeList.of(...this.elseIfClauses.map(c => c.clone())),
            this.elseBody !== null ? this.elseBody.clone() : null
        );
    }
}

If.Clause = class Clause extends Node {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }

    childNodes() {
        return [this.condition, this.body];
    }

    clone() {
        return new If.Clause(this.condition.clone(), this.body.clone());
    }
};

class LocalFunction extends Statement {
    constructor(name, parameters, body) {
        super();
        this.name = name;
        this.parameters = parameters;
        this.body = body;
    }

    childNodes() {
        return [this.name, this.parameters, this.body];
    }

    clone() {
        return new LocalFunction(this.name.clone(), this.parameters.clone(), this.body.clone());
    }
}

class Function extends Statement {
    constructor(name, parameters, body) {
        super();
        this.name = name;
        this.parameters = parameters;
        this.body = body;
    }

    childNodes() {
        return [this.name, this.parameters, this.body];
    }

    clone() {
        return new Function(this.name.clone(), this.parameters.clone(), this.body.clone());
    }
}

class Break extends Statement {
    childNodes() {
        return [];
    }

    clone() {
        return new Break();
    }
}

class Do extends Statement {
    constructor(body) {
        super();
        this.body = body;
    }

    childNodes() {
        return [this.body];
    }

    clone() {
        return new Do(this.body.clone());
    }
}

class Repeat extends Statement {
    constructor(body, condition) {
        super();
        this.body = body;
        this.condition = condition;
    }

    childNodes() {
        return [this.body, this.condition];
    }

    clone() {
        return new Repeat(this.body.clone(), this.condition.clone());
    }
}

class Return extends Statement {
    constructor(values) {
        super();
        this.values = values || new NodeList();
    }

    childNodes() {
        return [...this.values];
    }

    clone() {
        return new Return(NodeList.of(...this.values.map(v => v.clone())));
    }
}

class Goto extends Statement {
    constructor(name) {
        super();
        this.name = name;
    }

    childNodes() {
        return [this.name];
    }

    clone() {
        return new Goto(this.name.clone());
    }
}

class Label extends Statement {
    constructor(name) {
        super();
        this.name = name;
    }

    childNodes() {
        return [this.name];
    }

    clone() {
        return new Label(this.name.clone());
    }
}

class StringLiteral extends Literal {
    constructor(value) {
        super();
        this.value = value;
    }

    childNodes() {
        return [];
    }

    clone() {
        return new StringLiteral(this.value);
    }
}

class NumberLiteral extends Literal {
    constructor(value) {
        super();
        this.value = value;
    }

    childNodes() {
        return [];
    }

    clone() {
        return new NumberLiteral(this.value);
    }
}

class BooleanLiteral extends Literal {
    constructor(value) {
        super();
        this.value = value;
    }

    childNodes() {
        return [];
    }

    clone() {
        return new BooleanLiteral(this.value);
    }
}

class Nil extends Literal {
    childNodes() {
        return [];
    }

    clone() {
        return new Nil();
    }
}

class ParameterList extends Node {
    constructor(names, isVarArg) {
        super();
        this.names = names || new NodeList();
        this.isVarArg = isVarArg || false;
    }

    childNodes() {
        return [...this.names];
    }

    clone() {
        return new ParameterList(NodeList.of(...this.names.map(n => n.clone())), this.isVarArg);
    }
}

class Block extends Node {
    constructor(statements) {
        super();
        this.statements = statements || new NodeList();
    }

    static fromString(code) {
        return require('../parser/luaparse-adapter.js').parseBlock(code);
    }

    childNodes() {
        return [...this.statements];
    }

    clone() {
        return new Block(NodeList.of(...this.statements.map(s => s.clone())));
    }
}

module.exports = {
    Name,
    ElementAccess,
    MemberAccess,
    BinaryExpression,
    UnaryExpression,
    Call,
    MethodCall,
    Table,
    AnonymousFunction,
    VarArg,
    ExpressionStatement,
    While,
    LocalDeclare,
    Assign,
    GenericFor,
    NumericFor,
    If,
    LocalFunction,
    Function,
    Break,
    Do,
    Repeat,
    Return,
    Goto,
    Label,
    StringLiteral,
    NumberLiteral,
    BooleanLiteral,
    Nil,
    Literal,
    ParameterList,
    Block
};
