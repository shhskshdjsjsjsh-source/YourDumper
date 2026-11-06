'use strict';

const { AstWalker } = require('./visitors/AstWalker.js');
const { BinaryOperator, UnaryOperator } = require('./Operators.js');
const { NodeList } = require('./NodeList.js');
const N = require('./Nodes.js');

class PrettyPrinter extends AstWalker {
    constructor() {
        super();
        this.builder = [];
    }

    static asString(node) {
        const visitor = new PrettyPrinter();
        visitor.visit(node);
        return visitor.builder.join('');
    }

    static print(node) {
        console.log(PrettyPrinter.asString(node));
    }

    indent() {
        const depth = this._depth || 0;
        for (let i = 0; i < depth * 4; i++) {
            this.builder.push(' ');
        }
    }

    visitName(node) {
        this.builder.push(node.value);
    }

    visitElementAccess(node) {
        this.visit(node.table);
        this.builder.push('[');
        this.visit(node.key);
        this.builder.push(']');
    }

    visitMemberAccess(node) {
        this.visit(node.table);
        this.builder.push(`.${node.key.value}`);
    }

    visitBinaryExpression(node) {
        this.builder.push('(');
        this.visit(node.left);
        this.builder.push(operatorToString(node.operator));
        this.visit(node.right);
        this.builder.push(')');
    }

    visitUnaryExpression(node) {
        this.builder.push(unaryToString(node.operator));
        this.visit(node.operand);
    }

    visitCall(node) {
        const needsPar = typeof node.function.isVariable !== 'function' || !node.function.isVariable();

        if (needsPar) {
            this.builder.push('(');
        }

        this.visit(node.function);

        if (needsPar) {
            this.builder.push(')');
        }

        this.builder.push('(');
        this.visitList(node.arguments);
        this.builder.push(')');
    }

    visitMethodCall(node) {
        const needsPar = typeof node.function.isVariable !== 'function' || !node.function.isVariable();

        if (needsPar) {
            this.builder.push('(');
        }

        this.visit(node.function);

        if (needsPar) {
            this.builder.push(')');
        }

        this.builder.push(`:${node.methodName.value}`);
        this.builder.push('(');
        this.visitList(node.arguments);
        this.builder.push(')');
    }

    visitTable(node) {
        const entries = node.entries;

        if (entries.length === 0) {
            this.builder.push('{}');
            return;
        }

        this.builder.push('{\n');
        this._depth = (this._depth || 0) + 1;

        for (let i = 0; i < entries.length; i++) {
            this.indent();
            this.visit(entries[i]);

            if (i + 1 < entries.length) {
                this.builder.push(', ');
            }

            this.builder.push('\n');
        }

        this._depth -= 1;
        this.indent();
        this.builder.push('}');
    }

    visitTableEntry(node) {
        const key = node.key;

        if (key !== null) {
            if (key instanceof N.Name) {
                this.builder.push(`${key.value} = `);
            } else {
                this.builder.push('[');
                this.visit(key);
                this.builder.push('] = ');
            }
        }

        this.visit(node.value);
    }

