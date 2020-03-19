"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const js_yaml_1 = __importDefault(require("js-yaml"));
const path = __importStar(require("path"));
const prettier = __importStar(require("prettier"));
const generateModelInterface_1 = require("./generateModelInterface");
const generateModelTypeEnum_1 = require("./generateModelTypeEnum");
const generatePartitionKeys_1 = require("./generatePartitionKeys");
const generateSortKeys_1 = require("./generateSortKeys");
function generateModels(yamlData) {
    const { Models, Partitions } = parseYaml(yamlData);
    const partitionKeys = Partitions;
    const models = [];
    Object.entries(Models).forEach((_a) => {
        var [name, _b] = _a, { partition, sort } = _b, fields = __rest(_b, ["partition", "sort"]);
        return models.push({
            name,
            partition,
            sk: sort,
            fields
        });
    });
    const modelInterfaces = generateModelInterface_1.generateModelInterfaces(models);
    const modelTypeEnum = generateModelTypeEnum_1.generateModelTypeEnum(models);
    const partitions = generatePartitionKeys_1.generatePartitionKeys(models, partitionKeys);
    const sortKeys = generateSortKeys_1.generateSortKeys(models);
    const imports = new Set([
        `import { Key } from "main/dynamo/Key"`,
        `import { Model } from "main/dynamo/Model"`
    ]);
    modelInterfaces.imports.forEach(_ => imports.add(_));
    const code = `
      ${Array.from(imports).join("\n")}

      ${modelTypeEnum}

      ${modelInterfaces.code.join("\n\n")}

      ${partitions}

      ${sortKeys}
    `;
    return prettier.format(code, {
        parser: "typescript",
        semi: false
    });
}
exports.generateModels = generateModels;
function parseYaml(yamlData) {
    try {
        return js_yaml_1.default.safeLoad(yamlData);
    }
    catch (e) {
        console.error(`Failed to load yaml file ${path}`);
        throw e;
    }
}
//# sourceMappingURL=generateModels.js.map