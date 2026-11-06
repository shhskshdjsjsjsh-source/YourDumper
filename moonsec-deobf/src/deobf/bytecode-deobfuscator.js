'use strict';

const { AstRewriter } = require('../ast/visitors/AstRewriter.js');
const { Block } = require('../ast/Nodes.js');
const { OpCode, StringConstant } = require('./bytecode/models.js');
const { StaticOpcodes } = require('./op-codes.js');
const { TreeSolver } = require('./utils/tree-solver.js');
const { windowedByDiscardedPairs } = require('./utils/extensions.js');
const { isPcIncrement, isInstAssign } = require('./utils/matching.js');
const { FingerprintGenerator } = require('./walkers/fingerprint-generator.js');
const { HandlerRewriter } = require('./rewriters/handler-rewriter.js');
const { PrettyPrinter } = require('../ast/pretty-printer.js');

class Handler {
    constructor(body, fingerprint) {
        this.body = body;
        this.fingerprint = fingerprint;
    }
}

class BytecodeDeobfuscator {
    constructor(function_, ctx) {
        this.handlerMapping = new Map();
        this.rootFunction = function_;
        this.ctx = ctx;
    }

    deobfuscate() {
        this.createHandlerMapping();
        this.deobfuscateOpcodes(this.rootFunction);
        this.deobfuscateControlFlow(this.rootFunction);
        this.fixProgramEntry();
        this.rebuildConstantPool(this.rootFunction);
        this.setFlags(this.rootFunction);
        this.rootFunction.isVarArgFlag = 2;
        return this.rootFunction;
    }

    deobfuscateControlFlow(function_) {
        const jumpReferences = this.computeJumpReferences(function_);

        this.removeDeadCode(function_);
        this.removeTestFlip(function_);
        this.fixTailCall(function_);
        this.fixJumpOffsets(function_, jumpReferences);

        for (const childFunction of function_.functions) {
            this.deobfuscateControlFlow(childFunction);
        }
    }

    rebuildConstantPool(function_) {
        const remapping = new Map();
        const newOrder = [];
        let next = 0;

        const remap = oldIdx => {
            if (!remapping.has(oldIdx)) {
                const newIdx = next++;
                remapping.set(oldIdx, newIdx);
                newOrder.push(function_.constants[oldIdx]);
            }
            return remapping.get(oldIdx);
        };

        const remapRK = operand => operand >= 256 ? remap(operand - 256) + 256 : operand;

        for (const instruction of function_.instructions) {
            switch (instruction.opCode) {
                case OpCode.LoadK:
                case OpCode.GetGlobal:
                case OpCode.SetGlobal:
                    instruction.b = remap(instruction.b);
                    break;
                case OpCode.SetTable:
                case OpCode.Eq:
                case OpCode.Lt:
                case OpCode.Le:
                case OpCode.Add:
                case OpCode.Sub:
                case OpCode.Mul:
                case OpCode.Div:
                case OpCode.Mod:
                case OpCode.Pow:
                    instruction.b = remapRK(instruction.b);
                    instruction.c = remapRK(instruction.c);
                    break;
                case OpCode.GetTable:
                case OpCode.Self:
                    instruction.c = remapRK(instruction.c);
                    break;
            }
        }

        function_.constants = newOrder;

        for (const childFunction of function_.functions) {
            this.rebuildConstantPool(childFunction);
        }
    }

    removeTestFlip(function_) {
        const instructions = function_.instructions;

        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];

            if (!(instruction.opCode === OpCode.Eq
                || instruction.opCode === OpCode.Lt
                || instruction.opCode === OpCode.Le
                || instruction.opCode === OpCode.Test)) {
                continue;
            }

            const next1 = instructions[i + 1];
            const next2 = instructions[i + 2];

            if (!(next1 !== undefined && next1.opCode === OpCode.Jmp
                && next2 !== undefined && next2.opCode === OpCode.Jmp)) {
                continue;
            }

            switch (instruction.opCode) {
                case OpCode.Eq:
                case OpCode.Lt:
                case OpCode.Le:
                    instruction.a = instruction.a === 1 ? 0 : 1;
                    break;
                case OpCode.Test:
                    instruction.c = instruction.c === 1 ? 0 : 1;
                    break;
            }

