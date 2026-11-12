// The one text field of the app, as the text-editing decision asks: every field, of one line or
// many, is Native Shell's editor through `TextEditor` (`crates/app/src/vim_bridge.rs`), drawn on
// a well. It highlights Markdown, wraps, never scrolls sideways, and runs Vim's keys while the
// setting is on, the layer in Rust and every key handled there.
//
// Its keys, the keyboard guide's "In a field":
// - Escape leaves the field, keeping its text, or is the layer's Escape in an overlay. With Vim,
//   insert mode goes to normal mode first, and Escape in normal mode is the field's own, in an
//   overlay too, which hands its Escape to the field that has the focus (`escapeHeld`).
//   Shift+Escape leaves from any mode.
// - Ctrl+Enter, and `:w` with Vim, save: `onSave`. Plain Enter never saves: in a field of several
//   lines it adds a line, unless the field is a send and says so with `onEnter`; in a one-line
//   field it is `onEnter`, or its owner's Enter, as a picker's.
// - The keys its owner declares `inField` in the key registry reach the owner before the editor:
//   a dialog's Tab, a picker's arrows.
import {
  type Accessor,
  cleanup,
  computed,
  signal,
  type StyleProp,
  untracked,
  View,
  type ViewStyle,
} from "nsh";
import { type CaretTrail, TextEditor, type VimStatus } from "uraeda/native";
import { Under } from "../controls";
import { fieldFocused, keysOn, pressKeys } from "../keys/registry";
import { strokeOf } from "../keys/token";
import { focusAsked, focusStop, Well } from "../surfaces";
import { interaction } from "../timing";
import { alpha, tokens } from "../tokens";
import { isNarrow } from "../width";
import { Trail, trails } from "./Trail";

export type { VimStatus } from "uraeda/native";

/** A field's text on a phone, in points: the least iOS takes without zooming in. */
const FIELD_ON_PHONE = 16;

/** What a field's ref does: what an owner asks of the field itself. */
export type TextFieldRef = {
  blur(): void;
  /** Takes the focus, with the caret at the end of the text when it was at its start. */
  focus(): void;
  /** Takes the focus, the caret where it was. */
  resume(): void;
  /** Puts the caret at the start of line `line`, from 0, in the middle of the view, focused. */
  goToLine(line: number): void;
  /** Types `text` at the caret, as a paste: an image's link a screen dropped in. */
  insert(text: string): void;
  /** Presses a key in the field, as typed: the Escape an overlay took first. */
  press(stroke: string): void;
};

export type TextFieldProps = {
  /** Takes the focus as it mounts, where the screen asks: on GTK a field takes none by itself. */
  autoFocus?: boolean;
  /** Shown dimmed, and takes neither the focus nor typing. */
  disabled?: boolean;
  /** In an overlay, the stop that takes the focus as it opens. */
  first?: boolean;
  /** Words that help, under it while nothing is refused. */
  hint?: string;
  /** What screen readers call it. */
  label: string;
  /**
   * The language its text is highlighted as: a name, an extension, or a file's path, as
   * `crates/app/src/lib.rs`; Markdown when none is named.
   */
  language?: string;
  /** One line, a slug's or a search's, which wraps but never takes a line break; many by default. */
  lines?: "one" | "many";
  /** With Vim, it opens in normal mode, as a buffer: else it opens typing. */
  normalFirst?: boolean;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  /**
   * Enter, when no owner's Enter is on: a one-line field's, or a field of several lines whose
   * whole purpose is a send, as a composer's, where Shift+Enter then adds a line. Never a save.
   */
  onEnter?: () => void;
  onFocus?: () => void;
  /** `:q` with Vim, and `:wq` after its save: leave what the field is for, as a buffer's Back. */
  onQuit?: () => void;
  /** Ctrl+Enter, and `:w` with Vim: save what it holds, as its button does. */
  onSave?: () => void;
  placeholder?: string;
  /** Whether its text can only be read and copied. */
  readOnly?: boolean;
  ref?: (field: TextFieldRef) => void;
  /** Why the server refused the last save, with the way out, under the field. */
  refusal?: string | null;
  /**
   * Drawn still, as the gallery's pictures: with the focus's look, in a Vim mode's colour when
   * one is named ("NORMAL", "INSERT", "VISUAL", "REPLACE", "COMMAND"). It then takes no typing.
   */
  shown?: "focus" | string;
  /** The rows of a field of several lines: it grows with its text from `min` to `max`. */
  rows?: { max?: number; min?: number };
  style?: StyleProp<ViewStyle>;
  testID?: string;
  value: string;
};

