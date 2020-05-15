import {
  QueryExpressionBuilder,
  Operator,
} from "../../../main/dynamo/expressions/QueryExpressionBuilder"
import { Musician } from "../models"

describe("ExpressionBuilder basic clauses", () => {
  it("doing nothing should yield blank expression", () => {
    const result = exp().build()
    expect(result).toEqual({
      expression: "",
      attributeNames: {},
      attributeValues: {},
    })
  })

  it("should support where clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .build()

    expect(result).toEqual({
      expression: "#name = :name",
      attributeNames: { "#name": "name" },
      attributeValues: { ":name": "Bob Marley" },
    })
  })

  it("should support these operators", () => {
    const operators: Operator[] = ["=", "<>", "<", ">", "<=", ">="]
    operators.forEach((operator) => {
      const result = exp()
        .where("name", operator, "Bob Marley")
        .build()

      expect(result).toEqual({
        expression: `#name ${operator} :name`,
        attributeNames: { "#name": "name" },
        attributeValues: { ":name": "Bob Marley" },
      })
    })
  })

  it("should support or clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .or("id", "<>", "123")
      .build()

    expect(result).toEqual({
      expression: "#name = :name OR #id <> :id",

      attributeNames: {
        "#name": "name",
        "#id": "id",
      },

      attributeValues: {
        ":name": "Bob Marley",
        ":id": "123",
      },
    })
  })

  it("should support and clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .and("id", "<>", "123")
      .build()

    expect(result).toEqual({
      expression: "#name = :name AND #id <> :id",

      attributeNames: {
        "#name": "name",
        "#id": "id",
      },

      attributeValues: {
        ":name": "Bob Marley",
        ":id": "123",
      },
    })
  })
})

describe("ExpressionBuilder attribute_exists and attribute_not_exists clauses", () => {
  it("should support attributeExists clauses", () => {
    const result = exp()
      .attributeExists("name")
      .build()

    expect(result).toEqual({
      expression: "attribute_exists(#name)",
      attributeNames: { "#name": "name" },
      attributeValues: {},
    })
  })

  it("should support attributeNotExists clauses", () => {
    const result = exp()
      .attributeNotExists("name")
      .build()

    expect(result).toEqual({
      expression: "attribute_not_exists(#name)",
      attributeNames: { "#name": "name" },
      attributeValues: {},
    })
  })
})

describe("ExpressionBuilder and/or attribute_(not)_exists clauses", () => {
  const attributeNames = {
    "#name": "name",
    "#id": "id",
  }

  const attributeValues = {
    ":name": "Bob Marley",
  }

  it("should support orAttributeExists clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .orAttributeExists("id")
      .build()

    expect(result).toEqual({
      expression: "#name = :name OR attribute_exists(#id)",
      attributeNames,
      attributeValues,
    })
  })

  it("should support andAttributeExists clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .andAttributeExists("id")
      .build()

    expect(result).toEqual({
      expression: "#name = :name AND attribute_exists(#id)",
      attributeNames,
      attributeValues,
    })
  })

  it("should support orAttributeNotExists clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .orAttributeNotExists("id")
      .build()

    expect(result).toEqual({
      expression: "#name = :name OR attribute_not_exists(#id)",
      attributeNames,
      attributeValues,
    })
  })

  it("should support andAttributeNotExists clauses", () => {
    const result = exp()
      .where("name", "=", "Bob Marley")
      .andAttributeNotExists("id")
      .build()

    expect(result).toEqual({
      expression: "#name = :name AND attribute_not_exists(#id)",
      attributeNames,
      attributeValues,
    })
  })
})

function exp(): QueryExpressionBuilder<Musician> {
  return new QueryExpressionBuilder<Musician>()
}
