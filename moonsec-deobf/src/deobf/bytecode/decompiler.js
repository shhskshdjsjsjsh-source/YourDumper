'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Novix pure-JS Lua 5.1 decompiler.
//
// Replaces the external `luadec` (native C) and `unluac.jar` (Java) decompilers
// the MoonSec v3 tool used to shell out to. It consumes the SAME in-memory
// Function model the Disassembler already uses (constants / instructions /
// nested functions, standard Lua 5.1 opcodes 0..37) and emits Lua source —
// in-process, memory-safe, no child process, no native binary, no JVM.
//
// MoonSec strips debug info, so (like unluac on a stripped chunk) variables are
// named by register (R0, R1, ...). The decompiler reconstructs expressions and
// the regular Lua 5.1 control-flow shapes. It is BEST-EFFORT: the caller
// validates the emitted source with a Lua parser and, if a function does not
// decompile to valid Lua, falls back to the faithful disassembly for that
// function. So the output is always valid Lua or a faithful listing — never
// silent garbage, and no external process is ever launched.
// ─────────────────────────────────────────────────────────────────────────────

const { OpCode } = require('./models.js');

const PREC = { or: 1, and: 2, cmp: 3, concat: 4, add: 5, mul: 6, unary: 7, pow: 8, atom: 99 };

const LUA_KEYWORDS = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true',
    'until', 'while',
]);

function isIdentifier(str) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(str) && !LUA_KEYWORDS.has(str);
}

function luaString(value) {
    let out = '"';
    const s = String(value);
    for (let i = 0; i < s.length; i++) {
        const ch = s[i], code = s.charCodeAt(i);
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 32 || code === 127) out += '\\' + code;
        else out += ch;
    }
    return out + '"';
}

function constToExpr(constant) {
    if (constant == null) return { s: 'nil', p: PREC.atom };
    const ctor = constant.constructor && constant.constructor.name;
    if (ctor === 'StringConstant') return { s: luaString(constant.value), p: PREC.atom };
    if (ctor === 'NumberConstant') return { s: String(constant.value), p: PREC.atom };
    if (ctor === 'BooleanConstant') return { s: constant.value ? 'true' : 'false', p: PREC.atom };
    if (ctor === 'NilConstant') return { s: 'nil', p: PREC.atom };
    return { s: String(constant.toString ? constant.toString() : constant), p: PREC.atom };
}

class FunctionDecompiler {
    constructor(fn, nameOf) {
        this.fn = fn;
        this.code = fn.instructions;
        this.nameOf = nameOf;
        this.reg = [];
        this.out = [];
        this.indent = 1;
        this.terminated = false;   // set when a return/tailcall ends the current block
    }

    R(i) { return this.reg[i] || { s: 'R' + i, p: PREC.atom }; }
    setR(i, expr) { this.reg[i] = expr; }
    RK(op) { return op >= 256 ? constToExpr(this.fn.constants[op - 256]) : this.R(op); }
    K(i) { return constToExpr(this.fn.constants[i]); }
    paren(e, min) { return e.p < min ? '(' + e.s + ')' : e.s; }
    emit(line) { this.out.push('\t'.repeat(this.indent) + line); }

    // Force register `i` to be a concrete variable name (materialise its pending
    // expression as a statement first if it is not already a simple lvalue).
    materialise(i) {
        const e = this.reg[i];
        if (!e || e.s === 'R' + i) { this.reg[i] = { s: 'R' + i, p: PREC.atom }; return 'R' + i; }
        if (/^R\d+$/.test(e.s) || /^[A-Za-z_][\w.]*$/.test(e.s)) return e.s; // already a name/path
        this.emit(`R${i} = ${e.s}`);
        this.reg[i] = { s: 'R' + i, p: PREC.atom };
        return 'R' + i;
    }

    globalName(idx) {
        const k = this.fn.constants[idx];
        const name = k && k.value !== undefined ? String(k.value) : ('G' + idx);
        return isIdentifier(name) ? { s: name, lvalue: name } : { s: `_G[${luaString(name)}]`, lvalue: `_G[${luaString(name)}]` };
    }

