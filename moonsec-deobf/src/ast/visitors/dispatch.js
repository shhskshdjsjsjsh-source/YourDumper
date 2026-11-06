'use strict';

const N = require('../../ast/Nodes.js');
const { SymbolTableBuilder } = require('../../semantic/symbol-table.js');

function visitList(dispatcher, list) {
    for (let i = 0; i < list.length; i++) {
        const oldNode = list[i];
        const newNode = dispatcher.visit(oldNode);

        if (oldNode !== newNode) {
            dispatcher.changed = true;
            list[i] = newNode;
        }
    }
}

class PreOrderRewriteDispatch {
    constructor(rewriter) {
        this.rewriter = rewriter;
        this.changed = false;
    }

    rewrite(node, symbols, fixedPoint) {
        do {
            if (symbols) {
                this.rewriter.symbolTable = SymbolTableBuilder.build(node);
            }

            this.changed = false;
            this.visit(node);
        } while (this.changed && fixedPoint);
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
        const newNode = this.rewriter.visitName(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        return node;
    }

    visitElementAccess(node) {
        const newNode = this.rewriter.visitElementAccess(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.table = this.visit(node.table);
        node.key = this.visit(node.key);
        return node;
    }

    visitMemberAccess(node) {
        const newNode = this.rewriter.visitMemberAccess(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.table = this.visit(node.table);
        node.key = this.visit(node.key);
        return node;
    }

    visitBinaryExpression(node) {
        const newNode = this.rewriter.visitBinaryExpression(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.left = this.visit(node.left);
        node.right = this.visit(node.right);
        return node;
    }

    visitUnaryExpression(node) {
        const newNode = this.rewriter.visitUnaryExpression(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.operand = this.visit(node.operand);
        return node;
    }

    visitCall(node) {
        const newNode = this.rewriter.visitCall(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.function = this.visit(node.function);
        visitList(this, node.arguments);
        return node;
    }

    visitMethodCall(node) {
        const newNode = this.rewriter.visitMethodCall(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.function = this.visit(node.function);
        node.methodName = this.visit(node.methodName);
        visitList(this, node.arguments);
        return node;
    }

    visitTable(node) {
        const newNode = this.rewriter.visitTable(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.entries);
        return node;
    }

    visitTableEntry(node) {
        const newNode = this.rewriter.visitTableEntry(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        if (node.key !== null) {
            node.key = this.visit(node.key);
        }
        node.value = this.visit(node.value);
        return node;
    }

    visitAnonymousFunction(node) {
        const newNode = this.rewriter.visitAnonymousFunction(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.parameters = this.visit(node.parameters);
        node.body = this.visit(node.body);
        return node;
    }

    visitVarArg(node) {
        const newNode = this.rewriter.visitVarArg(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitExpressionStatement(node) {
        const newNode = this.rewriter.visitExpressionStatement(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.expression = this.visit(node.expression);
        return node;
    }

    visitWhile(node) {
        const newNode = this.rewriter.visitWhile(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.condition = this.visit(node.condition);
        node.body = this.visit(node.body);
        return node;
    }

    visitLocalDeclare(node) {
        const newNode = this.rewriter.visitLocalDeclare(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.names);
        visitList(this, node.values);
        return node;
    }

    visitAssign(node) {
        const newNode = this.rewriter.visitAssign(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.variables);
        visitList(this, node.values);
        return node;
    }

    visitGenericFor(node) {
        const newNode = this.rewriter.visitGenericFor(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.names);
        visitList(this, node.expressions);
        node.body = this.visit(node.body);
        return node;
    }

    visitNumericFor(node) {
        const newNode = this.rewriter.visitNumericFor(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.iteratorName = this.visit(node.iteratorName);
        node.initialValue = this.visit(node.initialValue);
        node.finalValue = this.visit(node.finalValue);
        if (node.step !== null) {
            node.step = this.visit(node.step);
        }
        node.body = this.visit(node.body);
        return node;
    }

    visitIf(node) {
        const newNode = this.rewriter.visitIf(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.ifClause = this.visit(node.ifClause);
        visitList(this, node.elseIfClauses);
        if (node.elseBody !== null) {
            node.elseBody = this.visit(node.elseBody);
        }
        return node;
    }

    visitIfClause(node) {
        const newNode = this.rewriter.visitIfClause(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.condition = this.visit(node.condition);
        node.body = this.visit(node.body);
        return node;
    }

    visitLocalFunction(node) {
        const newNode = this.rewriter.visitLocalFunction(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.name = this.visit(node.name);
        node.parameters = this.visit(node.parameters);
        node.body = this.visit(node.body);
        return node;
    }

    visitFunction(node) {
        const newNode = this.rewriter.visitFunction(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.name = this.visit(node.name);
        node.parameters = this.visit(node.parameters);
        node.body = this.visit(node.body);
        return node;
    }

    visitBreak(node) {
        const newNode = this.rewriter.visitBreak(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        return node;
    }

    visitDo(node) {
        const newNode = this.rewriter.visitDo(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.body = this.visit(node.body);
        return node;
    }

    visitRepeat(node) {
        const newNode = this.rewriter.visitRepeat(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.body = this.visit(node.body);
        node.condition = this.visit(node.condition);
        return node;
    }

    visitReturn(node) {
        const newNode = this.rewriter.visitReturn(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.values);
        return node;
    }

    visitParameterList(node) {
        const newNode = this.rewriter.visitParameterList(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.names);
        return node;
    }

    visitStringLiteral(node) {
        const newNode = this.rewriter.visitStringLiteral(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        return node;
    }

    visitNumberLiteral(node) {
        const newNode = this.rewriter.visitNumberLiteral(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        return node;
    }

    visitBooleanLiteral(node) {
        const newNode = this.rewriter.visitBooleanLiteral(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        return node;
    }

    visitNil(node) {
        const newNode = this.rewriter.visitNil(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        return node;
    }

    visitBlock(node) {
        const newNode = this.rewriter.visitBlock(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        visitList(this, node.statements);
        return node;
    }

    visitGoto(node) {
        const newNode = this.rewriter.visitGoto(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.name = this.visit(node.name);
        return node;
    }

    visitLabel(node) {
        const newNode = this.rewriter.visitLabel(node);
        if (newNode !== node) {
            this.changed = true;
            return newNode;
        }
        node.name = this.visit(node.name);
        return node;
    }
}

class PostOrderRewriteDispatch {
    constructor(rewriter) {
        this.rewriter = rewriter;
        this.changed = false;
    }

    rewrite(node, symbols, fixedPoint) {
        do {
            if (symbols) {
                this.rewriter.symbolTable = SymbolTableBuilder.build(node);
            }

            this.changed = false;
            this.visit(node);
        } while (this.changed && fixedPoint);
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
        const newNode = this.rewriter.visitName(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitElementAccess(node) {
        node.table = this.visit(node.table);
        node.key = this.visit(node.key);
        const newNode = this.rewriter.visitElementAccess(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitMemberAccess(node) {
        node.table = this.visit(node.table);
        node.key = this.visit(node.key);
        const newNode = this.rewriter.visitMemberAccess(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitBinaryExpression(node) {
        node.left = this.visit(node.left);
        node.right = this.visit(node.right);
        const newNode = this.rewriter.visitBinaryExpression(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitUnaryExpression(node) {
        node.operand = this.visit(node.operand);
        const newNode = this.rewriter.visitUnaryExpression(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitCall(node) {
        node.function = this.visit(node.function);
        visitList(this, node.arguments);
        const newNode = this.rewriter.visitCall(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitMethodCall(node) {
        node.function = this.visit(node.function);
        node.methodName = this.visit(node.methodName);
        visitList(this, node.arguments);
        const newNode = this.rewriter.visitMethodCall(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitTable(node) {
        visitList(this, node.entries);
        const newNode = this.rewriter.visitTable(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitTableEntry(node) {
        if (node.key !== null) {
            node.key = this.visit(node.key);
        }
        node.value = this.visit(node.value);
        const newNode = this.rewriter.visitTableEntry(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitAnonymousFunction(node) {
        node.parameters = this.visit(node.parameters);
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitAnonymousFunction(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitVarArg(node) {
        const newNode = this.rewriter.visitVarArg(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitExpressionStatement(node) {
        node.expression = this.visit(node.expression);
        const newNode = this.rewriter.visitExpressionStatement(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitWhile(node) {
        node.condition = this.visit(node.condition);
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitWhile(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitLocalDeclare(node) {
        visitList(this, node.names);
        visitList(this, node.values);
        const newNode = this.rewriter.visitLocalDeclare(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitAssign(node) {
        visitList(this, node.variables);
        visitList(this, node.values);
        const newNode = this.rewriter.visitAssign(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitGenericFor(node) {
        visitList(this, node.names);
        visitList(this, node.expressions);
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitGenericFor(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitNumericFor(node) {
        node.iteratorName = this.visit(node.iteratorName);
        node.initialValue = this.visit(node.initialValue);
        node.finalValue = this.visit(node.finalValue);
        if (node.step !== null) {
            node.step = this.visit(node.step);
        }
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitNumericFor(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitIf(node) {
        node.ifClause = this.visit(node.ifClause);
        visitList(this, node.elseIfClauses);
        if (node.elseBody !== null) {
            node.elseBody = this.visit(node.elseBody);
        }
        const newNode = this.rewriter.visitIf(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitIfClause(node) {
        node.condition = this.visit(node.condition);
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitIfClause(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitLocalFunction(node) {
        node.name = this.visit(node.name);
        node.parameters = this.visit(node.parameters);
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitLocalFunction(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitFunction(node) {
        node.name = this.visit(node.name);
        node.parameters = this.visit(node.parameters);
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitFunction(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitBreak(node) {
        const newNode = this.rewriter.visitBreak(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitDo(node) {
        node.body = this.visit(node.body);
        const newNode = this.rewriter.visitDo(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitRepeat(node) {
        node.body = this.visit(node.body);
        node.condition = this.visit(node.condition);
        const newNode = this.rewriter.visitRepeat(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitReturn(node) {
        visitList(this, node.values);
        const newNode = this.rewriter.visitReturn(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitParameterList(node) {
        visitList(this, node.names);
        const newNode = this.rewriter.visitParameterList(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitStringLiteral(node) {
        const newNode = this.rewriter.visitStringLiteral(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitNumberLiteral(node) {
        const newNode = this.rewriter.visitNumberLiteral(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitBooleanLiteral(node) {
        const newNode = this.rewriter.visitBooleanLiteral(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitNil(node) {
        const newNode = this.rewriter.visitNil(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitBlock(node) {
        visitList(this, node.statements);
        const newNode = this.rewriter.visitBlock(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitGoto(node) {
        node.name = this.visit(node.name);
        const newNode = this.rewriter.visitGoto(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }

    visitLabel(node) {
        node.name = this.visit(node.name);
        const newNode = this.rewriter.visitLabel(node);
        if (newNode !== node) {
            this.changed = true;
        }
        return newNode;
    }
}

module.exports = { PreOrderRewriteDispatch, PostOrderRewriteDispatch };