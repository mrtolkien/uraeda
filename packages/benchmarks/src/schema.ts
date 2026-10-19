/** A check of one JSON value, which throws a message naming the field when it does not hold. */
export type Check = (value: unknown, path: string) => void;

const fail = (path: string, wanted: string): never => {
  throw new Error(`${path}: expected ${wanted}`);
};

export const text: Check = (value, path) => {
  if (typeof value !== "string") {
    fail(path, "text");
  }
};
export const number: Check = (value, path) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "a number");
  }
};
export const bool: Check = (value, path) => {
  if (typeof value !== "boolean") {
    fail(path, "true or false");
  }
};

export const oneOf =
  (...words: Array<string>): Check =>
  (value, path) => {
    if (typeof value !== "string" || !words.includes(value)) {
      fail(path, `one of ${words.join(", ")}`);
    }
  };

export const list =
  (item: Check): Check =>
  (value, path) => {
    if (!Array.isArray(value)) {
      fail(path, "a list");
    }
    (value as Array<unknown>).forEach((entry, index) => item(entry, `${path}[${index}]`));
  };

/** An object with every field of `fields`, each present and valid, unless `optional` names it. */
export const object =
  (fields: Record<string, Check>, optional: Array<string> = []): Check =>
  (value, path) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(path, "an object");
    }
    const record = value as Record<string, unknown>;
    for (const [name, check] of Object.entries(fields)) {
      if (!(name in record)) {
        if (!optional.includes(name)) {
          fail(`${path}${path === "" ? "" : "."}${name}`, "a value, missing");
        }
        continue;
      }
      check(record[name], `${path}${path === "" ? "" : "."}${name}`);
    }
  };
