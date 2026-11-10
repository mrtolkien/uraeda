// A page of `crates/app/tests/outside.rs`: it shows the web page its host names in a web view,
// and passes on to its host what the web view and the web page say.
import { host, mount, View, WebView } from "nsh";

const src = host.params.src as string;

function Page() {
  return (
    <View class="flex-1">
      <WebView
        onError={(event) => host.post("failed", event.message)}
        onLoad={(event) => host.post("loaded", event.url)}
        onMessage={(event) => host.post("message", event.data)}
        src={src}
        style={{ flex: 1 }}
      />
    </View>
  );
}

mount(Page);
