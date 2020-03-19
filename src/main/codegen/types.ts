export type Keys = { partition: string; sort: string[] }
export type Fields = { [fieldName: string]: string }
export type ModelDefinition = Keys & Fields

export type ModelDefinitions = {
  Partitions: { [partition: string]: string[] }
  Models: { [modelName: string]: ModelDefinition }
}

export type Model = {
  name: string
  partition: Keys["partition"]
  sk: string[]
  fields: Fields
}

export type ModelSet = Model[]
