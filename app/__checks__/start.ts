// The first module a breaking page of `crates/app/tests/outside.rs` runs: its post reaches the
// host on the thread of the page's engine, which is how the host knows whose errors it hears.
import { host } from "nsh";

host.post("start");
