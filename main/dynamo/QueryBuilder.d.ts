import { DynamoDB } from "aws-sdk";
import { KeysOf } from "main/typeUtils";
declare type Operator = "=" | "<>" | "<" | "<=" | ">" | ">=";
/** Builds and executes parameters for a DynamoDB Query operation */
export declare class QueryBuilder<T> {
    private db;
    private tableName;
    private pk;
    private filterExp;
    private filterValues;
    constructor(db: DynamoDB.DocumentClient, tableName: string, pk: string);
    where(attribute: KeysOf<T>, operator: Operator, value: any): this;
    or(attribute: KeysOf<T>, operator: Operator, value: any): this;
    and(attribute: KeysOf<T>, operator: Operator, value: any): this;
    attributeExists(name: KeysOf<T>): this;
    attributeNotExists(name: KeysOf<T>): this;
    exec(): Promise<T[]>;
    private addCondition;
    private build;
}
export {};
