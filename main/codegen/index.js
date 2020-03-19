"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yargs_1 = require("yargs");
const generateModels_1 = require("./generateModels");
if (yargs_1.argv.in !== undefined && yargs_1.argv.out !== undefined) {
    const inputFile = yargs_1.argv.in;
    const outputFile = yargs_1.argv.out;
    generateFile(inputFile, outputFile);
    process.exit(0);
}
else {
    console.error("Usage: codgen --in ./src/models.yaml --out ./src/generated/models.ts");
    process.exit(1);
}
function generateFile(inputFile, outputFile) {
    const yaml = fs.readFileSync(inputFile, "utf8");
    const code = generateModels_1.generateModels(yaml);
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, code);
}
//# sourceMappingURL=index.js.map