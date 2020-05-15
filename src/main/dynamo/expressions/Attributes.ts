export class Attributes {
  private substitutions: { [key: string]: string } = {}

  add(attribute: string): string {
    const placeholder = `#${attribute}`
    this.substitutions[placeholder] = attribute
    return placeholder
  }

  getSubstitutions(): Readonly<{ [key: string]: string }> {
    return this.substitutions
  }
}
