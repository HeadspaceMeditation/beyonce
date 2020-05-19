export class Variables {
  private substitutions: { [key: string]: string } = {}

  add(name: string, value: any): string {
    const placeholder = `:${name}`
    this.substitutions[placeholder] = value
    return placeholder
  }

  getSubstitutions(): Readonly<{ [key: string]: string }> {
    return this.substitutions
  }
}
