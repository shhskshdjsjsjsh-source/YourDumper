'use strict';






const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const { PrettyPrinter } = require('../ast/pretty-printer.js');

// ── Security ──────────────────────────────────────────────────────────────
// This helper folds a *numeric constant key expression* lifted from the AST of
// an UNTRUSTED, attacker-supplied script. It used to `luaL_openlibs` (opening
// os, io, package, debug, load/loadstring, ...) and then execute a string built
// from that attacker input via loadstring + pcall. Under Node, fengari's os/io
// libraries can reach process state and the filesystem, so a crafted MoonSec
// script whose "key expression" rendered to e.g. `os.getenv(...)`, `io.open(...)`
// or `load(...)` could read server files or run arbitrary Lua in the subprocess.
//
// Fix: before evaluating, strip every host-reaching / code-loading global from
// the Lua state. Only arithmetic and the pure math/string/table libraries stay,
// which is all a key expression ever legitimately needs. The expression length
// is also capped as a cheap backstop against pathological input.
const _DANGEROUS_GLOBALS = [
    'os', 'io', 'package', 'require', 'dofile', 'loadfile', 'load',
    'loadstring', 'debug', 'collectgarbage', 'getfenv', 'setfenv',
    'newproxy', 'coroutine', 'print',
];

const MAX_EXPR_LEN = 100000; // a numeric key expression is tiny; this is huge headroom

function _lockdown(L) {
    // Remove dangerous entries from the global table (_G). Setting a global to
    // nil also clears _G[name], so there is no `_G.os` back-door either.
    for (const name of _DANGEROUS_GLOBALS) {
        lua.lua_pushnil(L);
        lua.lua_setglobal(L, to_luastring(name));
    }
}

function solveKeyExpression(node) {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);
    _lockdown(L);

    try {
        const expr = PrettyPrinter.asString(node);
        if (typeof expr !== 'string' || expr.length > MAX_EXPR_LEN) {
            throw new Error('Key expression too large to evaluate.');
        }
        const code = `return (${expr})`;
        const status = lauxlib.luaL_loadstring(L, to_luastring(code));

        if (status !== lua.LUA_OK) {
            throw new Error(`Lua syntax error: ${lua.lua_tostring(L, -1)}`);
        }

        const result = lua.lua_pcall(L, 0, 1, 0);

        if (result !== lua.LUA_OK) {
            throw new Error(`Lua runtime error: ${lua.lua_tostring(L, -1)}`);
        }

        return lua.lua_tonumber(L, -1);
    } finally {
        lua.lua_close(L);
    }
}

module.exports = { solveKeyExpression };