            instructions.splice(i + 1, 1);
        }
    }

    fixTailCall(function_) {
        const instructions = function_.instructions;

        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];

            if (instruction.opCode !== OpCode.TailCall) {
                continue;
            }

            if (i + 1 < instructions.length && instructions[i + 1].opCode === OpCode.Return) {
                continue;
            }

            instructions.splice(i + 1, 0, {
                opCode: OpCode.Return,
                a: instruction.a,
                b: 0,
                c: 0,
                opNum: 0,
                pc: 0,
                isKA: false,
                isKB: false,
                isKC: false,
                isDead: false,
                function: function_
            });
        }
    }

    fixProgramEntry() {
        let check = null;

        for (const instruction of this.rootFunction.instructions) {
            const constant = instruction.opCode === OpCode.Eq && instruction.c > 255
                ? this.rootFunction.constants[instruction.c - 256]
                : undefined;

            if (constant instanceof StringConstant
                && constant.value.startsWith('This file was protected with MoonSec V3')) {
                check = instruction;
                break;
            }
        }

        if (check === null) {
            return;
        }

        const idx = this.rootFunction.instructions.indexOf(check);

        for (let i = idx; i < this.rootFunction.instructions.length; i++) {
            if (this.rootFunction.instructions[i].opCode === OpCode.Return) {
                this.rootFunction.instructions.splice(0, i + 1);
                break;
            }
        }

        this.removeUnusedFunctions();
    }

    removeUnusedFunctions() {
        const functionReferences = new Map();

        for (const instruction of this.rootFunction.instructions) {
            if (instruction.opCode === OpCode.Closure) {
                functionReferences.set(instruction, this.rootFunction.functions[instruction.b]);
            }
        }

        this.rootFunction.functions = this.rootFunction.functions
            .filter(f => [...functionReferences.values()].includes(f));

        for (const [instruction, fn] of functionReferences) {
            instruction.b = this.rootFunction.functions.indexOf(fn);
        }
    }

    removeDeadCode(function_) {
        function_.instructions = function_.instructions.filter(instruction => !instruction.isDead);
    }

    fixJumpOffsets(function_, jumpReferences) {
        const instructions = function_.instructions;
        const pos = new Map();

        for (let i = 0; i < instructions.length; i++) {
            pos.set(instructions[i], i);
        }

        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];

            if (jumpReferences.has(instruction)) {
                const target = jumpReferences.get(instruction);
                instruction.b = pos.get(target) - (i + 1);
            }
        }
    }

    setFlags(function_) {
        function_.isVarArgFlag = 0;

        let maxA = 0;

        for (const instruction of function_.instructions) {
            const opcode = instruction.opCode;
            const a = instruction.a;

            if (a > maxA) {
                maxA = a;
            }

            if (opcode === OpCode.Closure) {
                function_.functions[instruction.b].numUpvalues = instruction.c & 0xff;
            } else if (opcode === OpCode.VarArg) {
                function_.isVarArgFlag = 2;
            }
        }

        function_.maxStackSize = (maxA + 1) & 0xff;

        for (const childFunction of function_.functions) {
            this.setFlags(childFunction);
        }
    }

    computeJumpReferences(function_) {
        const jumpReferences = new Map();
        const instructions = function_.instructions;

        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];

            if (instruction.opCode === OpCode.Jmp
                || instruction.opCode === OpCode.ForLoop
                || instruction.opCode === OpCode.ForPrep) {
                jumpReferences.set(instruction, instructions[(i + instruction.b) + 1]);
            }
        }

        return jumpReferences;
    }

    deobfuscateOpcodes(function_) {
        const instructions = function_.instructions;
        const jmpSet = new Set();

        for (let i = 0; i < instructions.length; i++) {
            let instruction = instructions[i];
            const handlers = this.handlerMapping.get(instruction.opNum);

            if (handlers === undefined) {
                continue;
            }

            for (let hi = 0; hi < handlers.length; hi++) {
                const handler = handlers[hi];

                this.deobfuscateOpcode(instruction, handler);

                if (instruction.opCode === OpCode.Jmp) {
                    jmpSet.add(i + instruction.b + 1);
                }

                if (instruction.opCode === OpCode.Return || instruction.opCode === OpCode.TailCall) {
                    i = this.skipDeadCode(instructions, jmpSet, i);
                    break;
                }

                if (hi !== handlers.length - 1 && i + 1 < instructions.length) {
                    instruction = instructions[++i];
                }
            }
        }

        for (const childFunction of function_.functions) {
            this.deobfuscateOpcodes(childFunction);
        }
    }

    skipDeadCode(instructions, jmpSet, i) {
        while (++i < instructions.length) {
            const nextIndex = i;

            if (jmpSet.has(nextIndex)) {
                i--;
                break;
            }

            instructions[i].isDead = true;
        }

        return i;
    }

    deobfuscateOpcode(instruction, handler) {
        if (StaticOpcodes.has(handler.fingerprint)) {
            const [opcode, transform] = StaticOpcodes.get(handler.fingerprint);
            instruction.opCode = opcode;

            if (transform !== null) {
                transform(instruction);
            }
        } else {
            console.error(`Could not identify handler: ${handler.fingerprint}`);
            console.error(PrettyPrinter.asString(handler.body));
        }
    }

    createHandlerMapping() {
        const solvedVmTree = new TreeSolver(this.ctx.vmTree, 'enum').solve();

        for (const [opcode, body] of Object.entries(solvedVmTree)) {
            this.createHandler(Number(opcode), body);
        }
    }

    createHandler(opcode, body) {
        const handlers = windowedByDiscardedPairs(body.statements, (a, b) =>
            isPcIncrement(a) && isInstAssign(b))
            .map(stats => {
                const block = new Block();
                block.statements = [...stats];
                const clone = block.clone();
                new HandlerRewriter().rewrite(clone, 'PostOrder', true, true);
                return clone;
            })
            .map(block => new Handler(block, FingerprintGenerator.generate(block)));

        this.handlerMapping.set(opcode, handlers);
    }
}

module.exports = { BytecodeDeobfuscator, Handler };