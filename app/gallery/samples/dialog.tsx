// Sample 5: a dialog over a dimmed page. The page dims, and is not blurred: only glass blurs, and
// only its own box. On glass nothing is a filled block, so its buttons are tubes.
import { View } from "nsh";
import { button, field } from "./controls";
import { glass, icon, mono, prose } from "./parts";
import { scene } from "./session";
import { alpha, type Values } from "./values";

export function dialog(v: Values) {
  return scene(
    v,
    <>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: v.backdrop.dim,
        }}
      />
      {glass(
        v,
        {
          testID: "dialog",
          style: { position: "absolute", left: 440, top: 230, width: 520 },
          content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14 },
        },
        <>
          <View
            style={{
              position: "absolute",
              left: 11,
              top: -10,
              height: 20,
              paddingHorizontal: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: v.glass.plate,
              boxShadow: `inset 0 1px 0 ${alpha(v.glass.rim, 0.12)}`,
            }}
          >
            {icon("alert", v.role.accent)}
            {mono(v, "Delete task 27?", { color: v.role.accent, fontWeight: "700" })}
          </View>
          {prose(
            v,
            "Its session and its 4 uncommitted changes go with it. This cannot be undone.",
            { marginBottom: 12 },
          )}
          {field(v, { placeholder: "Type the task's number to confirm", inside: "overlay" })}
          <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
            {button(v, { label: "Keep it", kind: "tube", key: "esc" })}
            {button(v, { label: "Delete", kind: "danger", icon: "alert" })}
          </View>
        </>,
      )}
    </>,
  );
}
