// A stand-in for a component of `app/ui/`.
import { Text } from "nsh";

export function Badge(props: { label: string }) {
  return <Text>{`a stand-in badge: ${props.label}`}</Text>;
}
