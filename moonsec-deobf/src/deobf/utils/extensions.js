'use strict';

function windowedByDiscardedPairs(source, predicate) {
    const results = [];
    const iterator = source[Symbol.iterator]();
    const first = iterator.next();

    if (first.done) {
        return results;
    }

    let window = [first.value];
    let previous = first.value;

    for (let next = iterator.next(); !next.done; next = iterator.next()) {
        const current = next.value;

        if (predicate(previous, current)) {
            results.push(window.length > 1 ? window.slice(0, -1) : []);
            window = [];
            previous = undefined;
            continue;
        }

        window.push(current);
        previous = current;
    }

    if (window.length > 0) {
        results.push(window);
    }

    return results;
}

module.exports = { windowedByDiscardedPairs };