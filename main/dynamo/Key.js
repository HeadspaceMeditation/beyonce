"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Key {
    constructor(createKey) {
        this.createKey = createKey;
    }
    key(input) {
        return this.createKey(input).join("|");
    }
}
exports.Key = Key;
//# sourceMappingURL=Key.js.map