    indexExpr(baseExpr, keyExpr) {
        const base = this.paren(baseExpr, PREC.atom);
        const m = /^"((?:[^"\\]|\\.)*)"$/.exec(keyExpr.s);
        if (m) {
            const raw = keyExpr.s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            if (isIdentifier(raw)) return `${base}.${raw}`;
        }
        return `${base}[${keyExpr.s}]`;
    }

    target(i) { return i + 1 + this.code[i].b; }

    decompile() {
        this.walk(0, this.code.length);
        return this.out.join('\n');
    }

    walk(start, end) {
        let i = start;
        while (i < end) {
            const ins = this.code[i];
            if (!ins || ins.isDead || ins.opCode === OpCode.Unknown) { i++; continue; }
            const next = this.structured(i, end);
            if (next !== null) { i = next; }
            else { i = this.linear(i); }
            // A return/tailcall ends this block; everything after it in the same
            // block is unreachable (Lua forbids statements after `return`), so we
            // stop. The flag is scoped to this block: nested blocks consume their
            // own termination here and never leak it to the parent.
            if (this.terminated) { this.terminated = false; break; }
        }
    }

    structured(i, end) {
        const ins = this.code[i];

        // numeric for — body strictly inside the parent block
        if (ins.opCode === OpCode.ForPrep) {
            const j = this.target(i);
            if (j > i && j < end && this.code[j] && this.code[j].opCode === OpCode.ForLoop) {
                const a = ins.a;
                const init = this.paren(this.R(a), PREC.or);
                const limit = this.paren(this.R(a + 1), PREC.or);
                const stepE = this.R(a + 2);
                const varN = 'R' + (a + 3);
                const stepPart = stepE.s === '1' ? '' : ', ' + this.paren(stepE, PREC.or);
                this.emit(`for ${varN} = ${init}, ${limit}${stepPart} do`);
                this.indent++; this.walk(i + 1, j); this.indent--;
                this.emit('end');
                return j + 1;
            }
        }

        // generic for: JMP -> TFORLOOP, both inside the parent block
        if (ins.opCode === OpCode.Jmp) {
            const j = this.target(i);
            if (j > i && j < end && this.code[j] && this.code[j].opCode === OpCode.TForLoop) {
                const tf = this.code[j], a = tf.a, nvars = Math.max(tf.c, 1);
                const vars = [];
                for (let v = 0; v < nvars; v++) vars.push('R' + (a + 3 + v));
                const f = this.paren(this.R(a), PREC.or);
                const s = this.paren(this.R(a + 1), PREC.or);
                const ctrl = this.paren(this.R(a + 2), PREC.or);
                this.emit(`for ${vars.join(', ')} in ${f}, ${s}, ${ctrl} do`);
                this.indent++; this.walk(i + 1, j); this.indent--;
                this.emit('end');
                return j + 2; // skip TFORLOOP + its trailing JMP
            }
        }

        // if <cond> then ... [else ...] end
        // Shape: <test> ; JMP->j ; <then = [i+2, thenEnd)> ; [JMP->k ; else = [j, k)]
        // Every boundary is clamped to the enclosing [.., end) so blocks always
        // nest and close — the output is balanced by construction.
        if (this.isTest(ins)) {
            const jmp = this.code[i + 1];
            if (jmp && jmp.opCode === OpCode.Jmp) {
                let j = this.target(i + 1);
                if (j > i + 1 && j <= end) {
                    // Is there an else? The last instruction of the then-block is a
                    // forward JMP that skips the else-block.
                    let thenEnd = j, elseEnd = -1;
                    const beforeJ = this.code[j - 1];
                    if (beforeJ && beforeJ.opCode === OpCode.Jmp) {
                        const k = (j - 1) + 1 + beforeJ.b;
                        if (k > j && k <= end) { thenEnd = j - 1; elseEnd = k; }
                    }
                    this.emit(`if ${this.condStr(i)} then`);
                    this.indent++; this.walk(i + 2, thenEnd); this.indent--;
                    if (elseEnd !== -1) {
                        this.emit('else');
                        this.indent++; this.walk(j, elseEnd); this.indent--;
                        this.emit('end');
                        return elseEnd;
                    }
                    this.emit('end');
                    return j;
                }
            }
        }

        return null;
    }

    isTest(ins) {
        return ins.opCode === OpCode.Eq || ins.opCode === OpCode.Lt || ins.opCode === OpCode.Le ||
            ins.opCode === OpCode.Test || ins.opCode === OpCode.TestSet;
    }

    condStr(i) {
        const ins = this.code[i];
        if (ins.opCode === OpCode.Eq) return `${this.RK(ins.b).s} ${ins.a === 0 ? '==' : '~='} ${this.RK(ins.c).s}`;
        if (ins.opCode === OpCode.Lt) return `${this.RK(ins.b).s} ${ins.a === 0 ? '<' : '>'} ${this.RK(ins.c).s}`;
        if (ins.opCode === OpCode.Le) return `${this.RK(ins.b).s} ${ins.a === 0 ? '<=' : '>='} ${this.RK(ins.c).s}`;
        if (ins.opCode === OpCode.Test) return `${ins.c === 0 ? '' : 'not '}${this.paren(this.R(ins.a), PREC.unary)}`;
        return `${ins.c === 0 ? '' : 'not '}${this.paren(this.R(ins.b), PREC.unary)}`;
    }

    linear(i) {
        const ins = this.code[i], a = ins.a, b = ins.b, c = ins.c;
        switch (ins.opCode) {
            case OpCode.Move: this.setR(a, this.R(b)); return i + 1;
            case OpCode.LoadK: this.setR(a, this.K(b)); return i + 1;
            case OpCode.LoadBool:
                this.setR(a, { s: b !== 0 ? 'true' : 'false', p: PREC.atom });
                return c !== 0 ? i + 2 : i + 1; // C!=0 skips next
            case OpCode.LoadNil: {
                const names = [];
                for (let r = a; r <= b; r++) { names.push('R' + r); this.setR(r, { s: 'R' + r, p: PREC.atom }); }
                this.emit(`${names.join(', ')} = ${names.map(() => 'nil').join(', ')}`);
                return i + 1;
            }
            case OpCode.GetUpval: this.setR(a, { s: 'UPVAL' + b, p: PREC.atom }); return i + 1;
            case OpCode.SetUpval: this.emit(`UPVAL${b} = ${this.R(a).s}`); return i + 1;
            case OpCode.GetGlobal: this.setR(a, { s: this.globalName(b).s, p: PREC.atom }); return i + 1;
            case OpCode.SetGlobal: this.emit(`${this.globalName(b).lvalue} = ${this.R(a).s}`); return i + 1;
            case OpCode.GetTable: {
                const base = this.materialise(b);
                this.setR(a, { s: this.indexExpr({ s: base, p: PREC.atom }, this.RK(c)), p: PREC.atom });
                return i + 1;
            }
            case OpCode.SetTable: {
                const base = this.materialise(a);
                this.emit(`${this.indexExpr({ s: base, p: PREC.atom }, this.RK(b))} = ${this.RK(c).s}`);
                return i + 1;
            }
            case OpCode.NewTable:
                this.emit(`R${a} = {}`); this.setR(a, { s: 'R' + a, p: PREC.atom }); return i + 1;
            case OpCode.Self: {
                const base = this.materialise(b);
                this.setR(a + 1, { s: base, p: PREC.atom });
                // mark this as a method target: remember method name for a following Call
                const key = this.RK(c);
                const m = /^"((?:[^"\\]|\\.)*)"$/.exec(key.s);
                const method = m && isIdentifier(m[1]) ? m[1] : null;
                this.setR(a, { s: this.indexExpr({ s: base, p: PREC.atom }, key), p: PREC.atom, method, methodBase: base });
                return i + 1;
            }
            case OpCode.Add: return this.binop(i, '+', PREC.add);
            case OpCode.Sub: return this.binop(i, '-', PREC.add);
            case OpCode.Mul: return this.binop(i, '*', PREC.mul);
            case OpCode.Div: return this.binop(i, '/', PREC.mul);
            case OpCode.Mod: return this.binop(i, '%', PREC.mul);
            case OpCode.Pow: return this.binop(i, '^', PREC.pow);
            case OpCode.Unm: this.setR(a, { s: '-' + this.paren(this.R(b), PREC.unary), p: PREC.unary }); return i + 1;
            case OpCode.Not: this.setR(a, { s: 'not ' + this.paren(this.R(b), PREC.unary), p: PREC.unary }); return i + 1;
            case OpCode.Len: this.setR(a, { s: '#' + this.paren(this.R(b), PREC.unary), p: PREC.unary }); return i + 1;
            case OpCode.Concat: {
                const parts = [];
                for (let r = b; r <= c; r++) parts.push(this.paren(this.R(r), PREC.concat + 1));
                this.setR(a, { s: parts.join(' .. '), p: PREC.concat }); return i + 1;
            }
            case OpCode.Call: return this.call(i, false);
            case OpCode.TailCall: return this.call(i, true);
            case OpCode.Return: {
                this.terminated = true;
                if (b === 1) { this.emit('return'); return i + 1; }
                const vals = [];
                const upper = b === 0 ? a + 1 : a + b - 1;
                for (let r = a; r < upper; r++) vals.push(this.R(r).s);
                this.emit('return ' + vals.join(', ')); return i + 1;
            }
            case OpCode.Closure: this.setR(a, { s: this.nameOf(this.fn.functions[b]), p: PREC.atom }); return i + 1;
            case OpCode.VarArg: this.setR(a, { s: '...', p: PREC.atom }); return i + 1;
            case OpCode.SetList: {
                const base = this.materialise(a);
                for (let r = 1; r <= b; r++) this.emit(`${base}[${r}] = ${this.R(a + r).s}`);
                return i + 1;
            }
            case OpCode.Jmp: this.emit(`-- jmp -> ${this.target(i)}`); return i + 1;
            case OpCode.Eq: case OpCode.Lt: case OpCode.Le:
            case OpCode.Test: case OpCode.TestSet:
                this.emit(`-- cond ${this.condStr(i)}`); return i + 1;
            case OpCode.ForLoop: case OpCode.ForPrep: case OpCode.TForLoop:
            case OpCode.Close: return i + 1;
            default: this.emit(`-- op ${ins.opNum}`); return i + 1;
        }
    }

    binop(i, op, prec) {
        const ins = this.code[i];
        const l = this.RK(ins.b), r = this.RK(ins.c);
        const s = `${this.paren(l, prec)} ${op} ${this.paren(r, op === '^' || op === '-' || op === '/' || op === '%' ? prec + 1 : prec + 1)}`;
        this.setR(ins.a, { s, p: prec });
        return i + 1;
    }

    call(i, isTail) {
        const ins = this.code[i], a = ins.a, b = ins.b, c = ins.c;
        const argc = b === 0 ? 0 : b - 1;
        const calleeExpr = this.R(a);
        let callStr;
        if (calleeExpr.method && calleeExpr.methodBase) {
            // method call: base:method(args) — skip the implicit self at R(a+1)
            const args = [];
            for (let r = 2; r <= argc; r++) args.push(this.R(a + r).s);
            callStr = `${calleeExpr.methodBase}:${calleeExpr.method}(${args.join(', ')})`;
        } else {
            const args = [];
            for (let r = 1; r <= argc; r++) args.push(this.R(a + r).s);
            callStr = `${this.paren(calleeExpr, PREC.atom)}(${args.join(', ')})`;
        }

        if (isTail) { this.emit('return ' + callStr); this.terminated = true; return i + 1; }
        const nres = c === 0 ? 1 : c - 1;
        if (nres === 0) { this.emit(callStr); }
        else if (nres === 1) { this.emit(`R${a} = ${callStr}`); this.setR(a, { s: 'R' + a, p: PREC.atom }); }
        else {
            const names = [];
            for (let r = 0; r < nres; r++) { names.push('R' + (a + r)); }
            this.emit(`${names.join(', ')} = ${callStr}`);
            for (let r = 0; r < nres; r++) this.setR(a + r, { s: 'R' + (a + r), p: PREC.atom });
        }
        return i + 1;
    }
}

