// The sidebar on iOS: a drawer from the leading edge, over the page dimmed, as an iPhone app's
// panel of its places and threads slides in. The system has no sidebar on a phone, its own being an
// iPad's and a Mac's: Native Shell's `Sheet` at the left is the drawer, which a press on the page
// beside it, the system's escape gesture, and a swipe back toward the edge close.
//
// Its panel is the system's glass, as the bars are, its outer corners as round as the screen's;
// its head is the repository's name, which opens the switcher, as the toolbar's does.
import { type JSX, signal, View, windowSize } from "nsh";
import { Sheet } from "nsh/base";
import { Icon, Text } from "../controls";
import { aboveHome, belowStatus } from "../surfaces";
import { feltChoice } from "../native";
import { tokens } from "../tokens";

/** How wide the drawer is: most of a phone, with the page still seen beside it. */
const width = () => Math.min(380, Math.round(windowSize().width * 0.86));

/** How far left a finger moves on the drawer before a release closes it, in points. */
const CLOSES = 60;

export function Drawer(props: {
  children?: JSX.Element;
  onClose: () => void;
  /** A press on the title: the repositories' switcher. */
  onTitle?: () => void;
  open: boolean;
  title: string;
}) {
  // A swipe toward the edge it came from closes it, as the drawers of the system's apps do.
  let from: number | null = null;
  const moved = signal(0);
  return (
    <Sheet
      backdropStyle={{ backgroundColor: tokens.backdrop.dim }}
      onOpenChange={({ open }) => {
        if (!open) props.onClose();
      }}
      open={props.open}
      popupStyle={{
        backdropFilter: "blur(20px)",
        borderBottomRightRadius: 34,
        borderCurve: "continuous",
        borderTopRightRadius: 34,
        glassEffect: "regular",
        height: "100%",
        overflow: "hidden",
        paddingBottom: aboveHome(8),
        paddingHorizontal: 10,
        paddingTop: belowStatus(8),
        transform: [{ translateX: -moved() }],
        width: width(),
      }}
      side="left"
    >
      <View
        // Decided natively, as the finger moves: sideways it is the drawer's, the rows and the
        // panes' scroll never take it; up or down first, the scroll keeps it.
        panActivation={{ activeOffsetX: 12, failOffsetY: 12 }}
        onResponderGrant={(event: { pageX: number }) => {
          from = event.pageX;
          return true;
        }}
        onResponderMove={(event: { pageX: number }) =>
          moved.set(Math.max(0, (from ?? event.pageX) - event.pageX))
        }
        onResponderRelease={() => {
          const far = moved();
          moved.set(0);
          from = null;
          if (far >= CLOSES) props.onClose();
        }}
        onResponderTerminate={() => {
          moved.set(0);
          from = null;
        }}
        style={{ flex: 1, gap: 10 }}
        testID="drawer"
      >
        <View
          accessibilityLabel={`Repository ${props.title}: switch`}
          activeStyle={{ opacity: 0.55 }}
          onPress={() => {
            if (props.onTitle === undefined) return;
            feltChoice();
            props.onClose();
            props.onTitle();
          }}
          role="button"
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 6,
            minHeight: tokens.control.touch,
            paddingHorizontal: 6,
          }}
        >
          <Text bold lines={1} size="over">
            {props.title}
          </Text>
          <If when={props.onTitle !== undefined}>
            <Icon colour={tokens.role.inkQuiet} name="chevron-down" />
          </If>
        </View>
        <View style={{ flex: 1, minHeight: 0 }}>{props.children}</View>
      </View>
    </Sheet>
  );
}