const NO_FIELD: VimStatus = { mode: "", pending: "" };

/** The Vim mode of the field that has the focus, for the status line: `mode` is "" with none. */
export const vimStatus = signal<VimStatus>(NO_FIELD);

const vimSetting = signal(false);

/** Whether fields edit with Vim's keys: the setting, which the app's shell reads from the server. */
export const vimMode: Accessor<boolean> = vimSetting;

/** Turns Vim's keys on or off in every field, as the setting says. Off until the human turns it on. */
export function setVimMode(on: boolean) {
  vimSetting.set(on);
}

/** The editing mode's colour of a Vim mode, as the status line's ends and the field take it. */
export function modeTone(mode: string): string {
  const tones = tokens.light.mode;
  if (!tokens.light.modeColours) {
    return tones.normal;
  }
  if (mode.startsWith("VISUAL")) {
    return tones.visual;
  }
  const named: Record<string, string> = {
    COMMAND: tones.command,
    INSERT: tones.insert,
    REPLACE: tones.replace,
  };
  return named[mode] ?? tones.normal;
}

/** The keys the owners around a field hear in it, by their keystrokes: each one's token. */
const ownerKeys = computed(() => {
  const keys = new Map<string, string>();
  for (const { spec } of keysOn()) {
    const stroke = spec.inField === true && !spec.keys.includes(" ") ? strokeOf(spec.keys) : null;
    if (stroke !== null) {
      keys.set(stroke, spec.keys);
    }
  }
  return keys;
});

/** The editor's ref, whose focus says it was asked for (`focusAsked`): GTK's own is not. */
/** `take`, once it said the focus is asked for. */
const asked =
  <A extends unknown[]>(take: (...args: A) => void) =>
  (...args: A) => {
    focusAsked();
    take(...args);
  };

function asking(node: TextFieldRef): TextFieldRef {
  return {
    blur: () => node.blur(),
    focus: asked(() => node.focus()),
    goToLine: asked((line: number) => node.goToLine(line)),
    insert: (text) => node.insert(text),
    press: (stroke) => node.press(stroke),
    resume: asked(() => node.resume()),
  };
}

/** The token of the key an owner hears in a field, by its keystroke. */
const owner = (stroke: string) => ownerKeys().get(stroke);

