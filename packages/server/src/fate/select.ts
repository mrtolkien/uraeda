/**
 * fate's client selects inside plain objects, like `step.name`, while the server's data views
 * declare those objects as whole fields, `step: true`, which fate matches by their own path only.
 * Every field of these records is a whole field, so each selected path becomes its first segment,
 * and the objects come whole.
 */
export function wholeFields(select: unknown): unknown {
  if (!Array.isArray(select)) {
    return select;
  }
  return [...new Set(select.map((path) => (typeof path === "string" ? path.split(".")[0] : path)))];
}

/** A protocol body with every operation's selection reduced to whole fields. */
export function withWholeFields(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("operations" in body)) {
    return body;
  }
  const { operations } = body as { operations: unknown };
  if (!Array.isArray(operations)) {
    return body;
  }
  return {
    ...body,
    operations: operations.map((operation: Record<string, unknown>) =>
      operation && typeof operation === "object" && "select" in operation
        ? { ...operation, select: wholeFields(operation.select) }
        : operation,
    ),
  };
}
