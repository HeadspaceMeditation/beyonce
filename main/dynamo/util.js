"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function toJSON(item) {
    delete item.pk;
    delete item.sk;
    return item;
}
exports.toJSON = toJSON;
//# sourceMappingURL=util.js.map