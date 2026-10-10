type Binding = typeof import("uraeda-binding");

/** Loads the native binding, with a message that says how to build it when it is missing. */
export async function loadBinding(
  load: () => Promise<Binding> = () => import("uraeda-binding"),
): Promise<Binding> {
  try {
    return await load();
  } catch {
    throw new Error("the native binding is not built; run vp run ready");
  }
}
