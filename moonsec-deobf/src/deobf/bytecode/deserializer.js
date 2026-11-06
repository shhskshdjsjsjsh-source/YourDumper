'use strict';

const {
    Instruction,
    Function,
    BooleanConstant,
    NumberConstant,
    StringConstant,
    NilConstant
} = require('./models.js');
const { decodeConstant } = require('../utils/string-decoding.js');

const ProtoStep = Object.freeze({
    Instructions: 'Instructions',
    Constants: 'Constants',
    Functions: 'Functions',
    NumParams: 'NumParams',
    StringConstant: 'StringConstant',
    NumberConstant: 'NumberConstant',
    BooleanConstant: 'BooleanConstant'
});

class Deserializer {
    constructor(bytes, ctx) {
        this.data = bytes;
        this.ctx = ctx;
        this.offset = 0;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }

    readByte() {
        return this.data[this.offset++];
    }

    readBytes(count) {
        const bytes = this.data.slice(this.offset, this.offset + count);
        this.offset += count;
        return bytes;
    }

    readInt16() {
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readInt32() {
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readDouble() {
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }

    readBoolean() {
        return this.readByte() !== 0;
    }

    getBits(source, start, end) {
        return (source >> (start - 1)) & ((1 << (end - start + 1)) - 1);
    }

    readInstructions(function_) {
        const size = this.readInt32();
        const instructions = [];

        for (let i = 0; i < size; i++) {
            const descriptor = this.readByte();

            if (this.getBits(descriptor, 1, 1) !== 0) {
                continue;
            }

            const type = this.getBits(descriptor, 2, 3);
            const mask = this.getBits(descriptor, 4, 6);

            const instruction = new Instruction();
            instruction.opNum = this.readInt16();
            instruction.a = this.readInt16();
            instruction.pc = i;
            instruction.function = function_;

            switch (type) {
                case 0:
                    instruction.b = this.readInt16();
                    instruction.c = this.readInt16();
                    break;
                case 1:
                    instruction.b = this.readInt32();
                    break;
                case 2:
                    instruction.b = this.readInt32() - (1 << 16);
                    break;
                case 3:
                    instruction.b = this.readInt32() - (1 << 16);
                    instruction.c = this.readInt16();
                    break;
            }

            instruction.isKA = this.getBits(mask, 1, 1) === 1;
            instruction.isKB = this.getBits(mask, 2, 2) === 1;
            instruction.isKC = this.getBits(mask, 3, 3) === 1;

            instructions.push(instruction);
        }

        return instructions;
    }

    readPrototypes() {
        const size = this.readInt32();
        const prototypes = [];

        for (let i = 0; i < size; i++) {
            prototypes.push(this.readFunction());
        }

        return prototypes;
    }

    readConstants() {
        const size = this.readInt32();
        const constants = [];

        for (let i = 0; i < size; i++) {
            const typeFlag = this.readByte();
            const type = this.ctx.constantFormat[typeFlag];

            if (type === undefined) {
                constants.push(new NilConstant());
                continue;
            }

            switch (type) {
                case ProtoStep.BooleanConstant:
                    constants.push(new BooleanConstant(this.readBoolean()));
                    break;
                case ProtoStep.NumberConstant:
                    constants.push(new NumberConstant(this.readDouble()));
                    break;
                case ProtoStep.StringConstant: {
                    const str = decodeConstant(this.ctx.constantKey, this.readBytes(this.readInt32()));
                    constants.push(new StringConstant(str));
                    break;
                }
            }
        }

        return constants;
    }

    readFunction() {
        const function_ = new Function();

        for (const step of this.ctx.protoFormat) {
            switch (step) {
                case ProtoStep.Constants:
                    function_.constants = this.readConstants();
                    break;
                case ProtoStep.Instructions:
                    function_.instructions = this.readInstructions(function_);
                    break;
                case ProtoStep.NumParams:
                    function_.numParams = this.readByte();
                    break;
                case ProtoStep.Functions:
                    function_.functions = this.readPrototypes();
                    break;
            }
        }

        return function_;
    }
}

module.exports = { Deserializer, ProtoStep };