export function TextField(props: TextFieldProps) {
  let editor: TextFieldRef | undefined;
  const stop = focusStop(() => (props.disabled === true ? undefined : editor), {
    disabled: () => props.disabled === true,
    escape: () => editor?.press("escape"),
    first: props.first,
  });
  const status = signal<VimStatus>(NO_FIELD);
  // A field that goes while the status line shows its mode, a picker's filter closed by its Enter,
  // takes its mode away with it: no INSERT stays on a page with no field.
  let reported: VimStatus | null = null;
  // Who this field is to the key registry, which hints only its keys while it has the focus; a
  // field taken away with the focus gives it back.
  const self = {};
  cleanup(() => {
    if (reported !== null && untracked(vimStatus) === reported) vimStatus.set(NO_FIELD);
    fieldFocused(self, false);
  });
  const jump = signal<CaretTrail | null>(null);
  const vim = () => vimMode() && props.readOnly !== true;
  const shownMode = () =>
    props.shown !== undefined && props.shown !== "focus" ? props.shown : null;
  const tone = () => {
    const still = shownMode();
    if (still !== null) {
      return modeTone(still);
    }
    return vim() ? modeTone(status().mode) : tokens.light.focus;
  };
  const oneLine = () => props.lines === "one";

  const heard = (key: string) => {
    switch (key) {
      case "save":
        props.onSave?.();
        return;
      case "leave":
        editor?.blur();
        return;
      case "quit":
        if (props.onQuit !== undefined) {
          props.onQuit();
          return;
        }
      // Without its owner's quit, `:q` is the field's Escape.
      // falls through
      case "escape": {
        const escape = owner("escape");
        if (escape === undefined) {
          editor?.blur();
        } else {
          pressKeys(escape);
        }
        return;
      }
      case "enter": {
        const enter = owner("enter");
        if (enter === undefined) {
          props.onEnter?.();
        } else {
          pressKeys(enter);
        }
        return;
      }
      default: {
        const token = owner(key);
        if (token !== undefined) {
          pressKeys(token);
        }
      }
    }
  };

  const styles = () => ({
    caret: { backgroundColor: tone(), width: 2 },
    placeholder: { color: tokens.role.inkFaint },
    selection: { backgroundColor: alpha(tone(), 0.3) },
  });
  const rows = () =>
    oneLine() ? { max: 6, min: 1 } : { max: props.rows?.max ?? 20, min: props.rows?.min ?? 3 };

  return (
    <Under
      hint={props.hint}
      refusal={props.refusal}
      style={[{ alignSelf: "stretch" }, props.style]}
    >
      <Well
        focused={props.shown !== undefined || stop.focused()}
        // On a phone the whole frame, a thumb's size, takes the tap: the editor's line alone is 24.
        onPress={
          isNarrow() && props.disabled !== true && props.readOnly !== true
            ? () => editor?.resume()
            : undefined
        }
        style={{
          alignSelf: "stretch",
          borderStyle: props.disabled === true ? "dashed" : "solid",
          // A thumb's size on a phone, its line in its middle (the phone guide's "Touch").
          justifyContent: "center",
          minHeight: oneLine() && isNarrow() ? tokens.control.touch : undefined,
          opacity: props.disabled === true ? 0.6 : 1,
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
        testID={props.testID}
        tone={vim() || shownMode() !== null ? tone() : undefined}
      >
        <View style={{ alignSelf: "stretch" }}>
          <TextEditor
            accessibilityLabel={props.label}
            block={{ backgroundColor: alpha(tone(), 0.45) }}
            fontFamily={tokens.type.markdown}
            // 16 on a phone: iOS zooms the page into a field whose text is smaller.
            fontSize={isNarrow() ? FIELD_ON_PHONE : tokens.type.size}
            keys={[...ownerKeys().keys()]}
            language={props.language}
            lineHeight={tokens.type.line}
            maxRows={rows().max}
            minRows={rows().min}
            normalFirst={props.normalFirst === true}
            oneLine={oneLine()}
            onBlur={() => {
              stop.onBlur();
              fieldFocused(self, false);
              status.set(NO_FIELD);
              vimStatus.set(NO_FIELD);
              props.onBlur?.();
            }}
            onChange={({ value }) => {
              // A key typed, not the text set as the field is made or given another value.
              if (untracked(stop.focused)) interaction(`typing in ${props.label}`, { joins: true });
              props.onChange?.(value);
            }}
            onFocus={() => {
              stop.onFocus();
              fieldFocused(self, true);
              props.onFocus?.();
            }}
            onKey={({ key }) => heard(key)}
            onStatus={({ status: now }) => {
              status.set(now);
              vimStatus.set(now);
              reported = now;
            }}
            onTrail={({ trail }) => jump.set(trail)}
            placeholder={props.placeholder}
            readOnly={
              props.readOnly === true || props.disabled === true || props.shown !== undefined
            }
            ref={(node: TextFieldRef) => {
              editor = asking(node);
              props.ref?.(editor);
              if (props.autoFocus === true && props.disabled !== true) {
                // Once the editor inside is made: on GTK a field takes no focus by itself.
                const made = editor;
                setTimeout(() => made.focus(), 0);
              }
            }}
            styles={styles()}
            takesEnter={!oneLine() && props.onEnter !== undefined}
            trail={trails()}
            value={props.value}
            vim={vim()}
          />
          <Trail jump={jump()} tone={tone()} />
        </View>
      </Well>
    </Under>
  );
}
