// What every contribution of an extension's page is drawn in: its extension, for the hooks of
// `uraeda/page`, and an error boundary, so a contribution that throws while drawing says so in its
// own place, and is reported to the settings page, while the rest of the app stays drawn. A
// failure a record's error caused lasts while the record still has it: it watches the record, and
// draws its contribution again once the record reads or its error changes. The runtime keys it by
// the page's version: a reload draws it anew.
import { Text } from "@astryxdesign/core/Text";
import { Component, type ReactNode, Suspense, useEffect } from "react";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { ExtensionContext, RecordError, useRecordRow } from "./hooks.ts";

/** Watches the record `id`, failed with `error`: calls `onChange` once its error is another. */
function RecordWatch({ error, id, onChange }: { error: string; id: string; onChange: () => void }) {
  const record = useRecordRow(id);
  const now = record?.error;
  useEffect(() => {
    if (record && now !== error) {
      onChange();
    }
  }, [error, now, onChange, record]);
  return null;
}

type Props = {
  children: ReactNode;
  /** What it draws in place of a failure, a count's: its failure's text when not given. */
  fallback?: ReactNode;
  /** Whether it draws in a line, as a status item: then its failure is one line of text. */
  isInline?: boolean;
  /** The extension's name. */
  name: string;
  /** Reports what the contribution threw, to the settings page. */
  report: (message: string) => void;
  /** The extension's title, which its failure names. */
  title: string;
};

type State = { failed: string | null; record: string | null };

export class ExtensionBoundary extends Component<Props, State> {
  state: State = { failed: null, record: null };

  static getDerivedStateFromError(error: unknown): State {
    const failed = error instanceof Error ? error.message : String(error);
    return { failed, record: error instanceof RecordError ? error.id : null };
  }

  /** Draws the contribution again, as its record changed. */
  retry = () => this.setState({ failed: null, record: null });

  componentDidCatch(error: unknown) {
    this.props.report(error instanceof Error ? error.message : String(error));
  }

  render() {
    const { children, fallback, name } = this.props;
    const { failed, record } = this.state;
    if (failed === null) {
      return <ExtensionContext value={name}>{children}</ExtensionContext>;
    }
    return (
      <>
        {fallback === undefined ? this.#failure(failed) : fallback}
        {record !== null && (
          <ExtensionContext value={name}>
            <Suspense fallback={null}>
              <RecordWatch error={failed} id={record} onChange={this.retry} />
            </Suspense>
          </ExtensionContext>
        )}
      </>
    );
  }

  #failure(failed: string) {
    const { isInline, title } = this.props;
    const text = `${title}: ${failed}`;
    return isInline ? (
      <Text color="secondary" size="sm">
        {text}
      </Text>
    ) : (
      <AnnouncedBanner collapsible={false} status="error" title={text} />
    );
  }
}
