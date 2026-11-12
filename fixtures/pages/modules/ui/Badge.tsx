// A stand-in for a component of `app/ui/`, with its props: `Badge` holds its words as children,
// as the app's does.
import { Text } from "nsh";

export function Badge(props: { children: string | number }) {
  return <Text>{`a stand-in badge: ${String(props.children)}`}</Text>;
}

/** A stand-in for the app's `Text`, which draws in the theme's ink. */
export function UiText(props: { children?: unknown }) {
  return <Text>{String(props.children ?? "")}</Text>;
}
