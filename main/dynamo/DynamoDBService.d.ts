import { DynamoDB } from "aws-sdk";
import { Key } from "./Key";
import { Model } from "./Model";
import { QueryBuilder } from "./QueryBuilder";
declare type KeyInput<T extends Model, U> = [Key<T, U>, U];
declare type PartitionAndSortKey<T extends Model, U, V extends Model, X> = {
    partition: KeyInput<T, U>;
    sort: KeyInput<V, X>;
};
/** A thin wrapper around the DynamoDB sdk client that
 * does auto mapping between JSON <=> DynamoDB Items
 */
export declare class DynamoDBService {
    private tableName;
    private client;
    constructor(tableName: string, dynamo?: DynamoDB);
    /** Retrieve a single Item out of Dynamo */
    get<T extends Model, U, V extends Model, X>(keys: PartitionAndSortKey<T, U, V, X>): Promise<V | undefined>;
    /** BatchGet items */
    batchGet<T extends Model>(params: {
        keys: {
            partition: string;
            sort: string;
        }[];
    }): Promise<T[]>;
    query<T extends Model, U>(partition: Key<T, U>, keyParts: U): QueryBuilder<T>;
    /** Write an item into Dynamo */
    put<T extends Model, U, V extends Model, X>(keys: PartitionAndSortKey<T, U, V, X>, fields: V): Promise<void>;
}
export {};
