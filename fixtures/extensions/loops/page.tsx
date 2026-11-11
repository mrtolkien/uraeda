// The page of the fixture extension `loops`, for `crates/app/tests/extensions.rs`: its place never
// stops drawing, so NSH cuts the call off, and the page goes on.
import { Text } from "nsh";
import { place } from "uraeda/page";

function Loops() {
  for (;;) {
    // Never ends.
  }
  return <Text>Never drawn</Text>;
}

place({ icon: "refresh-cw", id: "loops", title: "Loops", view: Loops });
