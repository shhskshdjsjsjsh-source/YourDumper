'use strict';

const OpCode = Object.freeze({
    Move: 0,
    LoadK: 1,
    LoadBool: 2,
    LoadNil: 3,
    GetUpval: 4,
    GetGlobal: 5,
    GetTable: 6,
    SetGlobal: 7,
    SetUpval: 8,
    SetTable: 9,
    NewTable: 10,
    Self: 11,
    Add: 12,
    Sub: 13,
    Mul: 14,
    Div: 15,
    Mod: 16,
    Pow: 17,
    Unm: 18,
    Not: 19,
    Len: 20,
    Concat: 21,
    Jmp: 22,
    Eq: 23,
    Lt: 24,
    Le: 25,
    Test: 26,
    TestSet: 27,
    Call: 28,
    TailCall: 29,
    Return: 30,
    ForLoop: 31,
    ForPrep: 32,
    TForLoop: 33,
    SetList: 34,
    Close: 35,
    Closure: 36,
    VarArg: 37,
    Unknown: 38
});

const OpType = Object.freeze({
    AB: 'AB',
    ABx: 'ABx',
    ABC: 'ABC',
    sBx: 'sBx',
    AC: 'AC',
    AsBx: 'AsBx',
    A: 'A',
    None: 'None'
});

function getOpType(opcode) {
    switch (opcode) {
        case OpCode.Move:
        case OpCode.LoadNil:
        case OpCode.GetUpval:
        case OpCode.SetUpval:
        case OpCode.Unm:
        case OpCode.Not:
        case OpCode.Len:
        case OpCode.Return:
        case OpCode.VarArg:
            return OpType.AB;
        case OpCode.LoadK:
        case OpCode.GetGlobal:
        case OpCode.SetGlobal:
        case OpCode.Closure:
            return OpType.ABx;
        case OpCode.LoadBool:
        case OpCode.GetTable:
        case OpCode.SetTable:
        case OpCode.Add:
        case OpCode.Sub:
        case OpCode.Mul:
        case OpCode.Div:
        case OpCode.Mod:
        case OpCode.Pow:
        case OpCode.Concat:
        case OpCode.Call:
        case OpCode.TailCall:
        case OpCode.Self:
        case OpCode.Eq:
        case OpCode.Lt:
        case OpCode.Le:
        case OpCode.TestSet:
        case OpCode.NewTable:
        case OpCode.SetList:
            return OpType.ABC;
        case OpCode.Jmp:
            return OpType.sBx;
        case OpCode.Test:
        case OpCode.TForLoop:
            return OpType.AC;
        case OpCode.ForPrep:
        case OpCode.ForLoop:
            return OpType.AsBx;
        case OpCode.Close:
            return OpType.A;
        default:
            throw new Error('Invalid opcode in GetOpType');
    }
}

class Instruction {
    constructor() {
        this.a = 0;
        this.b = 0;
        this.c = 0;
        this.opNum = 0;
        this.pc = 0;
        this.isKA = false;
        this.isKB = false;
        this.isKC = false;
        this.isDead = false;
        this.function = null;
        this.opCode = OpCode.Unknown;
    }
}

class Function {
    constructor() {
        this.instructions = [];
        this.constants = [];
        this.functions = [];
        this.maxStackSize = 0;
        this.numParams = 0;
        this.numUpvalues = 0;
        this.isVarArgFlag = 0;
        this.name = `func_${Math.random().toString(16).slice(2, 10)}`;
    }
}

class StringConstant {
    constructor(value) {
        this.value = value;
    }

    toString() {
        return `"${this.value}"`;
    }
}

class NumberConstant {
    constructor(value) {
        this.value = value;
    }

    toString() {
        return String(this.value);
    }
}

class BooleanConstant {
    constructor(value) {
        this.value = value;
    }

    toString() {
        return this.value ? 'true' : 'false';
    }
}

class NilConstant {
    toString() {
        return 'nil';
    }
}

module.exports = { OpCode, OpType, getOpType, Instruction, Function, StringConstant, NumberConstant, BooleanConstant, NilConstant };