// A page of `crates/app/tests/outside.rs`: a line of text in the font of each part of the UI, and
// in each font the app bundles. It tells its host the family each line names, and draws the lines
// when its host asks. Each line has a colour of its own, `rgb(<its place, from 1>, 0, 0)`, by
// which its host finds it in what GTK draws.
import { host, mount, signal, Text, View } from "nsh";
import { FONT_ROLES, FONTS, tokens } from "../ui/tokens";

const lines = [
  ...FONT_ROLES.map(({ role }) => ({ family: tokens.type[role], name: `tokens.type.${role}` })),
  ...FONTS.map((font) => ({ family: font.family, name: font.label })),
];

/** Whether the lines show: not before the host has looked at the display's own fonts. */
const shown = signal(false);

function Page() {
  return (
    <View style={{ backgroundColor: "#ffffff", flex: 1, padding: 16 }}>
      {shown()
        ? lines.map((line, at) => (
            <Text
              style={{
                color: `rgb(${at + 1}, 0, 0)`,
                fontFamily: line.family,
                fontSize: tokens.type.size,
              }}
            >
              {line.name}: Sphinx of black quartz, judge my vow. 0123456789
            </Text>
          ))
        : null}
    </View>
  );
}

mount(Page);
host.on("draw", () => shown.set(true));
host.post("named", lines);
