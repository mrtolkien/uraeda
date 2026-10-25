// A path, or a command, that breaks after its slashes first, where a line has room for its folders,
// and inside a name only when the name alone is wider than the line: no text is cut, and a name
// reads whole where it can. The Changes' files and the Activity's rows draw their paths so.
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";

const styles = stylex.create({
  // A long path breaks, rather than running under what follows it.
  code: { minWidth: 0, overflowWrap: "anywhere" },
});

/** `path`'s parts, each after its slash a place a line may break. */
function breakable(path: string) {
  const parts = path.split("/");
  return parts.map((part, index) =>
    index < parts.length - 1 ? (
      <Fragment key={index}>
        {part}/<wbr />
      </Fragment>
    ) : (
      part
    ),
  );
}

/**
 * `path`, breaking after its slashes first: in the code font, as a file's path, or `inText`, in the
 * text around it, as an activity row's target.
 */
export function Path({ inText = false, path }: { inText?: boolean; path: string }) {
  if (inText) {
    return <>{breakable(path)}</>;
  }
  return (
    <Text type="code" xstyle={styles.code}>
      {breakable(path)}
    </Text>
  );
}
