export class Variables {
  private substitutions: { [key: string]: string } = {}
  private counter = 1

  add(value: any): string {
    const placeholder = `:v${this.counter}`
    this.substitutions[placeholder] = value
    this.counter += 1
    return placeholder
  }

  getSubstitutions(): { [key: string]: string } {
    return { ...this.substitutions }
  }
}
