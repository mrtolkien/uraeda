// The sandbox page's entry for its bar: the app's own entry knows nothing of it.
import { mountSandboxBar } from "./mountSandboxBar.tsx";

mountSandboxBar({ document, window });
