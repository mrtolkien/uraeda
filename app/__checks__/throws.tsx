// A page of `crates/app/tests/outside.rs`: it throws while it loads, before it shows anything.
import "./start";

throw new Error("broken at load");