class Decompiler {
    constructor(rootFunction, DisassemblerClass) {
        this.root = rootFunction;
        this.Disassembler = DisassemblerClass;
        this._counter = 0;
        this._names = new Map();
        this._order = [];
    }

    nameOf(fn) {
        if (!this._names.has(fn)) {
            this._names.set(fn, 'func' + (this._counter++));
            this._order.push(fn);
        }
        return this._names.get(fn);
    }

    collect(fn) {
        for (const child of fn.functions) { this.nameOf(child); this.collect(child); }
    }

    bodyOf(fn) {
        try {
            const d = new FunctionDecompiler(fn, (child) => this.nameOf(child));
            return d.decompile();
        } catch (e) {
            try {
                const dis = new this.Disassembler(fn).disassemble();
                return dis.split('\n').map(l => '\t-- ' + l).join('\n');
            } catch (_) {
                return `\t-- [decompilation failed: ${(e && e.message) || 'error'}]`;
            }
        }
    }

    params(fn) {
        const p = [];
        for (let i = 0; i < fn.numParams; i++) p.push('R' + i);
        if (fn.isVarArgFlag === 2 || fn.isVarArgFlag === 7) p.push('...');
        return p.join(', ');
    }

    decompile() {
        this.collect(this.root);
        const lines = ['-- Decompiled by Novix (pure-JS Lua 5.1 decompiler)'];
        // Forward-declare nested functions so Closure references resolve.
        if (this._order.length) {
            lines.push('local ' + this._order.map(f => this._names.get(f)).join(', '));
        }
        // Define each nested function.
        for (const fn of this._order) {
            lines.push(`${this._names.get(fn)} = function(${this.params(fn)})`);
            lines.push(this.bodyOf(fn));
            lines.push('end');
        }
        // Root chunk body.
        lines.push(this.bodyOf(this.root));
        return lines.join('\n');
    }
}

module.exports = { Decompiler, FunctionDecompiler };
