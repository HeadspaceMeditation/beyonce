export type Keys = { partition: string; sort: string[] }
export type Fields = { [fieldName: string]: string }
export type ModelDefinition = Keys & Fields

export type GSIDefinition = {
  partition: string
  sort: string
}

export type ModelDefinitions = {
  Tables: {
    [tableName: string]: {
      Partitions: { [partition: string]: string[] }
      GSIs?: { [indexName: string]: GSIDefinition }
      Models: { [modelName: string]: ModelDefinition }
    }
  }
}

export type Table = {
  name: string
  partitionKeyName: string
  sortKeyName: string
  partitions: { [partition: string]: string[] }
  gsis: GSI[]
  models: Model[]
}

export type GSI = {
  name: string
  partition: string
  sort: string
}

export type Model = {
  tableName: string
  name: string
  partition: string
  sort: string[]
  fields: Fields
}
