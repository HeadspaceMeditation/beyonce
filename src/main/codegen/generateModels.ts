import yaml from "js-yaml"
import * as path from "path"
import * as prettier from "prettier"
import { generateModelInterfaces } from "./generateModelInterface"
import { generateModelTypeEnum } from "./generateModelTypeEnum"
import { generateTables } from "./generateTables"
import { ModelDefinitions, Table } from "./types"
import { generateModelHelpers } from "./generateModelHelpers"
import { generateTaggedUnion } from "./generateTaggedUnion"

export function generateModels(yamlData: string): string {
  const config = parseYaml<ModelDefinitions>(yamlData)
  const tableDefs = toTables(config)

  const models = tableDefs
    .map(({ models }) => models)
    .reduce((a, b) => a.concat(b))

  const modelInterfaces = generateModelInterfaces(models)
  const modelTypeEnum = generateModelTypeEnum(models)
  const tables = generateTables(tableDefs)
  const taggedUnion = generateTaggedUnion(models)

  const imports = new Set([`import { key } from "@ginger.io/beyonce"`])
  modelInterfaces.imports.forEach((_) => imports.add(_))

  const modelHelpers = generateModelHelpers(models)

  const code = `
      ${Array.from(imports).join("\n")}

      ${modelTypeEnum}

      ${modelInterfaces.code.join("\n\n")}

      ${modelHelpers}

      ${taggedUnion}

      ${tables}
    `

  return prettier.format(code, {
    parser: "typescript",
    semi: false,
  })
}

function toTables(config: ModelDefinitions): Table[] {
  const tables: Table[] = []

  Object.entries(config.Tables).forEach(
    ([name, { Partitions, Models, GSIs }]) => {
      const table: Table = {
        name,
        partitionKeyName: "pk",
        sortKeyName: "sk",
        partitions: Partitions,
        gsis: [],
        models: [],
      }

      if (GSIs !== undefined) {
        Object.entries(GSIs).forEach(([name, { partition, sort }]) => {
          table.gsis.push({ name, partition, sort })
        })
      }

      Object.entries(Models).forEach(
        ([name, { partition, sort, ...fields }]) => {
          table.models.push({
            name,
            partition,
            sort,
            fields,
          })
        }
      )

      tables.push(table)
    }
  )

  return tables
}

function parseYaml<T>(yamlData: string): T {
  try {
    return yaml.safeLoad(yamlData)
  } catch (e) {
    console.error(`Failed to load yaml file ${path}`)
    throw e
  }
}
