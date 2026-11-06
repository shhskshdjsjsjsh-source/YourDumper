'use strict';

function decodeEscape(data) {
    const parts = data.split('\\').slice(1);
    const bytes = new Uint8Array(parts.length);

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(parts[i], 10);
    }

    return bytes;
}

function decode(data, key) {
    const dataLen = data.length;
    const decoded = new Uint8Array(Math.floor((dataLen - 16) / 2));
    const chars = new Map();

    for (let i = 0; i < 16; i++) {
        chars.set(data[i], i);
    }

    let rkey = key;
    let outIdx = 0;

    for (let i = 16; i < dataLen; i += 2) {
        const c1 = data[i];
        const c2 = i + 1 < dataLen ? data[i + 1] : '\u0000';

        const i1 = chars.has(c1) ? chars.get(c1) : 0;
        const i2 = chars.has(c2) ? chars.get(c2) : 0;

        decoded[outIdx++] = ((i1 * 16 + i2 + rkey) % 256) & 0xff;
        rkey += key;
    }

    return decoded;
}

function decodeConstants(data) {
    const constants = new Map();
    let offset = 0;

    while (true) {
        let control = data[offset++];

        if (control === 5) {
            break;
        }

        if (control === 1) {
            control++;
        }

        const size = data[offset++];
        const firstBytes = data.slice(offset, offset + size);
        offset += size;
        const first = new TextDecoder().decode(firstBytes);

        let value = null;

        switch (control) {
            case 0: {
                const strSize = data[offset++];
                const secondBytes = data.slice(offset, offset + strSize);
                offset += strSize;
                const second = new TextDecoder().decode(secondBytes);
                value = [first, second];
                break;
            }
            case 2:
            case 4:
            case 6:
                value = [first];
                break;
        }

        const keyBytes = data.slice(offset, offset + 8);
        offset += 8;
        const key = new TextDecoder().decode(keyBytes);
        constants.set(key, value);
    }

    const result = {};
    for (const [k, v] of constants) {
        result[k] = v;
    }

    return result;
}

function decodeConstant(key, bytes) {
    if (!(bytes.length > 1 && bytes[0] > 0x7f)) {
        return new TextDecoder().decode(bytes);
    }

    const newBytes = new Uint8Array(bytes.length - 1);
    for (let i = 1; i < bytes.length; i++) {
        newBytes[i - 1] = ((bytes[i] + key) % 256) & 0xff;
    }

    return new TextDecoder().decode(newBytes);
}

module.exports = { decodeEscape, decode, decodeConstants, decodeConstant };