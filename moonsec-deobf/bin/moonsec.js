#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { Deobfuscator } = require('../src/deobf/deobfuscator.js');
const { Serializer } = require('../src/deobf/bytecode/serializer.js');
const { Disassembler } = require('../src/deobf/bytecode/disassembler.js');

function printUsage() {
    console.log('Usage:');
    console.log('\tmoonsec-deobfuscate -dev -i <input.lua> -o <output.luac>');
    console.log('\tmoonsec-deobfuscate -dis -i <input.lua> -o <output.txt>');
}

function main() {
    const args = process.argv.slice(2);

    if (args.length !== 5 || args[1] !== '-i' || args[3] !== '-o') {
        printUsage();
        process.exit(1);
    }

    const command = args[0];
    const input = args[2];
    const output = args[4];

    if (!fs.existsSync(input)) {
        console.error(`Invalid input path: ${input}`);
        process.exit(1);
    }

    const code = fs.readFileSync(input, 'utf8');

    try {
        const result = new Deobfuscator().deobfuscate(code);

        if (command === '-dev') {
            const serializer = new Serializer();
            const bytes = serializer.serialize(result);
            fs.writeFileSync(output, bytes);
            console.log(`Wrote ${bytes.length} bytes to ${output}`);
        } else if (command === '-dis') {
            const disassembly = new Disassembler(result).disassemble();
            fs.writeFileSync(output, disassembly, 'utf8');
            console.log(`Wrote disassembly to ${output}`);
        } else {
            console.error('Invalid command!');
            process.exit(1);
        }
    } catch (error) {
        console.error(error.message || String(error));
        process.exit(1);
    }
}

main();