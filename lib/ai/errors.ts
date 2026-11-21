/** An error whose message is safe to show to the user. */
export class AIError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "AIError";
  }
}
