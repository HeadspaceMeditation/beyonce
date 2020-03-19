/** Extracts all the keys of a type T, in a way that works with union types, eg. T = Cat | Dog.
 *
 * TypeScript has a keyof operator built in. But when given a type union, this actually peforms an intersection of the keys.
 * This is a wart that results from TypeScript also needing to support its T[U] syntax, e.g:
 *
 * function pluck<T, U extends keyof T>(item: T, key: U) { return item[key] }: T[U]
 *
 * Hence why KeysOf exists, it gives you unioned keys when given a union type
 * source: https://stackoverflow.com/questions/49401866/all-possible-keys-of-an-union-type
 */
export declare type KeysOf<T> = T extends any ? keyof T : never;
