'use strict';

class NodeList extends Array {
    static of(...items) {
        const list = new NodeList();
        list.push(...items);
        return list;
    }

    clone() {
        return NodeList.of(...this.map(item => item.clone()));
    }
}

module.exports = { NodeList };
