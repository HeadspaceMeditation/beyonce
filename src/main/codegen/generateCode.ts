import yaml from "js-yaml"
import * as path from "path"
import * as prettier from "prettier"
import { generateGSIs } from "./generateGSIs"
import { generateModelInterfaces } from "./generateModelInterface"
import { generateModels } from "./generateModels"
import { generateModelTypeEnum } from "./generateModelTypeEnum"
import { generatePartitions } from "./generatePartitions"
import { generateTables } from "./generateTables"
import { generateTaggedUnion } from "./generateTaggedUnion"
import { Model, Partition, PartitionDefinition, Table, TableDefinition, YAMLFile } from "./types"

export function generateCode(yamlData: string): string {
  const config = parseYaml<YAMLFile>(yamlData)
  const tableDefs = toTables(config)

  const models: Model[] = []
  const partitions: Partition[] = []

  tableDefs.forEach((t) => {
    t.partitions.forEach((p) => {
      partitions.push(p)
      p.models.forEach((m) => {
        models.push(m)
      })
    })
  })

  const modelInterfaces = generateModelInterfaces(models)
  const modelDefinitions = generateModels(models)
  const modelTypeEnum = generateModelTypeEnum(models)
  const tables = generateTables(tableDefs)
  const partitionDefinitions = generatePartitions(partitions)
  const taggedUnion = generateTaggedUnion(models)
  const gsis = generateGSIs(tableDefs)

  const imports = new Set([`import { Table } from "@ginger.io/beyonce"`])
  modelInterfaces.imports.forEach((_) => imports.add(_))

  const code = `
      ${Array.from(imports).join("\n")}

      ${tables}

      ${modelTypeEnum}

      ${modelInterfaces.code.join("\n\n")}

      ${modelDefinitions.join("\n\n")}

      ${taggedUnion}

      ${partitionDefinitions}

      ${gsis}
    `

  return prettier.format(code, {
    parser: "typescript",
    semi: false,
    trailingComma: "none"
  })
}

function toTables(config: YAMLFile): Table[] {
  const tables: Table[] = []

  Object.entries(config.tables).forEach(([name, { models, partitions, gsis }]) => {
    const table: Table = {
      name,
      partitionKeyName: "pk",
      sortKeyName: "sk",
      partitions: buildPartitions(name, models, partitions),
      gsis: []
    }

    if (gsis !== undefined) {
      Object.entries(gsis).forEach(([name, { partitionKey, sortKey }]) => {
        table.gsis.push({ name, partitionKey, sortKey })
      })
    }

    tables.push(table)
  })

  return tables
}

function buildPartitions(
  tableName: string,
  modelDefinitions: TableDefinition["models"],
  partitionDefinitions: TableDefinition["partitions"]
): Partition[] {
  return Object.entries(partitionDefinitions).map(([partitionName, partition]) => ({
    tableName,
    name: partitionName,
    models: buildModels(tableName, partitionName, partition, modelDefinitions)
  }))
}

function buildModels(
  tableName: string,
  partitionName: string,
  partition: PartitionDefinition,
  modelDefinitions: TableDefinition["models"]
): Model[] {
  return Object.entries(partition.models).map(([modelName, { partitionKey, sortKey }]) => {
    const partitionKeyWithPrefix = [partition.partitionKeyPrefix, ...partitionKey]

    const fields = modelDefinitions[modelName]
    if (!fields) {
      throw new Error(`${modelName} is defined in a YAML partition, but does not appear in your models list`)
    }

    return {
      tableName,
      partitionName,
      name: modelName,
      keys: { partitionKey: partitionKeyWithPrefix, sortKey },
      fields
    }
  })
}

function parseYaml<T>(yamlData: string): T {
  try {
    return yaml.safeLoad(yamlData)
  } catch (e) {
    console.error(`Failed to load yaml file ${path}`)
    throw e
  }
}
