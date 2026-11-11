// The clock the place's times read against, read again every 30 seconds while a pane shows them:
// "Tomorrow at 3:00" turns into "Today at 3:00" at midnight without a reload.
import { cleanup, signal } from "nsh";

export function ticking(every = 30_000) {
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), every);
  cleanup(() => clearInterval(timer));
  return now;
}
