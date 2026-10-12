// A raw element where no Astryx component fits: allowed with a suppression giving its reason.
export function Suppressed() {
  // oxlint-disable-next-line react/forbid-elements -- a fixture of the lint test: the reason goes here
  return <button type="button">Save</button>;
}
