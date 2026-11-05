// A card's click, which opens what the part clicked points to.
import type { MouseEvent } from "react";

/**
 * A click on the card: on its pull request, opens it in a new tab; on its status, what the status
 * points to (`onStatus`); anywhere else, `onOpen`: the item's page inside the app, or on the phone
 * the step that waits on the human.
 */
export function cardClick(onOpen: (() => void) | undefined, onStatus: (() => void) | undefined) {
  return (event: MouseEvent) => {
    const pr = (event.target as Element).closest("[data-card-pr]");
    if (pr) {
      event.preventDefault();
      window.open(pr.getAttribute("data-card-pr") ?? "", "_blank", "noopener");
    } else if (onStatus && (event.target as Element).closest("[data-card-status]")) {
      event.preventDefault();
      onStatus();
    } else if (onOpen) {
      event.preventDefault();
      onOpen();
    }
  };
}
