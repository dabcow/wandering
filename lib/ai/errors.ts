/** Shown when the server's AI settings are missing or wrong; the details go to the server log. */
export const NOT_SET_UP = "Story suggestions aren't available right now because the AI isn't set up. Try again later.";

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
