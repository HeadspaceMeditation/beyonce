import { DynamoDB } from "aws-sdk"
import { GSI, GSIBuilder } from "./GSI"
import { Model, PartitionKeyBuilder } from "./Model"
import { Partition } from "./Partition"
import { TaggedModel } from "./types"
import { DelimiterType } from "../codegen/types";

export class Table<PK extends string = string, SK extends string = string> {
  readonly tableName: string
  readonly partitionKeyName: PK
  readonly sortKeyName: SK
  readonly delimiter: DelimiterType
  private modelTags: string[] = []
  private encryptionBlacklist: Set<string>
  private gsis: GSI<string, string, any>[] = []

  constructor(config: { name: string; delimiter: DelimiterType, partitionKeyName: PK; sortKeyName: SK; encryptionBlacklist?: string[] }) {
    this.tableName = config.name
    this.partitionKeyName = config.partitionKeyName
    this.sortKeyName = config.sortKeyName
    this.delimiter = config.delimiter

    this.encryptionBlacklist = new Set([
      "model",
      "__jayz__metadata",
      this.partitionKeyName,
      this.sortKeyName,
      ...(config.encryptionBlacklist ?? [])
    ])
  }

  model<T extends TaggedModel>(modelType: T["model"]): PartitionKeyBuilder<T> {
    this.modelTags.push(modelType)
    return new PartitionKeyBuilder(this, modelType)
  }

  partition<T extends Model<any, any, any>, U extends Model<any, any, any>>(models: [T, ...U[]]): Partition<T, U> {
    return new Partition(models)
  }

  gsi(name: string): GSIBuilder<PK, SK> {
    return new GSIBuilder(this, name)
  }

  registerGSI(gsi: GSI<string, string, any>) {
    this.gsis.push(gsi)
    this.encryptionBlacklist.add(gsi.partitionKeyName)
    this.encryptionBlacklist.add(gsi.sortKeyName)
  }

  getEncryptionBlacklist(): Set<string> {
    return this.encryptionBlacklist
  }

  getModelTags(): string[] {
    return this.modelTags
  }

  asCreateTableInput(billingMode: DynamoDB.Types.BillingMode): DynamoDB.Types.CreateTableInput {
    const attributeSet = new Set([
      this.partitionKeyName,
      this.sortKeyName,
      "model",
      ...this.gsis.flatMap((_) => [_.partitionKeyName, _.sortKeyName])
    ])

    const attributeDefinitions: DynamoDB.Types.AttributeDefinitions = Array.from(attributeSet).map((attr) => ({
      AttributeName: attr,
      AttributeType: "S"
    }))

    return {
      TableName: this.tableName,

      KeySchema: [
        { AttributeName: this.partitionKeyName, KeyType: "HASH" },
        { AttributeName: this.sortKeyName, KeyType: "RANGE" }
      ],

      AttributeDefinitions: attributeDefinitions,
      GlobalSecondaryIndexes: this.gsis.map(({ name, partitionKeyName, sortKeyName }) => ({
        IndexName: name,
        KeySchema: [
          { AttributeName: partitionKeyName, KeyType: "HASH" },
          { AttributeName: sortKeyName, KeyType: "RANGE" }
        ],
        Projection: {
          ProjectionType: "ALL"
        }
      })),

      BillingMode: billingMode
    }
  }
}
