// The app's entry, which Native Shell runs: it mounts the root component.
import { mount, Text, View } from "nsh";

function App() {
  return (
    <View class="flex-1 items-center justify-center bg-background">
      <Text class="text-foreground">Uraeda</Text>
    </View>
  );
}

mount(App);
