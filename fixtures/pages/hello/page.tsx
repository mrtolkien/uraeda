// The page of the fixture extension `hello`: a place that greets, with a file of its own and the
// two modules of the app a page may import.
import { View } from "nsh";
import { place } from "uraeda/page";
import { Badge, Text } from "uraeda/ui";

import { greeting } from "./lib/greeting";

function Hello() {
  return (
    <View>
      <Text>{greeting}</Text>
      <Badge>a page</Badge>
    </View>
  );
}

place({ icon: "sparkles", id: "hello", title: "Hello", view: Hello });
