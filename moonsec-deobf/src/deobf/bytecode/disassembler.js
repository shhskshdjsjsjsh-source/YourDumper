'use strict';

const { OpCode, StringConstant } = require('./models.js');

const OpCodeName = Object.freeze({
    [OpCode.Move]: 'Move',
    [OpCode.LoadK]: 'LoadK',
    [OpCode.LoadBool]: 'LoadBool',
    [OpCode.LoadNil]: 'LoadNil',
    [OpCode.GetUpval]: 'GetUpval',
    [OpCode.GetGlobal]: 'GetGlobal',
    [OpCode.GetTable]: 'GetTable',
    [OpCode.SetGlobal]: 'SetGlobal',
    [OpCode.SetUpval]: 'SetUpval',
    [OpCode.SetTable]: 'SetTable',
    [OpCode.NewTable]: 'NewTable',
    [OpCode.Self]: 'Self',
    [OpCode.Add]: 'Add',
    [OpCode.Sub]: 'Sub',
    [OpCode.Mul]: 'Mul',
    [OpCode.Div]: 'Div',
    [OpCode.Mod]: 'Mod',
    [OpCode.Pow]: 'Pow',
    [OpCode.Unm]: 'Unm',
    [OpCode.Not]: 'Not',
    [OpCode.Len]: 'Len',
    [OpCode.Concat]: 'Concat',
    [OpCode.Jmp]: 'Jmp',
    [OpCode.Eq]: 'Eq',
    [OpCode.Lt]: 'Lt',
    [OpCode.Le]: 'Le',
    [OpCode.Test]: 'Test',
    [OpCode.TestSet]: 'TestSet',
    [OpCode.Call]: 'Call',
    [OpCode.TailCall]: 'TailCall',
    [OpCode.Return]: 'Return',
    [OpCode.ForLoop]: 'ForLoop',
    [OpCode.ForPrep]: 'ForPrep',
    [OpCode.TForLoop]: 'TForLoop',
    [OpCode.SetList]: 'SetList',
    [OpCode.Close]: 'Close',
    [OpCode.Closure]: 'Closure',
    [OpCode.VarArg]: 'VarArg',
    [OpCode.Unknown]: 'Unknown'
});

function pad(value, width) {
    const str = String(value);
    return str.padStart(width);
}

function rangeCount(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(i);
    }
    return out;
}

class Disassembler {
    constructor(rootFunction) {
        this.rootFunction = rootFunction;
        this.lines = [];
    }

    disassemble() {
        this.lines.push('-- Disassembled with MoonSec V3 deobfuscator by #tupsutumppu');
        this.disassembleFunction(this.rootFunction);
        return this.lines.join('\n');
    }

    disassembleFunction(function_) {
        let header = `function ${function_.name}(`;

        for (let i = 0; i < function_.numParams; i++) {
            header += `R${i}`;

            if (i + 1 < function_.numParams) {
                header += ', ';
            }
        }

        if (function_.isVarArgFlag === 2) {
            header += function_.numParams > 0 ? ', ...' : '...';
        }

        header += ')';
        this.lines.push(header);

        this.lines.push(`\t[Slots: ${function_.maxStackSize}, Upvalues: ${function_.numUpvalues}, Constants: ${function_.constants.length}]`);

        const instructions = function_.instructions;

        for (let i = 0; i < instructions.length; i++) {
            this.lines.push(`\t[${pad(i, 4)}]\t${this.disassembleInstruction(instructions[i])}`);
        }

        this.lines.push('end');

        for (const childFunction of function_.functions) {
            this.disassembleFunction(childFunction);
        }
    }

    disassembleInstruction(instruction) {
        const a = instruction.a;
        const b = instruction.b;
        const c = instruction.c;
        let result;

        if (instruction.opCode !== OpCode.Unknown) {
            result = `${pad(OpCodeName[instruction.opCode], 12)}\t| ${pad(a, 4)} | ${pad(b, 4)} | ${pad(c, 4)} |`;
        } else if (instruction.isDead) {
            result = `${pad('DEAD', 12)}\t| ${pad('-', 4)} | ${pad('-', 4)} | ${pad('-', 4)} |`;
        } else {
            result = `${pad(instruction.opNum, 12)}\t| ${pad(a, 4)} | ${pad(b, 4)} | ${pad(c, 4)} |`;
        }

        if (instruction.opCode !== OpCode.Unknown) {
            result += `\t${this.genAnnotation(instruction)}`;
        }

        return result;
    }

