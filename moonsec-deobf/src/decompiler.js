'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// MoonSec v3 → source, 100% in-process and pure JS.
//
// This file used to shell out to `luadec` (a native C binary) and `unluac.jar`
// (Java) to turn the devirtualised Lua 5.1 bytecode back into source. Both were
// external processes fed attacker-influenced bytecode — luadec in particular is
// written in C and is not hardened against hostile input, i.e. a real
// memory-safety / RCE surface in the MoonSec job.
//
// They are GONE. There is no `child_process`, no native binary and no JVM in the
// MoonSec path any more. Instead we use the tool's own pure-JS engines:
//   * Decompiler  — reconstructs readable Lua from the bytecode model (best
//                   effort; its output is validated with luaparse).
//   * Disassembler — a faithful, always-correct low-level listing, used as the
//                   guaranteed fallback whenever the decompiled source does not
//                   parse as valid Lua 5.1.
// Both are memory-safe JS running inside the sandboxed Node subprocess, so a
// crafted script can at worst produce ugly output — never run code or read the
// server's files.
// ─────────────────────────────────────────────────────────────────────────────

const { Deobfuscator } = require('./deobf/deobfuscator.js');
const { Serializer } = require('./deobf/bytecode/serializer.js');
const { Disassembler } = require('./deobf/bytecode/disassembler.js');
const { Decompiler } = require('./deobf/bytecode/decompiler.js');

// luaparse is already a dependency of this tool; we use it only to VALIDATE our
// own decompiler output (never to execute anything).
let luaparse = null;
try { luaparse = require('luaparse'); } catch (_) { luaparse = null; }

function isValidLua(src) {
    if (!luaparse) return null; // validation unavailable → caller keeps best effort
    try {
        luaparse.parse(src, { luaVersion: '5.1', comments: false, scope: false });
        return true;
    } catch (_) {
        return false;
    }
}

function deobfuscateToModel(code) {
    return new Deobfuscator().deobfuscate(code);
}

// Kept for compatibility / tooling; no longer used by the source path.
function deobfuscateToBytecode(code) {
    return new Serializer().serialize(deobfuscateToModel(code));
}

function renderSource(model) {
    const disasm = () => {
        const dis = new Disassembler(model).disassemble();
        return '-- Recovered by Novix (pure-JS, no external decompiler)\n' +
            '-- Faithful bytecode listing (structured decompilation unavailable for this chunk)\n' +
            dis;
    };

    let decompiled = null;
    try {
        decompiled = new Decompiler(model, Disassembler).decompile();
    } catch (_) {
        decompiled = null;
    }

    if (decompiled) {
        const ok = isValidLua(decompiled);
        // ok === true  -> decompiled source parses, use it.
        // ok === null  -> no validator available, still prefer the decompiler output.
        if (ok === true || ok === null) return decompiled;
    }
    return disasm();
}

function deobfuscateToSource(code) {
    return renderSource(deobfuscateToModel(code));
}

function deobfuscateToDisassembly(code) {
    return new Disassembler(deobfuscateToModel(code)).disassemble();
}

module.exports = { deobfuscateToBytecode, deobfuscateToSource, deobfuscateToDisassembly };
