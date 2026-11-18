/** Thrown when the actor may not do this. Pages turn it into a 404 (no hint the thing exists). */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends ForbiddenError {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}

export class ValidationError extends Error {
  readonly code = "VALIDATION";
  constructor(
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ManifestError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid module manifests:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ManifestError";
  }
}
