// What every panel of a session reads first: the session its arguments name, or why there is
// none, in words, before its first message as while it is read.
import { type JSX, View } from "nsh";
import { record } from "../../../store";
import type { Session } from "../../../store/protocol";
import { Spinner } from "../../../ui/controls";
import { Empty } from "../../../ui/lists";
import { type SessionArgs, sessionIdOf } from "../place";

/** `children` with the session, once read; `none` before its first message. */
export function WithSession(props: {
  args: SessionArgs;
  none: JSX.Element;
  children: (session: () => Session) => JSX.Element;
}) {
  const id = sessionIdOf(props.args);
  return (
    <If when={id() !== undefined} else={<Spinner label="Reading the feature" />}>
      <If when={id()} else={props.none}>
        {(shown) => (
          // Made again for another session: its cursor and its rows are its own.
          <Each of={[shown()]}>
            {(one) => <ById id={one()} repo={props.args.repo} view={props.children} />}
          </Each>
        )}
      </If>
    </If>
  );
}

function ById(props: { id: string; repo: string; view: (session: () => Session) => JSX.Element }) {
  const session = record("Session", { id: props.id, repo: props.repo });
  return (
    <If
      when={session.error()}
      else={
        <If when={session() !== undefined} else={<Spinner label="Reading the session" />}>
          <If
            when={session()}
            else={
              <Padded>
                <Empty
                  icon="message-square"
                  title="No such session"
                  words="This repository keeps no session of that id: it was archived with its feature."
                />
              </Padded>
            }
          >
            {(shown) => props.view(shown)}
          </If>
        </If>
      }
    >
      {(error) => (
        <Padded>
          <Empty
            icon="circle-alert"
            title="The session could not be read"
            words={error().message}
          />
        </Padded>
      )}
    </If>
  );
}

/** A state's words, inside the pane's padding: the panels' lists reach its border. */
export function Padded(props: { children?: JSX.Element }) {
  return <View style={{ padding: 12 }}>{props.children}</View>;
}
