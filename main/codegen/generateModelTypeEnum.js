"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function generateModelTypeEnum(models) {
    const entries = models.map(({ name }) => `${name} = "${name}"`);
    return `
      export enum ModelType {
        ${entries.join(",\n")}
      }
    `;
}
exports.generateModelTypeEnum = generateModelTypeEnum;
//# sourceMappingURL=generateModelTypeEnum.js.map