export type Keys = { partition: string; sort: string[] }
export type Fields = { [fieldName: string]: string }
export type ModelDefinition = Keys & Fields

export type ModelDefinitions = {
  Tables: {
    [tableName: string]: {
      Partitions: { [partition: string]: string[] }
      Models: { [modelName: string]: ModelDefinition }
    }
  }
}

export type Table = {
  name: string
  partitions: { [partition: string]: string[] }
  models: Model[]
}

export type Model = {
  name: string
  partition: string
  sort: string[]
  fields: Fields
}
