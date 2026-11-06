'use strict';

const { AstRewriter } = require('../../ast/visitors/AstRewriter.js');
const N = require('../../ast/Nodes.js');
const { TreeSolver } = require('../utils/tree-solver.js');

class ControlFlowSolver extends AstRewriter {
    visitRepeat(node) {
        return node.condition instanceof N.BooleanLiteral && node.condition.value === true
            ? this.createReplacement(node.body)
            : node;
    }

    visitNumericFor(node) {
        const statements = node.body.statements;

        if (statements.length === 0) {
            return node;
        }

        const firstIsIfEndingInBreakOrDo = statements[0] instanceof N.If
            && statements[0].ifClause.body.statements.length > 0
            && this.isBreakOrDo(statements[0].ifClause.body.statements[statements[0].ifClause.body.statements.length - 1]);

        const lastIsBreakOrDo = this.isBreakOrDo(statements[statements.length - 1]);

        return firstIsIfEndingInBreakOrDo || lastIsBreakOrDo ? this.createReplacement(node.body) : node;
    }

    isBreakOrDo(stat) {
        return stat instanceof N.Break || stat instanceof N.Do;
    }

    visitIf(node) {
        const statements = node.ifClause.body.statements;

        if (statements.length >= 2
            && statements[0] instanceof N.If
            && statements[statements.length - 1] instanceof N.Label) {
            return this.createReplacement(node.ifClause.body);
        }

        return node;
    }

    visitBlock(node) {
        this.removeStateMachines(node);
        this.removeUnreachable(node);
        return node;
    }

    removeUnreachable(node) {
        const statements = node.statements;
        const idx = statements.findIndex(stat => stat instanceof N.Do
            || stat instanceof N.Return
            || stat instanceof N.Break);

        if (idx !== -1 && idx + 1 < statements.length) {
            statements.splice(idx + 1, statements.length - idx - 1);
        }
    }

    removeStateMachines(node) {
        const stats = node.statements;
        const stateMachines = stats.filter(stat => this.isStateMachine(stat));

        if (stateMachines.length === 0) {
            return;
        }

        for (const stateMachine of stateMachines) {
            const idx = stats.indexOf(stateMachine);
            const stateName = this.getStateName(stateMachine);
            const tree = this.getTree(stateMachine);

            const solved = Object.entries(new TreeSolver(tree, stateName).solve())
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .flatMap(([, block]) => block.statements);

            stats.splice(idx, 1);
            stats.splice(idx, 0, ...solved);
        }
    }

    createReplacement(node) {
        const innerIf = node.statements[0];
        const ifBody = new N.Block();
        const elseBody = new N.Block();

        ifBody.statements.push(...innerIf.ifClause.body.statements
            .filter(stat => !(stat instanceof N.Break || stat instanceof N.Label || stat instanceof N.Goto)));
        elseBody.statements.push(...node.statements
            .slice(1)
            .filter(stat => !(stat instanceof N.Break || stat instanceof N.Label || stat instanceof N.Goto)));

        const clause = new N.If.Clause(innerIf.ifClause.condition, ifBody);

        return new N.If(clause, [], elseBody);
    }

    isStateMachine(node) {
        if (node instanceof N.While
            && node.condition instanceof N.BinaryExpression
            && node.condition.right instanceof N.NumberLiteral
            && node.condition.right.value === -1) {
            return true;
        }

        return node instanceof N.NumericFor
            && node.initialValue instanceof N.NumberLiteral
            && node.finalValue instanceof N.NumberLiteral
            && node.body.statements.length === 1
            && node.body.statements[0] instanceof N.If;
    }

    getStateName(node) {
        if (node instanceof N.While) {
            return node.condition.left.value;
        }

        return node.iteratorName.value;
    }

    getTree(node) {
        if (node instanceof N.While) {
            return node.body.statements[0];
        }

        return node.body.statements[0];
    }
}

module.exports = { ControlFlowSolver };