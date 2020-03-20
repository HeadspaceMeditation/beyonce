import yaml from "js-yaml"
import * as path from "path"
import * as prettier from "prettier"
import { generateModelInterfaces } from "./generateModelInterface"
import { generateModelTypeEnum } from "./generateModelTypeEnum"
import { generateTables } from "./generateTables"
import { ModelDefinitions, Table } from "./types"

export function generateModels(yamlData: string): string {
  const config = parseYaml<ModelDefinitions>(yamlData)
  const tableDefs = toTables(config)

  const models = tableDefs
    .map(({ models }) => models)
    .reduce((a, b) => a.concat(b))

  const modelInterfaces = generateModelInterfaces(models)
  const modelTypeEnum = generateModelTypeEnum(models)
  const tables = generateTables(tableDefs)

  const imports = new Set([`import { key, Model } from "@ginger.io/beyonce"`])
  modelInterfaces.imports.forEach(_ => imports.add(_))

  const code = `
      ${Array.from(imports).join("\n")}

      ${modelTypeEnum}

      ${modelInterfaces.code.join("\n\n")}

      ${tables}
    `

  return prettier.format(code, {
    parser: "typescript",
    semi: false
  })
}

function toTables(config: ModelDefinitions): Table[] {
  const tables: Table[] = []

  Object.entries(config.Tables).forEach(([name, { Partitions, Models }]) => {
    const table: Table = {
      name,
      partitions: Partitions,
      models: []
    }

    Object.entries(Models).forEach(([name, { partition, sort, ...fields }]) => {
      table.models.push({
        name,
        partition,
        sort,
        fields
      })
    })

    tables.push(table)
  })

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
