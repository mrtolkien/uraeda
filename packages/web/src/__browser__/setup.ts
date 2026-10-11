import { fixtureRepo } from "uraeda-binding/test-utils";

/** The repository the server mounted in the test server reads: the fixture's, built with git. */
export default function setup() {
  process.env.URAEDA_REPO = fixtureRepo();
}
