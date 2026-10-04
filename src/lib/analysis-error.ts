export class AnalysisError extends Error {
  /**
   * @param detail A short, non-sensitive reason ("gemini 400", "no answer (RECITATION)") that is sent to the
   *   app and shown under the error, so a failure can be diagnosed from the phone without server logs.
   */
  constructor(
    readonly code: "not_configured" | "quota" | "unreadable" | "upstream",
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}
