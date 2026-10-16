// The search over the sidebar's features and chats, at its top.
import { useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { TextInput } from "@astryxdesign/core/TextInput";
import { startTransition, useEffect, useState } from "react";

/** How long typing must stop before a search is read (R2). */
const SEARCH_DELAY = 200;

/**
 * The search's text as typed, and the query read from it once typing stops: the list keeps showing
 * the previous result while the next one loads.
 */
export function useSessionQuery() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => startTransition(() => setQuery(text.trim())), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [text]);
  return { query, setText, text };
}

/** The search field at the top of the navigation; the folded navigation has no room for it. */
export function SearchField({
  onChange,
  text,
}: {
  onChange: (text: string) => void;
  text: string;
}) {
  const { isCollapsed } = useSideNavCollapse();
  if (isCollapsed) {
    return null;
  }
  return (
    <TextInput
      hasClear
      isLabelHidden
      label="Search sessions"
      onChange={onChange}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
          onChange("");
        }
      }}
      placeholder="Search sessions"
      role="searchbox"
      startIcon="search"
      value={text}
    />
  );
}
