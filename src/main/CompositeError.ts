/** An error that wraps multiple other errors.
 *
 *  TODO: Replace with AggregateError once Node 15 is our lowest supported version.
 *  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError
 */
export class CompositeError extends Error {
  constructor(message: string, public readonly errors: Error[]) {
    super(message)
    this.name = "CompositeError"
  }
}
