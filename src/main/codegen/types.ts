export type YAMLFile = {
  tables: {
    [tableName: string]: TableDefinition
  }
}

export type DelimiterType = "-" | "#"
export type TableDefinition = {
  delimiter: DelimiterType
  models: {
    [modelName: string]: ModelDefinition
  }
  partitionKeyName: string,
  sortKeyName: string
  partitions: {
    [partitionName: string]: PartitionDefinition
  }

  gsis?: { [indexName: string]: GSIDefinition }
}

export type PartitionDefinition = {
  partitionKeyPrefix: string
  models: {
    [modelName: string]: ModelKeys
  }
}

export type ModelKeys = { partitionKey: string[]; sortKey: string[] }
export type ModelDefinition = { [fieldName: string]: string }

export type GSIDefinition = {
  partitionKey: string
  sortKey: string
}

export type Table = {
  name: string
  delimiter: DelimiterType
  partitionKeyName: string
  sortKeyName: string
  partitions: Partition[]
  gsis: GSI[]
}

export type Partition = {
  tableName: string
  name: string
  models: Model[]
}

export type GSI = {
  name: string
  partitionKey: string
  sortKey: string
}

export type Model = {
  tableName: string
  partitionName: string
  name: string
  keys: ModelKeys
  fields: ModelDefinition
}
