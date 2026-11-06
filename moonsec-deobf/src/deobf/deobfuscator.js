'use strict';

const { Block, Assign, StringLiteral, Name } = require('../ast/Nodes.js');
const { Renamer } = require('./walkers/renamer.js');
const { StringCollector } = require('./walkers/string-collector.js');
const { Analyzer } = require('./walkers/analyzer.js');
const { ConstantReplacer } = require('./rewriters/constant-replacer.js');
const { ConstantFolder } = require('./rewriters/constant-folder.js');
const { ControlFlowSolver } = require('./rewriters/control-flow-solver.js');
const { decode, decodeEscape, decodeConstants } = require('./utils/string-decoding.js');
const { Deserializer } = require('./bytecode/deserializer.js');
const { BytecodeDeobfuscator } = require('./bytecode-deobfuscator.js');
const { NumberConstant } = require('./bytecode/models.js');
const { Context } = require('./context.js');
const { solveKeyExpression } = require('./lua-eval.js');

class Deobfuscator {
    constructor() {
        this.ctx = new Context();
        this.root = null;
    }

    deobfuscate(code, antiTamper = false) {
        this.root = Block.fromString(code);

        new Renamer().walk(this.root);
        new ConstantReplacer(this.decodeConstants()).rewrite(this.root, 'PreOrder');
        new ConstantFolder().rewrite(this.root, 'PostOrder');
        new Analyzer(this.ctx).walk(this.root, true);

        if (this.root.statements.length > 3 && !antiTamper) {
            return this.deobfuscate(this.handleAntiTamper(), true);
        }

        new ControlFlowSolver().rewrite(this.ctx.wrapper, 'PostOrder');
        new Renamer(this.ctx.identifiedNames).walk(this.root);

        let function_ = this.deserializeBytecode();
        const bytecodeDeobfuscator = new BytecodeDeobfuscator(function_, this.ctx);

        function_ = bytecodeDeobfuscator.deobfuscate();

        return function_;
    }

    decodeConstants() {
        const constants = StringCollector.collect(this.root);

        const decoded = constants
            .map(it => it[0] !== null
                ? decode(it[1], it[0])
                : decodeEscape(it[1]))
            .map(data => decodeConstants(data));

        const map = {};

        for (const entry of decoded) {
            for (const [key, value] of Object.entries(entry)) {
                map[key] = value;
            }
        }

        return map;
    }

    handleAntiTamper() {
        const function_ = this.deserializeBytecode();
        const instructions = function_.instructions
            .filter(instr => instr.isKA === false && instr.isKB === true && instr.isKC === false);

        const constant = function_.constants[instructions[instructions.length - 2].b - 1];
        const key = constant.value;

        const bytecodeString = this.root.statements[2].values[0].value.slice(1, -1);
        const scriptString = this.root.statements[3].values[0].value.slice(1, -1);

        this.ctx = new Context();
        this.ctx.bytecodeString = bytecodeString;

        return new TextDecoder().decode(decode(scriptString, Math.round(key)));
    }

    deserializeBytecode() {
        this.solveKeys();

        const bytecode = decode(this.ctx.bytecodeString, this.ctx.bytecodeKey);
        const deserializer = new Deserializer(bytecode, this.ctx);

        return deserializer.readFunction();
    }

    solveKeys() {
        if (this.ctx.keyExpressions.length >= 2) {
            this.ctx.constantKey = Math.round(solveKeyExpression(this.ctx.keyExpressions[0]));
        }

        if (this.ctx.keyExpressions.length >= 1) {
            this.ctx.bytecodeKey = Math.round(solveKeyExpression(this.ctx.keyExpressions[this.ctx.keyExpressions.length - 1]));
        }
    }
}

module.exports = { Deobfuscator };