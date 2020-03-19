import { ModelSet } from "./types";
export declare function generatePartitionKeys(models: ModelSet, partitionKeys: {
    [partition: string]: string[];
}): string;
