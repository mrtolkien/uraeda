// "Feature settings", opened from a card's "…": a dialog on wide screens, a bottom sheet on the
// phone, drawn beside the shell, so the phone's drawer closes first, as the ＋ forms do. Saving
// keeps the name and the colour in the server's list, for the repository (R2).
import { useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "../errors.ts";
import { Overlay } from "../layout/Overlay.tsx";
import { FeatureView } from "../views.ts";
import type { Feature } from "./cards.ts";
import { FeatureSettingsForm } from "./FeatureSettings.tsx";

/** Opens a feature's settings. */
const OpenContext = createContext<(feature: Feature) => void>(() => {});

/** Opens a feature's settings, once the phone's drawer is closed. */
export function useOpenSettings() {
  const open = useContext(OpenContext);
  const { closeMobileNav, isMobileNavOpen, mobileNavId } = useAppShellMobile();
  return (feature: Feature) => {
    const drawer = (
      isMobileNavOpen && mobileNavId ? document.getElementById(mobileNavId) : null
    ) as HTMLDialogElement | null;
    if (drawer?.open) {
      drawer.addEventListener("close", () => open(feature), { once: true });
      closeMobileNav();
      return;
    }
    open(feature);
  };
}

function Settings({ feature, onClose }: { feature: Feature; onClose: () => void }) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  return (
    <VStack gap={2}>
      <FeatureSettingsForm
        color={feature.color ?? undefined}
        label={feature.label ?? ""}
        onCancel={onClose}
        onSave={async ({ color, label }) => {
          setError(undefined);
          const result = await fate.mutations.item.settings({
            input: { color: color ?? null, folder: feature.folder, label },
            view: FeatureView,
          });
          if (result.error) {
            setError(`Could not save the settings: ${refusal(result.error).message}`);
            return;
          }
          onClose();
        }}
        slug={feature.slug}
      />
      {error && (
        <Text color="error" role="alert" type="supporting">
          {error}
        </Text>
      )}
    </VStack>
  );
}

/** The settings dialog, drawn beside `children`, the shell, for the feature opened. */
export function FeatureSettingsHost({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<Feature>();
  // Drawn from its first opening on: a dialog's title takes the focus as it is drawn, which a page
  // that places the focus itself, like a round's question, must keep.
  const [drawn, setDrawn] = useState(false);
  const close = () => setFeature(undefined);
  const open = (opened: Feature) => {
    setDrawn(true);
    setFeature(opened);
  };
  return (
    <OpenContext value={open}>
      {children}
      {drawn && (
        <Overlay
          isOpen={feature !== undefined}
          label="Feature settings"
          onClose={close}
          sheetHeight="hug"
        >
          {feature && <Settings feature={feature} key={feature.folder} onClose={close} />}
        </Overlay>
      )}
    </OpenContext>
  );
}
