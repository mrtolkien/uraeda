// The sign-in screen: shown instead of the app while this browser is signed out, a page of its own
// without the navigation, at both widths, its column centred.
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useServerFetch } from "../attach/ServerFetch.tsx";
import { Page } from "../layout/Page.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";

const styles = stylex.create({
  // The page's surface, which the shell paints on the other pages: this page has none.
  surface: {
    backgroundColor: colorVars["--color-background-surface"],
    minHeight: "var(--size-viewport-height)",
  },
  // The form as wide as a dialog's, in the middle of the page's column.
  column: {
    marginInline: "auto",
    maxWidth: "var(--size-form)",
  },
  error: { color: colorVars["--color-error"] },
  // The command stays on one line, never broken at its dashes: a box of its own, not
  // `white-space`, whose atomic class the app's StyleX would emit over the theme's overrides.
  command: { display: "inline-block" },
});

/** The answer to a wrong key, as the server words it. */
const WRONG = "This is not Uraeda's access key.";
/** The answer to a sign-in that never reached the server, or that it failed. */
const UNREACHABLE = "Could not reach the Uraeda server.";

/** What went wrong with the last try: the key, shown under the field, or the server, under Sign in. */
type Failure = { key: string } | { server: string };

/**
 * Signs this browser in with the access key, `POST /session` through `fetch`, the app's plain
 * requests' by default: once the server answers 204, `onSignedIn`, which reloads the page by default, so its
 * reads start over signed in. An error stays until the next try, and the field keeps its text.
 */
export function SignInPage({
  fetch: given,
  onSignedIn = () => window.location.reload(),
}: {
  fetch?: typeof globalThis.fetch;
  onSignedIn?: () => void;
}) {
  const plain = useServerFetch();
  const fetch = given ?? plain;
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>();

  const submit = async () => {
    if (busy || key === "") {
      return;
    }
    setBusy(true);
    setFailure(undefined);
    let response: Response;
    try {
      response = await fetch("/session", {
        body: JSON.stringify({ key }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
    } catch {
      setBusy(false);
      setFailure({ server: UNREACHABLE });
      return;
    }
    if (response.ok) {
      onSignedIn();
      return;
    }
    setBusy(false);
    // Only a 401 is a wrong key: any other answer is the server's failure, not the key's.
    setFailure(response.status === 401 ? { key: WRONG } : { server: UNREACHABLE });
  };

  return (
    <div {...stylex.props(styles.surface)}>
      <main>
        <Page>
          <VStack gap={3} xstyle={styles.column}>
            <Heading level={1}>Sign in to Uraeda</Heading>
            <Paragraph color="secondary">
              Paste the access key Uraeda showed when it first started. On the machine that runs
              Uraeda,{" "}
              <Code size="inherit" xstyle={styles.command}>
                uraeda --new-key
              </Code>{" "}
              makes a new one and signs every device out.
            </Paragraph>
            <TextInput
              autoComplete="current-password"
              label="Access key"
              onChange={(value: string) => setKey(value)}
              onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
              status={
                failure && "key" in failure ? { message: failure.key, type: "error" } : undefined
              }
              type="password"
              value={key}
            />
            <HStack>
              <Button
                isDisabled={busy || key === ""}
                label={busy ? "Signing in…" : "Sign in"}
                onClick={() => void submit()}
                variant="primary"
              />
            </HStack>
            {failure && "server" in failure && (
              <Text role="alert" type="supporting" xstyle={styles.error}>
                {failure.server}
              </Text>
            )}
          </VStack>
        </Page>
      </main>
    </div>
  );
}
