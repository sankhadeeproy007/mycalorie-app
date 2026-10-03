export class AnalysisError extends Error {
  constructor(
    readonly code: "not_configured" | "quota" | "unreadable" | "upstream",
    message: string,
  ) {
    super(message);
  }
}
