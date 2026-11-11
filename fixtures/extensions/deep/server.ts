// Broken on purpose: it calls itself without end.
function down(depth: number): number {
  return down(depth + 1) + 1;
}

export default function activate() {
  down(0);
}
