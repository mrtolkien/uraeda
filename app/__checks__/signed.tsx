// A page of `crates/app/tests/outside.rs`: it is packaged, signed, and loaded in an embedded view,
// where it tells its host that it runs.
import { host, mount, Text, View } from "nsh";

function Page() {
  return (
    <View class="flex-1 items-center justify-center bg-background">
      <Text class="text-foreground">A signed page</Text>
    </View>
  );
}

mount(Page);
host.post("ready", { page: "signed" });
