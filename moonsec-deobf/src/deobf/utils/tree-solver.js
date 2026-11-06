'use strict';

const { BinaryOperator } = require('../../ast/Operators.js');
const N = require('../../ast/Nodes.js');

const EdgeType = Object.freeze({ Then: 'Then', Else: 'Else' });

class Range {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }
}

class Vertex {
    constructor() {
        this.operator = undefined;
        this.constantValue = undefined;
        this.range = undefined;
        this.body = undefined;
    }
}

class TreeSolver {
    constructor(tree, stateName) {
        this.tree = tree;
        this.stateName = stateName;
        this.graph = new Map();
        this.inEdges = new Map();
        this.outEdges = new Map();
    }

    addVertex(vertex) {
        if (!this.graph.has(vertex)) {
            this.graph.set(vertex, true);
            this.inEdges.set(vertex, []);
            this.outEdges.set(vertex, []);
        }
    }

    addEdge(source, target, edgeType) {
        this.addVertex(source);
        this.addVertex(target);
        this.outEdges.get(source).push({ source, target, tag: edgeType });
        this.inEdges.get(target).push({ source, target, tag: edgeType });
    }

    solve() {
        this.addBranches(this.tree, null, EdgeType.Then);
        this.setRanges();
        this.reduceRanges();
        this.removeUnreachable();

        const result = {};

        for (const vertex of this.graph.keys()) {
            if (!this.isTerminal(vertex)) {
                continue;
            }

            const range = vertex.range;

            if (range.min !== range.max) {
                throw new Error('Failed to reduce range!');
            }

            result[range.min] = vertex.body;
        }

        return result;
    }

    removeUnreachable() {
        const unreachable = [];

        for (const vertex of this.graph.keys()) {
            if (this.isTerminal(vertex) && vertex.range !== undefined && vertex.range.min < 0 && vertex.range.max < 0) {
                unreachable.push(vertex);
            }
        }

        for (const vertex of unreachable) {
            this.removeVertex(vertex);
        }
    }

    removeVertex(vertex) {
        for (const edge of this.inEdges.get(vertex) || []) {
            const list = this.outEdges.get(edge.source) || [];
            const idx = list.indexOf(edge);
            if (idx !== -1) {
                list.splice(idx, 1);
            }
        }
        for (const edge of this.outEdges.get(vertex) || []) {
            const list = this.inEdges.get(edge.target) || [];
            const idx = list.indexOf(edge);
            if (idx !== -1) {
                list.splice(idx, 1);
            }
        }
        this.graph.delete(vertex);
        this.inEdges.delete(vertex);
        this.outEdges.delete(vertex);
    }

    reduceRanges() {
        const vertices = [...this.graph.keys()];
        const root = vertices.find(v => this.inDegree(v) === 0);
        const leafs = vertices.filter(v => this.isTerminal(v));

        for (const leaf of leafs) {
            const range = leaf.range;

            for (let i = range.min; i <= range.max; i++) {
                if (this.hasValidPath(leaf, root, i)) {
                    range.min = range.max = i;
                    break;
                }

                if (i === range.max) {
                    range.min = range.max = -1;
                }
            }
        }
    }

    hasValidPath(current, root, state) {
        if (current === root) {
            return true;
        }

        for (const edge of this.inEdges.get(current) || []) {
            const source = edge.source;
            if (this.isValidPath(source, edge, state) && this.hasValidPath(source, root, state)) {
                return true;
            }
        }

        return false;
    }

    isValidPath(vertex, edge, state) {
        const constant = vertex.constantValue;
        let valid;

        switch (vertex.operator) {
            case BinaryOperator.Equals:
                valid = state === constant;
                break;
            case BinaryOperator.NotEquals:
                valid = state !== constant;
                break;
            case BinaryOperator.LessThanOrEquals:
                valid = state <= constant;
                break;
            case BinaryOperator.GreaterThanOrEquals:
                valid = state >= constant;
                break;
            case BinaryOperator.LessThan:
                valid = state < constant;
                break;
            case BinaryOperator.GreaterThan:
                valid = state > constant;
                break;
            default:
                throw new Error('Invalid operator in IsValidPath!');
        }

        return (edge.tag === EdgeType.Then) === valid;
    }

    setRanges() {
        for (const node of this.graph.keys()) {
            if (this.isTerminal(node)) {
                continue;
            }

            const edges = this.outEdges.get(node);
            if (edges.length !== 2) {
                throw new Error(`Expected 2 edges but got ${edges.length}`);
            }

            const thenEdge = edges.find(e => e.tag === EdgeType.Then);
            const elseEdge = edges.find(e => e.tag === EdgeType.Else);
            const ranges = this.computeRanges(node);

            const thenTarget = thenEdge.target;
            const elseTarget = elseEdge.target;

            if (this.isTerminal(thenTarget)) {
                thenTarget.range = ranges.theThen;
            }

            if (this.isTerminal(elseTarget)) {
                elseTarget.range = ranges.theElse;
            }
        }
    }

    computeRanges(v) {
        const c = v.constantValue;

        switch (v.operator) {
            case BinaryOperator.Equals:
                return { theThen: new Range(c, c), theElse: new Range(Math.max(c - 1, 0), c + 1) };
            case BinaryOperator.NotEquals:
                return { theThen: new Range(Math.max(c - 1, 0), c + 1), theElse: new Range(c, c) };
            case BinaryOperator.LessThan:
                return { theThen: new Range(Math.max(c - 1, 0), Math.max(c - 1, 0)), theElse: new Range(c, c) };
            case BinaryOperator.GreaterThan:
                return { theThen: new Range(c + 1, c + 1), theElse: new Range(c, c) };
            case BinaryOperator.LessThanOrEquals:
                return { theThen: new Range(c, c), theElse: new Range(c + 1, c + 1) };
            case BinaryOperator.GreaterThanOrEquals:
                return { theThen: new Range(c, c), theElse: new Range(Math.max(c - 1, 0), Math.max(c - 1, 0)) };
            default:
                throw new Error('Invalid operator in ComputeRanges!');
        }
    }

    addBranches(branch, source, edgeType) {
        const condition = branch.ifClause.condition;
        const node = new Vertex();
        node.operator = condition.operator;
        node.constantValue = condition.right.value;

        this.addVertex(node);

        if (source !== null) {
            this.addEdge(source, node, edgeType);
        }

        this.addBranch(branch.ifClause.body, node, EdgeType.Then);
        this.addBranch(branch.elseBody, node, EdgeType.Else);
    }

    addBranch(body, source, edgeType) {
        if (this.treeContinues(body)) {
            this.addBranches(body.statements[0], source, edgeType);
        } else {
            const leaf = new Vertex();
            leaf.body = body;
            this.addVertex(leaf);
            this.addEdge(source, leaf, edgeType);
        }
    }

    isTerminal(vertex) {
        return (this.outEdges.get(vertex) || []).length === 0;
    }

    inDegree(vertex) {
        return (this.inEdges.get(vertex) || []).length;
    }

    treeContinues(node) {
        return node.statements.length === 1
            && node.statements[0] instanceof N.If
            && node.statements[0].ifClause.condition instanceof N.BinaryExpression
            && node.statements[0].ifClause.condition.left instanceof N.Name
            && node.statements[0].ifClause.condition.left.value === this.stateName;
    }
}

module.exports = { TreeSolver };