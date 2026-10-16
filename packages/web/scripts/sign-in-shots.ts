/**
 * The screenshots' views of signing in and out: the sign-in screen empty, signing in, and with a
 * wrong key's error, as a server without a session shows it. Signing out is in the settings' views.
 * The screenshots' server has no sign-in: its fate requests are answered here, as a server with
 * sign-in answers a browser without a session.
 */
import type { Page, Route } from "playwright";
import { type Each, settle, show } from "./shots.ts";

/** fate's requests, not the modules of its client, whose paths hold `/fate` too. */
const FATE = (url: URL) => /\/fate(\/live)?$/.test(url.pathname);
/** Sign-in's path. */
const SESSION = (url: URL) => url.pathname === "/session";

/** Answers every fate request with 401, and a sign-in by `onSignIn`, until `signedIn`. */
async function signedOut(page: Page, onSignIn: (route: Route) => Promise<void>) {
  await page.route(FATE, (route) =>
    route.fulfill({ json: { error: "Sign in to Uraeda." }, status: 401 }),
  );
  await page.route(SESSION, (route) =>
    route.request().method() === "POST" ? onSignIn(route) : route.fallback(),
  );
}

/** A wrong key's answer. */
const wrongKey = (route: Route) =>
  route.fulfill({ json: { error: "This is not Uraeda's access key." }, status: 401 });

/** The sign-in screen, its field holding a key typed. */
async function typed(page: Page) {
  await show(page, "/", "Sign in to Uraeda");
  await page.getByLabel("Access key").fill("ura_q4W7bZ0kLr2N8vXc5TfY1sHjU6mPaE3dGoK9iRtB2wQ");
}

/** Every view of signing in, at both sizes and in both themes. */
export async function takeSignIn(each: Each) {
  await each("sign-in", async ({ page }) => {
    await signedOut(page, wrongKey);
    await show(page, "/", "Sign in to Uraeda");
  });
  // The sign-in's answer held until the next view: "Signing in…" shows meanwhile.
  let answer: (() => void) | undefined;
  await each("sign-in-signing", async ({ page }) => {
    answer?.();
    await typed(page);
    await page.route(SESSION, async (route) => {
      await new Promise<void>((resolve) => (answer = resolve));
      // The page may have gone since, with its request.
      await wrongKey(route).catch(() => undefined);
    });
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Signing in…" }).waitFor();
    await settle(page);
  });
  await each("sign-in-error", async ({ page }) => {
    answer?.();
    await page.unroute(SESSION);
    await signedOut(page, wrongKey);
    await typed(page);
    await page.keyboard.press("Enter");
    await page.getByText("This is not Uraeda's access key.").first().waitFor();
    await settle(page);
  });
  // The last sign-in's answer, held since its view, is let go.
  answer?.();
}
