'use strict';

const { SymbolTableBuilder } = require('../../semantic/symbol-table.js');
const N = require('../../ast/Nodes.js');
const { PostOrderRewriteDispatch, PreOrderRewriteDispatch } = require('./dispatch.js');

class AstRewriter {
    constructor() {
        this.symbolTable = null;
    }

    rewrite(node, order, symbols = false, fixedPoint = false) {
        const dispatcher = order === 'PostOrder'
            ? new PostOrderRewriteDispatch(this)
            : new PreOrderRewriteDispatch(this);

        dispatcher.rewrite(node, symbols, fixedPoint);
    }

    getVariable(name) {
        return this.symbolTable ? this.symbolTable.getVariable(name) : undefined;
    }

    visit(node) {
        if (node === null || node === undefined) {
            return node;
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

    visitName(node) {
        return node;
    }
    visitElementAccess(node) {
        return node;
    }
    visitMemberAccess(node) {
        return node;
    }
    visitBinaryExpression(node) {
        return node;
    }
    visitUnaryExpression(node) {
        return node;
    }
    visitCall(node) {
        return node;
    }
    visitMethodCall(node) {
        return node;
    }
    visitTable(node) {
        return node;
    }
    visitTableEntry(node) {
        return node;
    }
    visitAnonymousFunction(node) {
        return node;
    }
    visitVarArg(node) {
        return node;
    }
    visitExpressionStatement(node) {
        return node;
    }
    visitWhile(node) {
        return node;
    }
    visitLocalDeclare(node) {
        return node;
    }
    visitAssign(node) {
        return node;
    }
    visitGenericFor(node) {
        return node;
    }
    visitNumericFor(node) {
        return node;
    }
    visitIf(node) {
        return node;
    }
    visitIfClause(node) {
        return node;
    }
    visitLocalFunction(node) {
        return node;
    }
    visitFunction(node) {
        return node;
    }
    visitBreak(node) {
        return node;
    }
    visitDo(node) {
        return node;
    }
    visitRepeat(node) {
        return node;
    }
    visitReturn(node) {
        return node;
    }
    visitParameterList(node) {
        return node;
    }
    visitStringLiteral(node) {
        return node;
    }
    visitNumberLiteral(node) {
        return node;
    }
    visitBooleanLiteral(node) {
        return node;
    }
    visitNil(node) {
        return node;
    }
    visitBlock(node) {
        return node;
    }
    visitGoto(node) {
        return node;
    }
    visitLabel(node) {
        return node;
    }
}

module.exports = { AstRewriter };