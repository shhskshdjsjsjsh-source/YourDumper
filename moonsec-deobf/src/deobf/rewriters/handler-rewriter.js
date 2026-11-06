'use strict';

const { AstRewriter } = require('../../ast/visitors/AstRewriter.js');
const { NodeList } = require('../../ast/NodeList.js');
const N = require('../../ast/Nodes.js');

class HandlerRewriter extends AstRewriter {
    visitCall(node) {
        const args = node.arguments;

        if (node.function instanceof N.Name && node.function.value === 'stk'
            && args.length === 2 && args[0] instanceof N.Name && args[1] instanceof N.Name) {
            const newArg1 = this.replaceWithElementAccess(args[0]);
            const newArg2 = this.replaceWithElementAccess(args[1]);

            if (args[0] !== newArg1 || args[1] !== newArg2) {
                return new N.Call(node.function, [newArg1, newArg2]);
            }
        }

        return node;
    }

    visitElementAccess(node) {
        const newTable = this.replaceWithName(node.table);
        const newKey = this.replaceWithName(node.key);

        if (node.table !== newTable || node.key !== newKey) {
            return new N.ElementAccess(newTable, newKey);
        }

        let newKey2 = this.replaceWithElementAccess(node.key);

        if (node.key !== newKey2) {
            return new N.ElementAccess(newTable, newKey2);
        }

        return node;
    }

    visitBlock(node) {
        const unused = node.statements.filter(stat =>
            stat instanceof N.LocalDeclare && this.shouldRemoveDeclaration(stat));

        if (unused.length > 0) {
            node.statements = node.statements.filter(stat => !unused.includes(stat));
            return new N.Block(node.statements);
        }

        return node;
    }

    visitAssign(node) {
        if (this.shouldLocalizeAssignment(node)) {
            const names = NodeList.of(...node.variables);
            return new N.LocalDeclare(names, node.values);
        }

        if (node.variables.length === 1 && node.variables[0] instanceof N.ElementAccess
            && node.values.length === 1 && node.values[0] instanceof N.Name) {
            const replacement = this.replaceWithElementAccess(node.values[0]);

            if (replacement !== node.values[0]) {
                return new N.Assign(node.variables, [replacement]);
            }
        }

        if (node.variables.length === 1 && node.variables[0] instanceof N.Name
            && node.values.length === 1 && node.values[0] instanceof N.Name) {
            const newValue = this.replaceWithBinaryExpression(node.values[0]);

            if (node.values[0] !== newValue) {
                return new N.Assign(node.variables, [newValue]);
            }
        }

        return node;
    }

    visitBinaryExpression(node) {
        const newLeft = this.replaceWithElementAccess(node.left);
        const newRight = this.replaceWithElementAccess(node.right);

        if (node.left !== newLeft || node.right !== newRight) {
            return new N.BinaryExpression(node.operator, newLeft, newRight);
        }

        const newLeft2 = this.replaceWithName(node.left);
        const newRight2 = this.replaceWithName(node.right);

        if (node.left !== newLeft2 || node.right !== newRight2) {
            return new N.BinaryExpression(node.operator, newLeft2, newRight2);
        }

        return node;
    }

    shouldRemoveDeclaration(node) {
        if (node.values.length === 0) {
            return true;
        }

        for (const name of node.names) {
            const info = this.getVariable(name.value);
            if (info !== undefined && info.readCount > 0) {
                return false;
            }
        }

        return true;
    }

    shouldLocalizeAssignment(node) {
        for (const variable of node.variables) {
            if (!(variable instanceof N.Name)) {
                return false;
            }

            const value = variable.value;

            if (!value.startsWith('_')) {
                return false;
            }

            const info = this.getVariable(value);

            if (info === undefined || info.declarationLocation !== node) {
                return false;
            }
        }

        return true;
    }

    replaceWithName(node) {
        if (!(node instanceof N.Name) || !node.value.startsWith('_')) {
            return node;
        }

        const info = this.getVariable(node.value);

        return info !== undefined && info.value instanceof N.Name
            ? info.value.clone()
            : node;
    }

    replaceWithElementAccess(node) {
        if (!(node instanceof N.Name) || !node.value.startsWith('_')) {
            return node;
        }

        const info = this.getVariable(node.value);

        return info !== undefined
            && info.value instanceof N.ElementAccess
            && info.value.table instanceof N.Name
            && info.value.key instanceof N.Name
            && info.readCount === 1
            ? info.value.clone()
            : node;
    }

    replaceWithBinaryExpression(node) {
        if (!(node instanceof N.Name) || !node.value.startsWith('_')) {
            return node;
        }

        const info = this.getVariable(node.value);

        return info !== undefined
            && info.value instanceof N.BinaryExpression
            && info.readCount === 1
            && info.assignmentCount === 0
            ? info.value.clone()
            : node;
    }
}

module.exports = { HandlerRewriter };