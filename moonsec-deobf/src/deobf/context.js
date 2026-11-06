'use strict';

class Context {
    constructor() {
        this.identifiedNames = {};
        this.keyExpressions = [];
        this.protoFormat = [];
        this.constantFormat = {};
        this.wrapper = undefined;
        this.vmTree = undefined;
        this.bytecodeString = undefined;
        this.bytecodeKey = 0;
        this.constantKey = 0;
    }
}

module.exports = { Context };