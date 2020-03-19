import { Model } from "./Model";
export declare class Key<T extends Model, U> {
    private createKey;
    constructor(createKey: (input: U) => string[]);
    key(input: U): string;
}
