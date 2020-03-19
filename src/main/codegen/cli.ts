#!/usr/bin/env node

import * as fs from "fs"
import * as path from "path"
import { argv } from "yargs"
import { generateModels } from "./generateModels"

if (argv.in !== undefined && argv.out !== undefined) {
  const inputFile = argv.in as string
  const outputFile = argv.out as string
  generateFile(inputFile, outputFile)
  process.exit(0)
} else {
  console.error(
    "Usage: codgen --in ./src/models.yaml --out ./src/generated/models.ts"
  )
  process.exit(1)
}

function generateFile(inputFile: string, outputFile: string) {
  const yaml = fs.readFileSync(inputFile, "utf8")
  const code = generateModels(yaml)
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, code)
}
