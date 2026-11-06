'use strict';

const { AstWalker } = require('../../ast/visitors/AstWalker.js');
const { BinaryOperator } = require('../../ast/Operators.js');
const N = require('../../ast/Nodes.js');

const ProtoStep = Object.freeze({
    Instructions: 'Instructions',
    Constants: 'Constants',
    Functions: 'Functions',
    NumParams: 'NumParams',
    StringConstant: 'StringConstant',
    NumberConstant: 'NumberConstant',
    BooleanConstant: 'BooleanConstant'
});

class Analyzer extends AstWalker {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.funcCounter = 0;
        this.symbols = null;
    }

    getVariable(name) {
        return this.symbolTable ? this.symbolTable.getVariable(name) : undefined;
    }

    walk(node, symbols = false) {
        if (symbols) {
            this.symbolTable = SymbolTableBuilder.build(node);
        }
        this.visit(node);
    }

    visitLocalFunction(node) {
        switch (this.funcCounter++) {
            case 8:
                this.getProtoFormat(node);
                break;
            case 10:
                this.identifyWrapProto(node);
                break;
            case 11:
                this.identifyWrapper(node);
                break;
        }

        super.visitLocalFunction(node);
    }

    visitCall(node) {
        if (node.arguments.length === 2
            && node.arguments[0] instanceof N.Name
            && node.arguments[1] instanceof N.StringLiteral) {
            this.ctx.bytecodeString = node.arguments[1].value.replace(/"/g, '');
        }

        super.visitCall(node);
    }

    visitBinaryExpression(node) {
        if (node.operator === BinaryOperator.Add && node.right instanceof N.Call) {
            this.ctx.keyExpressions.push(node);
            return;
        }

        super.visitBinaryExpression(node);
    }

    visitLocalDeclare(node) {
        if (node.names.length === 1
            && node.names[0] instanceof N.Name
            && node.values.length === 1) {
            const info = this.getVariable(node.names[0].value);

            if (info === undefined || info.assignmentCount !== 0) {
                return;
            }

            const expression = node.values[0];

            if (expression instanceof N.NumberLiteral) {
                switch (Math.trunc(expression.value)) {
                    case 1:
                        this.identify(node.names[0].value, 'OP_ENUM');
                        break;
                    case 2:
                        this.identify(node.names[0].value, 'OP_A');
                        break;
                    case 3:
                        this.identify(node.names[0].value, 'OP_B');
                        break;
                    case 4:
                        this.identify(node.names[0].value, 'OP_C');
                        break;
                }
            } else if (expression instanceof N.BinaryExpression
                && expression.left instanceof N.Name
                && expression.left.value === 'unpack') {
                this.identify(node.names[0].value, 'unpack');
            }
        }

        super.visitLocalDeclare(node);
    }

    getProtoFormat(node) {
        for (const stat of node.body.statements) {
            if (stat instanceof N.Assign) {
                this.ctx.protoFormat.push(ProtoStep.NumParams);
            } else if (stat instanceof N.NumericFor) {
                switch (stat.body.statements.length) {
                    case 1:
                        this.ctx.protoFormat.push(ProtoStep.Functions);
                        break;
                    case 2:
                        this.ctx.protoFormat.push(ProtoStep.Instructions);
                        break;
                    case 4:
                        this.getConstantFormat(stat);
                        this.ctx.protoFormat.push(ProtoStep.Constants);
                        break;
                }
            }
        }
    }

    getConstantFormat(node) {
        const values = node.body
            .descendantNodes()
            .filter(it => it instanceof N.BinaryExpression && it.operator === BinaryOperator.Equals)
            .map(it => it.right)
            .map(it => Math.trunc(it.value) & 0xff);

        this.ctx.constantFormat[values[0]] = ProtoStep.BooleanConstant;
        this.ctx.constantFormat[values[1]] = ProtoStep.NumberConstant;
        this.ctx.constantFormat[values[2]] = ProtoStep.StringConstant;
    }

    identifyWrapProto(node) {
        const names = node.parameters.names;

        this.identify(node.name.value, 'wrap_proto');
        this.identify(names[0].value, 'proto');
        this.identify(names[1].value, 'upv');
        this.identify(names[2].value, 'env');
    }

    identifyWrapper(node) {
        const names = node.body
            .childNodes()
            .filter(it => it instanceof N.LocalDeclare)
            .flatMap(decl => decl.names);

        this.identify(names[0].value, 'insts');
        this.identify(names[1].value, 'protos');
        this.identify(names[2].value, 'params');
        this.identify(names[4].value, '_R');
        this.identify(names[5].value, 'pc');
        this.identify(names[6].value, 'top');
        this.identify(names[7].value, 'vararg');
        this.identify(names[8].value, 'args');
        this.identify(names[9].value, 'pcount');
        this.identify(names[10].value, 'lupv');
        this.identify(names[11].value, 'stk');
        this.identify(names[13].value, 'varargz');
        this.identify(names[14].value, 'inst');
        this.identify(names[15].value, 'enum');

        this.ctx.wrapper = node;
        this.ctx.vmTree = node.descendantNodes().find(n =>
            n instanceof N.If
            && n.ifClause.condition instanceof N.BinaryExpression
            && n.ifClause.condition.left instanceof N.Name
            && n.ifClause.condition.left.value === names[15].value);
    }

    identify(name, newName) {
        this.ctx.identifiedNames[name] = newName;
    }
}

const { SymbolTableBuilder } = require('../../semantic/symbol-table.js');

module.exports = { Analyzer, ProtoStep };