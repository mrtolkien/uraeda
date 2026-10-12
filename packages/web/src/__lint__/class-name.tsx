// A `className` on an Astryx component: refused by `react/forbid-component-props`.
import { Button } from "@astryxdesign/core/Button";

export function ClassName() {
  return <Button label="Save" className="save" />;
}
