'use strict';

const { BinaryOperator } = require('../../ast/Operators.js');
const N = require('../../ast/Nodes.js');

function isEnumComparison(node) {
    return node instanceof N.BinaryExpression
        && node.left instanceof N.Name
        && node.left.value === 'enum';
}

function isInstAssign(node) {
    return node instanceof N.Assign
        && node.variables.length === 1
        && node.variables[0] instanceof N.Name
        && node.variables[0].value === 'inst'
        && node.values.length === 1
        && node.values[0] instanceof N.ElementAccess
        && node.values[0].table instanceof N.Name
        && node.values[0].table.value === 'insts';
}

function isPcIncrement(node) {
    return node instanceof N.Assign
        && node.variables.length === 1
        && node.variables[0] instanceof N.Name
        && node.variables[0].value === 'pc'
        && node.values.length === 1
        && node.values[0] instanceof N.BinaryExpression
        && node.values[0].operator === BinaryOperator.Add
        && (node.values[0].left instanceof N.Name && node.values[0].left.value === 'pc'
            || node.values[0].left instanceof N.NumberLiteral)
        && (node.values[0].right instanceof N.Name && node.values[0].right.value === 'pc'
            || node.values[0].right instanceof N.NumberLiteral);
}

module.exports = { isEnumComparison, isInstAssign, isPcIncrement };