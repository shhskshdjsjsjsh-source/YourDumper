'use strict';

class Node {
    childNodes() {
        return [];
    }

    descendantNodes() {
        const out = [];
        const stack = [];
        const children = this.childNodes();
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
        }

        while (stack.length > 0) {
            const child = stack.pop();
            out.push(child);

            const grandchildren = child.childNodes();
            for (let i = grandchildren.length - 1; i >= 0; i--) {
                stack.push(grandchildren[i]);
            }
        }

        return out;
    }

    clone() {
        throw new Error(`clone() not implemented for ${this.constructor.name}`);
    }

    accept(visitor) {
        return visitor.visit(this);
    }

    isExpression() {
        return false;
    }

    isStatement() {
        return false;
    }
}

class Expression extends Node {
    isExpression() {
        return true;
    }
}

class Statement extends Node {
    isStatement() {
        return true;
    }
}

class Literal extends Expression {}

module.exports = { Node, Expression, Statement, Literal };
