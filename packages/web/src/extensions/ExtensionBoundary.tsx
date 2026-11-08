// What every contribution of an extension's page is drawn in: its extension, for the hooks of
// `uraeda/page`, and an error boundary, so a contribution that throws while drawing says so in its
// own place, and is reported to the settings page, while the rest of the app stays drawn. The
// runtime keys it by the page's version: a reload draws it anew.
import { Text } from "@astryxdesign/core/Text";
import { Component, type ReactNode } from "react";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { ExtensionContext } from "./hooks.ts";

type Props = {
  children: ReactNode;
  /** Whether it draws in a line, as a status item: then its failure is one line of text. */
  isInline?: boolean;
  /** The extension's name. */
  name: string;
  /** Reports what the contribution threw, to the settings page. */
  report: (message: string) => void;
  /** The extension's title, which its failure names. */
  title: string;
};

export class ExtensionBoundary extends Component<Props, { failed: string | null }> {
  state: { failed: string | null } = { failed: null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    this.props.report(error instanceof Error ? error.message : String(error));
  }

  render() {
    const { children, isInline, name, title } = this.props;
    const { failed } = this.state;
    if (failed === null) {
      return <ExtensionContext value={name}>{children}</ExtensionContext>;
    }
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
