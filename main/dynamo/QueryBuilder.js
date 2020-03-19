"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
/** Builds and executes parameters for a DynamoDB Query operation */
class QueryBuilder {
    constructor(db, tableName, pk) {
        this.db = db;
        this.tableName = tableName;
        this.pk = pk;
        this.filterExp = [];
        this.filterValues = {};
    }
    where(attribute, operator, value) {
        return this.addCondition(`${attribute} ${operator} :${attribute}`, {
            [`:${attribute}`]: value
        });
    }
    or(attribute, operator, value) {
        return this.addCondition(`OR ${attribute} ${operator} :${attribute}`, {
            [`:${attribute}`]: value
        });
    }
    and(attribute, operator, value) {
        return this.addCondition(`AND ${attribute} ${operator} :${attribute}`, {
            [`:${attribute}`]: value
        });
    }
    attributeExists(name) {
        this.filterExp.push(`attribute_exists(${name})`);
        return this;
    }
    attributeNotExists(name) {
        this.filterExp.push(`attribute_not_exists(${name})`);
        return this;
    }
    exec() {
        return __awaiter(this, void 0, void 0, function* () {
            const { Items: items } = yield this.db.query(this.build()).promise();
            if (items !== undefined) {
                return items.map(_ => util_1.toJSON(_));
            }
            else {
                return [];
            }
        });
    }
    addCondition(exp, values) {
        this.filterExp.push(exp);
        this.filterValues = Object.assign(Object.assign({}, this.filterValues), values);
        return this;
    }
    build() {
        const filter = this.filterExp.join(" ");
        return {
            TableName: this.tableName,
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: Object.assign(Object.assign({}, this.filterValues), { ":pk": this.pk }),
            FilterExpression: filter !== "" ? filter : undefined
        };
    }
}
exports.QueryBuilder = QueryBuilder;
//# sourceMappingURL=QueryBuilder.js.map