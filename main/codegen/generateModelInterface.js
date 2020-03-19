"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function generateModelInterfaces(models) {
    const code = [];
    const imports = [];
    models.forEach(m => {
        const generatedInterface = generateModelInterface(m);
        code.push(generatedInterface.code);
        generatedInterface.imports.forEach(_ => imports.push(_));
    });
    return {
        code,
        imports
    };
}
exports.generateModelInterfaces = generateModelInterfaces;
function generateModelInterface(model) {
    const fields = [];
    const imports = [];
    Object.entries(model.fields).forEach(([name, type]) => {
        const generatedField = generateField(name, type);
        fields.push(generatedField.code);
        generatedField.imports.forEach(_ => imports.push(_));
    });
    const code = `
    export interface ${model.name} extends Model {
        model: ModelType.${model.name}
        ${fields.join("\n")}
      }`;
    return { code, imports };
}
function generateField(name, typeName) {
    const parts = typeName.split("/");
    if (parts.length > 1) {
        const existingTypeName = parts[parts.length - 1];
        return {
            code: `${name}: ${existingTypeName}`,
            imports: [`import { ${existingTypeName} } from "${typeName}"`]
        };
    }
    else {
        return { code: `${name}: ${typeName}`, imports: [] };
    }
}
//# sourceMappingURL=generateModelInterface.js.map