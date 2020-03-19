"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function generatePartitionKeys(models, partitionKeys) {
    const modelsByPartition = groupBy(models, "partition");
    const partitions = modelsByPartition.map(([partition, models]) => generatePartitionKey(partition, models, partitionKeys));
    return `
      export const PK = {
        ${partitions.join("\n,")}
      }
    `;
}
exports.generatePartitionKeys = generatePartitionKeys;
function generatePartitionKey(partition, models, partitionKeys) {
    const modelNames = models.map(_ => _.name);
    const keyParts = partitionKeys[partition];
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
    return `${partition}: new Key<${modelNames.join(" | ")}, {${inputType}}>(_ => [${parts.join(", ")}])`;
}
function groupBy(data, key) {
    const groupedItems = {};
    data.forEach(item => {
        groupedItems[item[key]] = groupedItems[item[key]] || [];
        groupedItems[item[key]].push(item);
    });
    return Object.entries(groupedItems);
}
//# sourceMappingURL=generatePartitionKeys.js.map