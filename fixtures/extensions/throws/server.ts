// Broken on purpose: it throws as it loads.
export default function activate() {
  throw new Error("it broke as it loaded");
}