    visitAnonymousFunction(node) {
        this.builder.push('function');
        this.visit(node.parameters);
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitVarArg(node) {
        this.builder.push('...');
    }

    visitExpressionStatement(node) {
        this.visit(node.expression);
    }

    visitWhile(node) {
        this.builder.push('while ');
        this.visit(node.condition);
        this.builder.push(' do\n');
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitLocalDeclare(node) {
        this.builder.push('local ');
        this.visitList(node.names);

        if (node.values.length > 0) {
            this.builder.push(' = ');
            this.visitList(node.values);
        }
    }

    visitAssign(node) {
        this.visitList(node.variables);
        this.builder.push(' = ');
        this.visitList(node.values);
    }

    visitGenericFor(node) {
        this.builder.push('for ');
        this.visitList(node.names);
        this.builder.push(' in ');
        this.visitList(node.expressions);
        this.builder.push(' do\n');
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitNumericFor(node) {
        this.builder.push(`for ${node.iteratorName.value} = `);
        this.visit(node.initialValue);
        this.builder.push(', ');
        this.visit(node.finalValue);
        if (node.step !== null) {
            this.builder.push(', ');
            this.visit(node.step);
        }
        this.builder.push(' do\n');
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitIf(node) {
        this.builder.push('if ');
        this.visit(node.ifClause);
        for (const elseIf of node.elseIfClauses) {
            this.indent();
            this.builder.push('elseif ');
            this.visit(elseIf);
        }
        if (node.elseBody !== null) {
            this.indent();
            this.builder.push('else\n');
            this._depth = (this._depth || 0) + 1;
            this.visit(node.elseBody);
            this._depth -= 1;
            this.builder.push('\n');
        }
        this.indent();
        this.builder.push('end');
    }

    visitIfClause(node) {
        this.visit(node.condition);
        this.builder.push(' then\n');
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
    }

    visitLocalFunction(node) {
        this.builder.push(`local function ${node.name.value}`);
        this.visit(node.parameters);
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitFunction(node) {
        this.builder.push(`function ${node.name.value}`);
        this.visit(node.parameters);
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitBreak(node) {
        this.builder.push('break');
    }

    visitDo(node) {
        this.builder.push('do\n');
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('end');
    }

    visitRepeat(node) {
        this.builder.push('repeat\n');
        this._depth = (this._depth || 0) + 1;
        this.visit(node.body);
        this._depth -= 1;
        this.indent();
        this.builder.push('until ');
        this.visit(node.condition);
    }

    visitReturn(node) {
        this.builder.push('return');
        if (node.values.length > 0) {
            this.builder.push(' ');
            this.visitList(node.values);
        }
    }

    visitParameterList(node) {
        this.builder.push('(');
        this.visitList(node.names);
        if (node.isVarArg) {
            this.builder.push(node.names.length === 0 ? '...' : ', ...');
        }
        this.builder.push(')\n');
    }

    visitStringLiteral(node) {
        this.builder.push(node.value);
    }

    visitNumberLiteral(node) {
        this.builder.push(String(node.value));
    }

    visitBooleanLiteral(node) {
        this.builder.push(node.value ? 'true' : 'false');
    }

    visitNil(node) {
        this.builder.push('nil');
    }

    visitBlock(node) {
        for (const statement of node.statements) {
            this.indent();
            this.visit(statement);
            this.builder.push('\n');
        }
    }

    visitGoto(node) {
        this.builder.push(`goto ${node.name.value}`);
    }

    visitLabel(node) {
        this.builder.push(`::${node.name.value}::`);
    }

    visitList(list) {
        for (let i = 0; i < list.length; i++) {
            this.visit(list[i]);
            if (i + 1 < list.length) {
                this.builder.push(', ');
            }
        }
    }
}

function operatorToString(operator) {
    switch (operator) {
        case BinaryOperator.Add:
            return ' + ';
        case BinaryOperator.Sub:
            return ' - ';
        case BinaryOperator.Mul:
            return ' * ';
        case BinaryOperator.Div:
            return ' / ';
        case BinaryOperator.Mod:
            return ' % ';
        case BinaryOperator.Pow:
            return ' ^ ';
        case BinaryOperator.Equals:
            return ' == ';
        case BinaryOperator.NotEquals:
            return ' ~= ';
        case BinaryOperator.LessThan:
            return ' < ';
        case BinaryOperator.GreaterThan:
            return ' > ';
        case BinaryOperator.LessThanOrEquals:
            return ' <= ';
        case BinaryOperator.GreaterThanOrEquals:
            return ' >= ';
        case BinaryOperator.And:
            return ' and ';
        case BinaryOperator.Or:
            return ' or ';
        case BinaryOperator.Concat:
            return ' .. ';
        default:
            return ' ?? ';
    }
}

function unaryToString(operator) {
    switch (operator) {
        case UnaryOperator.Not:
            return 'not ';
        case UnaryOperator.Length:
            return '#';
        case UnaryOperator.Negate:
            return '-';
        default:
            return '??';
    }
}

module.exports = { PrettyPrinter };