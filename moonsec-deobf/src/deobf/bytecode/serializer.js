'use strict';

const { getOpType, StringConstant, NumberConstant, BooleanConstant } = require('./models.js');

function mask(value, bits) {
    return value & ((1 << bits) - 1);
}

class Serializer {
    constructor() {
        this.chunks = [];
    }

    writeByte(value) {
        this.chunks.push(value & 0xff);
    }

    writeBytes(bytes) {
        for (const byte of bytes) {
            this.chunks.push(byte & 0xff);
        }
    }

    writeU32(value) {
        const v = value >>> 0;
        this.chunks.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
    }

    writeI32(value) {
        this.writeU32(value);
    }

    writeU64(value) {
        const lo = value >>> 0;
        const hi = Math.floor(value / 0x100000000) >>> 0;
        this.chunks.push(
            lo & 0xff, (lo >>> 8) & 0xff, (lo >>> 16) & 0xff, (lo >>> 24) & 0xff,
            hi & 0xff, (hi >>> 8) & 0xff, (hi >>> 16) & 0xff, (hi >>> 24) & 0xff
        );
    }

    writeDouble(value) {
        const buffer = new ArrayBuffer(8);
        new DataView(buffer).setFloat64(0, value, true);
        this.writeBytes(new Uint8Array(buffer));
    }

    writeString(data) {
        const bytes = Buffer.from(data, 'utf8');

        this.writeU64(bytes.length + 1);
        this.writeBytes(bytes);
        this.writeByte(0);
    }

    writeFunction(function_) {
        this.writeString('');
        this.writeI32(0);
        this.writeI32(0);

        this.writeByte(function_.numUpvalues);
        this.writeByte(function_.numParams);
        this.writeByte(function_.isVarArgFlag);
        this.writeByte(function_.maxStackSize);

        this.writeInstructions(function_.instructions);
        this.writeConstants(function_.constants);
        this.writeFunctions(function_.functions);

        this.writeI32(0);
        this.writeI32(0);
        this.writeI32(0);
    }

    writeFunctions(functions) {
        this.writeI32(functions.length);

        for (const function_ of functions) {
            this.writeFunction(function_);
        }
    }

    writeConstants(constants) {
        this.writeI32(constants.length);

        for (const constant of constants) {
            if (constant instanceof StringConstant) {
                this.writeByte(4);
                this.writeString(constant.value);
            } else if (constant instanceof NumberConstant) {
                this.writeByte(3);
                this.writeDouble(constant.value);
            } else if (constant instanceof BooleanConstant) {
                this.writeByte(1);
                this.writeByte(constant.value ? 1 : 0);
            } else {
                this.writeByte(0);
            }
        }
    }

    writeInstructions(instructions) {
        this.writeI32(instructions.length);

        for (const instruction of instructions) {
            let data = instruction.opCode;

            switch (getOpType(instruction.opCode)) {
                case 'A':
                    data |= mask(instruction.a, 8) << 6;
                    break;
                case 'AB':
                    data |= mask(instruction.a, 8) << 6;
                    data |= mask(instruction.b, 9) << 23;
                    break;
                case 'AC':
                    data |= mask(instruction.a, 8) << 6;
                    data |= mask(instruction.c, 9) << 14;
                    break;
                case 'ABC':
                    data |= mask(instruction.a, 8) << 6;
                    data |= mask(instruction.b, 9) << 23;
                    data |= mask(instruction.c, 9) << 14;
                    break;
                case 'ABx':
                    data |= mask(instruction.a, 8) << 6;
                    data |= mask(instruction.b, 18) << 14;
                    break;
                case 'AsBx':
                    data |= mask(instruction.a, 8) << 6;
                    data |= mask(instruction.b + 131071, 18) << 14;
                    break;
                case 'sBx':
                    data |= mask(instruction.b + 131071, 18) << 14;
                    break;
                default:
                    throw new Error('Invalid op type');
            }

            this.writeU32(data);
        }
    }

    writeHeader() {
        this.writeBytes([0x1b, 0x4c, 0x75, 0x61, 0x51, 0, 1, 4, 8, 4, 8, 0]);
    }

    serialize(function_) {
        this.writeHeader();
        this.writeFunction(function_);
        return Buffer.from(this.chunks);
    }
}

module.exports = { Serializer };