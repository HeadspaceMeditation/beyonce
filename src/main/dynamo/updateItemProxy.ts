import { UpdateItemExpressionBuilder } from "./expressions/UpdateItemExpressionBuilder"

export function updateItemProxy<T extends {}>(
  expBuilder: UpdateItemExpressionBuilder,
  attrPath: string[] = []
): T {
  return new Proxy({} as any, {
    get(target, prop, receiver) {
      attrPath.push(prop.toString())
      return updateItemProxy<any>(expBuilder, attrPath)
    },

    set(target, prop, value) {
      attrPath.push(prop.toString())
      expBuilder.set(attrPath, value)
      return true
    },

    deleteProperty(target, prop) {
      attrPath.push(prop.toString())
      expBuilder.remove(attrPath)
      return true
    },
  })
}
