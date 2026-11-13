// Broken on purpose: it takes memory without end.
export default function activate() {
  const kept: Array<string> = [];
  let text = "0123456789abcdef";
  for (;;) {
    text += text;
    kept.push(text);
  }
}
