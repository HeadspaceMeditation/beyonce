"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function generateSortKeys(models) {
    const sks = models.map(({ name, sk }) => codeGenKeyGetter(name, sk));
    return `
      export const SK = {
        ${sks.join(",\n")}
      }
    `;
}
exports.generateSortKeys = generateSortKeys;
function codeGenKeyGetter(modelName, keyParts) {
    const inputFields = [];
    const parts = [];
    keyParts.forEach(part => {
        if (part.startsWith("_.")) {
            inputFields.push(part.replace("_.", ""));
            parts.push(part);
        }
        else {
            parts.push(`"${part}"`);
        }
    });
    const inputType = inputFields.map(_ => `${_}: string`).join(",");
    return `[ModelType.${modelName}]: new Key<${modelName}, {${inputType}}>(_ => [${parts.join(", ")}])`;
}
//# sourceMappingURL=generateSortKeys.js.map