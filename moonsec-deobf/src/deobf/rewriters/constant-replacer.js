'use strict';

const { AstRewriter } = require('../../ast/visitors/AstRewriter.js');
const N = require('../../ast/Nodes.js');

class ConstantReplacer extends AstRewriter {
    constructor(constants) {
        super();
        this.constants = constants;
    }

    visitMemberAccess(node) {
        if (Object.prototype.hasOwnProperty.call(this.constants, node.key.value)) {
            return this.createReplacement(this.constants[node.key.value]);
        }

        return node;
    }

    createReplacement(values) {
        if (/^-?\d+$/.test(values[0])) {
            return new N.NumberLiteral(parseInt(values[0], 10));
        }

        let name = new N.Name(values[0]);
        for (let i = 1; i < values.length; i++) {
            name = new N.MemberAccess(name, new N.Name(values[i]));
        }

        return name;
    }
}

module.exports = { ConstantReplacer };