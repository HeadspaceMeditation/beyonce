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
const aws_sdk_1 = require("aws-sdk");
const QueryBuilder_1 = require("./QueryBuilder");
const util_1 = require("./util");
/** A thin wrapper around the DynamoDB sdk client that
 * does auto mapping between JSON <=> DynamoDB Items
 */
class DynamoDBService {
    constructor(tableName, dynamo = new aws_sdk_1.DynamoDB()) {
        this.tableName = tableName;
        this.client = new aws_sdk_1.DynamoDB.DocumentClient({ service: dynamo });
    }
    /** Retrieve a single Item out of Dynamo */
    get(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const [pk, pkParts] = keys.partition;
            const [sk, skParts] = keys.sort;
            const { Item: item } = yield this.client
                .get({
                TableName: this.tableName,
                Key: {
                    pk: pk.key(pkParts),
                    sk: sk.key(skParts)
                }
            })
                .promise();
            if (item !== undefined) {
                return util_1.toJSON(item);
            }
        });
    }
    /** BatchGet items */
    batchGet(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { Responses: responses, UnprocessedKeys: unprocessedKeys } = yield this.client
                .batchGet({
                RequestItems: {
                    [this.tableName]: {
                        Keys: params.keys.map(({ partition, sort }) => ({
                            pk: partition,
                            sk: sort
                        }))
                    }
                }
            })
                .promise();
            if (unprocessedKeys !== undefined) {
                console.error("Some keys didn't process", unprocessedKeys);
            }
            if (responses !== undefined) {
                const items = responses[this.tableName];
                return items.map(_ => util_1.toJSON(_));
            }
            else {
                return [];
            }
        });
    }
    query(partition, keyParts) {
        return new QueryBuilder_1.QueryBuilder(this.client, this.tableName, partition.key(keyParts));
    }
    /** Write an item into Dynamo */
    put(keys, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const [pk, pkParts] = keys.partition;
            const [sk, skParts] = keys.sort;
            yield this.client
                .put({
                TableName: this.tableName,
                Item: Object.assign(Object.assign({}, fields), { pk: pk.key(pkParts), sk: sk.key(skParts) })
            })
                .promise();
        });
    }
}
exports.DynamoDBService = DynamoDBService;
//# sourceMappingURL=DynamoDBService.js.map