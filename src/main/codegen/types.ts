export type YAMLFile = {
  Tables: {
    [tableName: string]: TableDefinition
  }
}

export type TableDefinition = {
  Partitions: {
    [partitionName: string]: PartitionDefinition
  }

  GSIs?: { [indexName: string]: GSIDefinition }
}

export type PartitionDefinition = {
  [modelName: string]: ModelDefinition
}

export type ModelDefinition = Keys & Fields
export type Keys = { partitionKey: [string, string]; sortKey: [string, string] }
export type Fields = { [fieldName: string]: string }

export type GSIDefinition = {
  partitionKey: string
  sortKey: string
}

export type Table = {
  name: string
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
  keys: Keys
  fields: Fields
}
