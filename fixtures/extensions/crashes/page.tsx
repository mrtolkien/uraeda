// The page of the fixture extension `crashes`, for `crates/app/tests/extensions.rs`: it throws while
// it loads, after declaring a place, before the app could draw anything of it.
import { place } from "uraeda/page";

place({ icon: "circle-x", id: "crashes", title: "Crashes", view: () => null });

throw new Error("broken at load");
