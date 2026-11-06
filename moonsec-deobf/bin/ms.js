#!/usr/bin/env node

'use strict';

const fs = require('fs');
const { deobfuscateToSource } = require('../src/decompiler.js');

function printUsage() {
    console.log('Usage:');
    console.log('\tms.js <input.lua> [-o <output.lua>]');
}

function main() {
    const args = process.argv.slice(2);

    const input = args.find(a => !a.startsWith('-'));
    const outputIndex = args.indexOf('-o');
    const output = outputIndex !== -1 ? args[outputIndex + 1] : null;

    if (!input) {
        printUsage();
        process.exit(1);
    }

    if (!fs.existsSync(input)) {
        console.error(`Invalid input path: ${input}`);
        process.exit(1);
    }

    const code = fs.readFileSync(input, 'utf8');

    try {
        const source = deobfuscateToSource(code);

        if (output) {
            fs.writeFileSync(output, source, 'utf8');
            console.log(`Wrote deobfuscated source to ${output}`);
        } else {
            console.log(source);
        }
    } catch (error) {
        console.error(error.message || String(error));
        process.exit(1);
    }
}

main();
