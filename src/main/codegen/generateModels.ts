import yaml from "js-yaml"
import * as path from "path"
import * as prettier from "prettier"
import { generateModelInterfaces } from "./generateModelInterface"
import { generateModelTypeEnum } from "./generateModelTypeEnum"
import { generatePartitionKeys } from "./generatePartitionKeys"
import { generateSortKeys } from "./generateSortKeys"
import { ModelDefinitions, ModelSet } from "./types"

export function generateModels(yamlData: string): string {
  const { Models, Partitions } = parseYaml<ModelDefinitions>(yamlData)
  const partitionKeys = Partitions
  const models: ModelSet = []

  Object.entries(Models).forEach(([name, { partition, sort, ...fields }]) =>
    models.push({
      name,
      partition,
      sk: sort,
      fields
    })
  )

  const modelInterfaces = generateModelInterfaces(models)
  const modelTypeEnum = generateModelTypeEnum(models)
  const partitions = generatePartitionKeys(models, partitionKeys)
  const sortKeys = generateSortKeys(models)

  const imports = new Set([
    `import { Key } from "main/dynamo/Key"`,
    `import { Model } from "main/dynamo/Model"`
  ])
  modelInterfaces.imports.forEach(_ => imports.add(_))

  const code = `
      ${Array.from(imports).join("\n")}

      ${modelTypeEnum}

      ${modelInterfaces.code.join("\n\n")}

      ${partitions}

      ${sortKeys}
    `

  return prettier.format(code, {
    parser: "typescript",
    semi: false
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