    genAnnotation(instruction) {
        const a = instruction.a;
        const b = instruction.b;
        const c = instruction.c;
        const function_ = instruction.function;

        switch (instruction.opCode) {
            case OpCode.GetGlobal:
                return `R${a} = ${function_.constants[b].value}`;
            case OpCode.SetGlobal:
                return `${function_.constants[b].value} = R${a}`;
            case OpCode.LoadK: {
                const constant = function_.constants[b];
                return `R${a} = ${constant === undefined ? '' : constant.toString()}`;
            }
            case OpCode.LoadNil:
                return b - a === 0 ? `R${a} = nil` : `R${a}->R${b} = nil`;
            case OpCode.LoadBool: {
                const value = b !== 0 ? 'true' : 'false';
                const skip = c !== 0 ? '; PC += 1' : '';
                return `R${a} = ${value}${skip}`;
            }
            case OpCode.Move:
                return `R${a} = R${b}`;
            case OpCode.Jmp:
                return `PC += ${b}`;
            case OpCode.GetUpval:
                return `R${a} = UPVALUE_${b}`;
            case OpCode.SetUpval:
                return `UPVALUE_${b} = R${a}`;
            case OpCode.GetTable:
                return `R${a} = R${b}[${this.registerOrConstant(c, function_)}]`;
            case OpCode.SetTable:
                return `R${a}[${this.registerOrConstant(b, function_)}] = ${this.registerOrConstant(c, function_)}`;
            case OpCode.NewTable:
                return `R${a} = {}`;
            case OpCode.Self:
                return `R${a + 1} = R${b}; R${a} = R${b}[${this.registerOrConstant(c, function_)}]`;
            case OpCode.Add:
                return `R${a} = ${this.registerOrConstant(b, function_)} + ${this.registerOrConstant(c, function_)}`;
            case OpCode.Sub:
                return `R${a} = ${this.registerOrConstant(b, function_)} - ${this.registerOrConstant(c, function_)}`;
            case OpCode.Mul:
                return `R${a} = ${this.registerOrConstant(b, function_)} * ${this.registerOrConstant(c, function_)}`;
            case OpCode.Div:
                return `R${a} = ${this.registerOrConstant(b, function_)} / ${this.registerOrConstant(c, function_)}`;
            case OpCode.Mod:
                return `R${a} = ${this.registerOrConstant(b, function_)} % ${this.registerOrConstant(c, function_)}`;
            case OpCode.Pow:
                return `R${a} = ${this.registerOrConstant(b, function_)} ^ ${this.registerOrConstant(c, function_)}`;
            case OpCode.Unm:
                return `R${a} = -R${b}`;
            case OpCode.Not:
                return `R${a} = not R${b}`;
            case OpCode.Len:
                return `R${a} = #R${b}`;
            case OpCode.Concat: {
                let result = `R${a} = `;
                for (let i = b; i <= c; i++) {
                    result += `R${i}`;
                    if (i + 1 <= c) {
                        result += ' .. ';
                    }
                }
                return result;
            }
            case OpCode.Eq:
            case OpCode.Lt:
            case OpCode.Le: {
                let op;
                if (instruction.opCode === OpCode.Eq) {
                    op = a === 0 ? '==' : '~=';
                } else if (instruction.opCode === OpCode.Lt) {
                    op = a === 0 ? '<' : '>';
                } else {
                    op = a === 0 ? '<=' : '>=';
                }
                return `if ${this.registerOrConstant(b, function_)} ${op} ${this.registerOrConstant(c, function_)} then PC += 1`;
            }
            case OpCode.Test:
                return `if ${c === 0 ? `not R${a}` : `R${a}`} then PC += 1`;
            case OpCode.TestSet:
                return `if ${c === 0 ? `not R${b}` : `R${b}`} then R${a} = R${b} else PC += 1`;
            case OpCode.Call: {
                const lhs = c === 0
                    ? `R${a}->top = `
                    : c === 1
                        ? ''
                        : rangeCount(c - 1).map(i => `R${a + i}`).join(', ') + ' = ';
                const args = b === 0
                    ? `R${a + 1}->top`
                    : b === 1
                        ? ''
                        : rangeCount(b - 1).map(i => `R${a + i + 1}`).join(', ');
                return `${lhs}R${a}(${args})`;
            }
            case OpCode.TailCall:
                if (b > 1) {
                    return `return R${a}(${rangeCount(b - 1).map(i => `R${a + i + 1}`).join(', ')})`;
                }
                if (b === 1) {
                    return `return R${a}(R${a + 1})`;
                }
                return `return R${a}()`;
            case OpCode.Return:
                if (b === 0) {
                    return `return R${a}->top`;
                }
                if (b === 1) {
                    return 'return';
                }
                return `return ${rangeCount(b - 1).map(i => `R${a + i}`).join(', ')}`;
            case OpCode.ForLoop:
                return `R${a} += R${a + 2}; if loop continues then PC += ${b}; R${a + 3} = R${a};`;
            case OpCode.ForPrep:
                return `R${a} -= R${a + 2}; PC += ${b}`;
            case OpCode.TForLoop: {
                const targets = rangeCount(c).map(i => `R${a + i + 3}`).join(', ');
                const call = `R${a}(R${a + 1}, R${a + 2})`;
                const body = `if R${a + 3} ~= nil then R${a + 2} = R${a + 3} else PC += 1 end`;
                return `${targets} = ${call}; ${body}`;
            }
            case OpCode.Closure:
                return `R${a} = ${function_.functions[b].name}`;
            case OpCode.VarArg: {
                const result = b === 0
                    ? `R${a}->top`
                    : b === 1
                        ? ''
                        : rangeCount(b - 1).map(i => `R${a + i}`).join(', ');
                return `${result} = ...`;
            }
        }

        return '';
    }

    registerOrConstant(register, function_) {
        return register > 255 ? function_.constants[register - 256].toString() : `R${register}`;
    }
}

module.exports = { Disassembler };