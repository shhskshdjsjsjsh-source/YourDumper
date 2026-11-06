'use strict';

const BinaryOperator = Object.freeze({
    Add: 'Add',
    Sub: 'Sub',
    Mul: 'Mul',
    Div: 'Div',
    Mod: 'Mod',
    Pow: 'Pow',
    Equals: 'Equals',
    NotEquals: 'NotEquals',
    LessThan: 'LessThan',
    GreaterThan: 'GreaterThan',
    LessThanOrEquals: 'LessThanOrEquals',
    GreaterThanOrEquals: 'GreaterThanOrEquals',
    And: 'And',
    Or: 'Or',
    Concat: 'Concat'
});

const UnaryOperator = Object.freeze({
    Not: 'Not',
    Length: 'Length',
    Negate: 'Negate'
});

module.exports = { BinaryOperator, UnaryOperator };