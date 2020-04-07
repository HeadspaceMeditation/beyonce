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
import { Model, Partition, Table, TableDefinition, YAMLFile } from "./types"

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
  })
}

function toTables(config: YAMLFile): Table[] {
  const tables: Table[] = []

  Object.entries(config.Tables).forEach(([name, { Partitions, GSIs }]) => {
    const table: Table = {
      name,
      partitionKeyName: "pk",
      sortKeyName: "sk",
      partitions: toPartitions(name, Partitions),
      gsis: [],
    }

    if (GSIs !== undefined) {
      Object.entries(GSIs).forEach(([name, { partitionKey, sortKey }]) => {
        table.gsis.push({ name, partitionKey, sortKey })
      })
    }

    tables.push(table)
  })

  return tables
}

function toPartitions(
  tableName: string,
  partitionDefs: TableDefinition["Partitions"]
): Partition[] {
  const partitions = Object.entries(partitionDefs).map(
    ([partitionName, partition]) => {
      const models = Object.entries(partition).map(([modelName, model]) => {
        const { partitionKey, sortKey, ...fields } = model
        return {
          tableName,
          partitionName,
          name: modelName,
          keys: { partitionKey, sortKey },
          fields,
        }
      })

      return {
        tableName,
        name: partitionName,
        models,
      }
    }
  )

  return partitions
}

function parseYaml<T>(yamlData: string): T {
  try {
    return yaml.safeLoad(yamlData)
  } catch (e) {
    console.error(`Failed to load yaml file ${path}`)
    throw e
  }
}
