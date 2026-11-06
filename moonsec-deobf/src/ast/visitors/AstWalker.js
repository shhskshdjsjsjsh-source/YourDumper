'use strict';

const { SymbolTableBuilder } = require('../../semantic/symbol-table.js');
const N = require('../../ast/Nodes.js');

class AstWalker {
    constructor() {
        this.symbolTable = null;
    }

    walk(node, symbols = false) {
        if (symbols) {
            this.symbolTable = SymbolTableBuilder.build(node);
        }
        this.visit(node);
    }

    getVariable(name) {
        return this.symbolTable ? this.symbolTable.getVariable(name) : undefined;
    }

    visitList(list) {
        for (const node of list) {
            this.visit(node);
        }
    }

    visit(node) {
        if (node === null || node === undefined) {
            return;
        }

        switch (node.constructor) {
            case N.Name:
                return this.visitName(node);
            case N.ElementAccess:
                return this.visitElementAccess(node);
            case N.MemberAccess:
                return this.visitMemberAccess(node);
            case N.BinaryExpression:
                return this.visitBinaryExpression(node);
            case N.UnaryExpression:
                return this.visitUnaryExpression(node);
            case N.Call:
                return this.visitCall(node);
            case N.MethodCall:
                return this.visitMethodCall(node);
            case N.Table:
                return this.visitTable(node);
            case N.Table.Entry:
                return this.visitTableEntry(node);
            case N.AnonymousFunction:
                return this.visitAnonymousFunction(node);
            case N.VarArg:
                return this.visitVarArg(node);
            case N.ExpressionStatement:
                return this.visitExpressionStatement(node);
            case N.While:
                return this.visitWhile(node);
            case N.LocalDeclare:
                return this.visitLocalDeclare(node);
            case N.Assign:
                return this.visitAssign(node);
            case N.GenericFor:
                return this.visitGenericFor(node);
            case N.NumericFor:
                return this.visitNumericFor(node);
            case N.If:
                return this.visitIf(node);
            case N.If.Clause:
                return this.visitIfClause(node);
            case N.LocalFunction:
                return this.visitLocalFunction(node);
            case N.Function:
                return this.visitFunction(node);
            case N.Break:
                return this.visitBreak(node);
            case N.Do:
                return this.visitDo(node);
            case N.Repeat:
                return this.visitRepeat(node);
            case N.Return:
                return this.visitReturn(node);
            case N.ParameterList:
                return this.visitParameterList(node);
            case N.StringLiteral:
                return this.visitStringLiteral(node);
            case N.NumberLiteral:
                return this.visitNumberLiteral(node);
            case N.BooleanLiteral:
                return this.visitBooleanLiteral(node);
            case N.Nil:
                return this.visitNil(node);
            case N.Goto:
                return this.visitGoto(node);
            case N.Label:
                return this.visitLabel(node);
            case N.Block:
                return this.visitBlock(node);
            default:
                throw new Error(`Unhandled node type ${node.constructor.name}`);
        }
    }

    visitName(node) {}
    visitElementAccess(node) {
        this.visit(node.table);
        this.visit(node.key);
    }
    visitMemberAccess(node) {
        this.visit(node.table);
        this.visit(node.key);
    }
    visitBinaryExpression(node) {
        this.visit(node.left);
        this.visit(node.right);
    }
    visitUnaryExpression(node) {
        this.visit(node.operand);
    }
    visitCall(node) {
        this.visit(node.function);
        this.visitList(node.arguments);
    }
    visitMethodCall(node) {
        this.visit(node.function);
        this.visit(node.methodName);
        this.visitList(node.arguments);
    }
    visitTable(node) {
        this.visitList(node.entries);
    }
    visitTableEntry(node) {
        if (node.key !== null) {
            this.visit(node.key);
        }
        this.visit(node.value);
    }
    visitAnonymousFunction(node) {
        this.visit(node.parameters);
        this.visit(node.body);
    }
    visitVarArg(node) {}
    visitExpressionStatement(node) {
        this.visit(node.expression);
    }
    visitWhile(node) {
        this.visit(node.condition);
        this.visit(node.body);
    }
    visitLocalDeclare(node) {
        this.visitList(node.names);
        this.visitList(node.values);
    }
    visitAssign(node) {
        this.visitList(node.variables);
        this.visitList(node.values);
    }
    visitGenericFor(node) {
        this.visitList(node.names);
        this.visitList(node.expressions);
        this.visit(node.body);
    }
    visitNumericFor(node) {
        this.visit(node.iteratorName);
        this.visit(node.initialValue);
        this.visit(node.finalValue);
        if (node.step !== null) {
            this.visit(node.step);
        }
        this.visit(node.body);
    }
    visitIf(node) {
        this.visit(node.ifClause);
        this.visitList(node.elseIfClauses);
        if (node.elseBody !== null) {
            this.visit(node.elseBody);
        }
    }
    visitIfClause(node) {
        this.visit(node.condition);
        this.visit(node.body);
    }
    visitLocalFunction(node) {
        this.visit(node.name);
        this.visit(node.parameters);
        this.visit(node.body);
    }
    visitFunction(node) {
        this.visit(node.name);
        this.visit(node.parameters);
        this.visit(node.body);
    }
    visitBreak(node) {}
    visitDo(node) {
        this.visit(node.body);
    }
    visitRepeat(node) {
        this.visit(node.body);
        this.visit(node.condition);
    }
    visitReturn(node) {
        this.visitList(node.values);
    }
    visitParameterList(node) {
        this.visitList(node.names);
    }
    visitStringLiteral(node) {}
    visitNumberLiteral(node) {}
    visitBooleanLiteral(node) {}
    visitNil(node) {}
    visitBlock(node) {
        this.visitList(node.statements);
    }
    visitGoto(node) {
        this.visit(node.name);
    }
    visitLabel(node) {
        this.visit(node.name);
    }
}

module.exports = { AstWalker };