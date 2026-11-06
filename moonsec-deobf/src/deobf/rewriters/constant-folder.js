'use strict';

const { AstRewriter } = require('../../ast/visitors/AstRewriter.js');
const { BinaryOperator, UnaryOperator } = require('../../ast/Operators.js');
const N = require('../../ast/Nodes.js');

class ConstantFolder extends AstRewriter {
    foldUnaryExpression(node) {
        if (this.canFoldTableLen(node)) {
            return this.foldTableLen(node);
        }

        if (this.canFoldNegation(node)) {
            return this.foldNegation(node);
        }

        return node;
    }

    foldTableLen(node) {
        return new N.NumberLiteral(node.operand.entries.length);
    }

    canFoldTableLen(node) {
        return node.operator === UnaryOperator.Length
            && node.operand instanceof N.Table
            && node.operand.entries.every(entry => entry.key === null
                && entry.value instanceof N.Literal
                && !(entry.value instanceof N.Nil));
    }

    foldNegation(node) {
        return new N.NumberLiteral(-node.operand.value);
    }

    canFoldNegation(node) {
        return node.operator === UnaryOperator.Negate && node.operand instanceof N.NumberLiteral;
    }

    normalizeComparison(node) {
        if (!(node.left instanceof N.NumberLiteral) || node.right instanceof N.NumberLiteral) {
            return node;
        }

        switch (node.operator) {
            case BinaryOperator.Equals:
            case BinaryOperator.NotEquals:
                [node.left, node.right] = [node.right, node.left];
                break;
            case BinaryOperator.LessThan:
                node.operator = BinaryOperator.GreaterThan;
                [node.left, node.right] = [node.right, node.left];
                break;
            case BinaryOperator.GreaterThan:
                node.operator = BinaryOperator.LessThan;
                [node.left, node.right] = [node.right, node.left];
                break;
            case BinaryOperator.LessThanOrEquals:
                node.operator = BinaryOperator.GreaterThanOrEquals;
                [node.left, node.right] = [node.right, node.left];
                break;
            case BinaryOperator.GreaterThanOrEquals:
                node.operator = BinaryOperator.LessThanOrEquals;
                [node.left, node.right] = [node.right, node.left];
                break;
        }

        return node;
    }

    visitBinaryExpression(node) {
        return this.normalizeComparison(node);
    }

    visitUnaryExpression(node) {
        return this.foldUnaryExpression(node);
    }
}

module.exports = { ConstantFolder };