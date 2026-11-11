// The page of the fixture extension `hello`: a place that greets, with a file of its own and the
// two modules of the app a page may import.
import { Text, View } from "nsh";
import { place } from "uraeda/page";
import { Badge } from "uraeda/ui";

import { greeting } from "./lib/greeting";

function Hello() {
  return (
    <View>
      <Text>{greeting}</Text>
      <Badge label="a page" />
    </View>
  );
}

place({ icon: "sparkles", id: "hello", title: "Hello", view: Hello });
