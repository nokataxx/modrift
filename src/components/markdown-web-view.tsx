import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { buildEditorHtml, type CmTheme } from "@/lib/cm/html";

/** FR-37 formatting-toolbar commands (see editor-entry.mjs window.__cm*). */
export type EditCommand =
  | "heading"
  | "bulletList"
  | "numberedList"
  | "checkbox"
  | "bold"
  | "italic"
  | "strikethrough"
  | "code"
  | "quote"
  | "codeBlock"
  | "link"
  | "horizontalRule";

export type MarkdownWebViewHandle = {
  undo: () => void;
  redo: () => void;
  setEditable: (on: boolean) => void;
  /** FR-15: scroll to and flash-highlight a match range (char offsets). */
  reveal: (from: number, to: number) => void;
  /** FR-37: run a formatting-toolbar command on the current selection. */
  runCommand: (command: EditCommand) => void;
};

type Props = {
  /** Initial buffer. The WebView owns the live text after mount; a wholesale
   *  content replacement (file open, "load latest") is done by the parent
   *  remounting this component via `key`. */
  initialContent: string;
  editable: boolean;
  theme: CmTheme;
  /** Localized "[Image: __F__]" template for non-https images. */
  imagePlaceholder?: string;
  /** Allow tapping task checkboxes to toggle them (savable files only). */
  taskInteractive?: boolean;
  /** Preview mode: trim the reading surface's bottom scroll margin. */
  compact?: boolean;
  /** Extra top padding (px) so the first lines clear the floating, transparent
   *  header (FR-38 hide-on-scroll). Baked into the HTML at mount. */
  topInset?: number;
  onChange?: (doc: string) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onLinkPress?: (url: string) => void;
  onReady?: () => void;
  /** Vertical scroll offset (px) of the editor page, for the hide-on-scroll
   *  header. Sourced from an injected JS scroll listener (posted over the
   *  message bridge), not react-native-webview's onScroll. */
  onScroll?: (offsetY: number) => void;
  /** The editor failed to set up (bundle threw, content process gone, or the
   *  HTML failed to load) — the surface would otherwise be a silent black void. */
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The CodeMirror Markdown editor (FR-20) hosted in a WebView, used for both the
 * reading and editing surfaces. Edits are reported via onChange (the RN side
 * owns save/undo-availability state); undo/redo/editable are driven imperatively
 * so toggling preview⇄edit keeps the editor — and its undo history — alive.
 */
export const MarkdownWebView = forwardRef<MarkdownWebViewHandle, Props>(
  function MarkdownWebView(
    {
      initialContent,
      editable,
      theme,
      imagePlaceholder,
      taskInteractive,
      compact,
      topInset,
      onChange,
      onHistoryChange,
      onLinkPress,
      onReady,
      onScroll,
      onError,
      style,
    },
    ref,
  ) {
    const webRef = useRef<WebView>(null);
    // Built once at mount from the initial props; editable then changes via
    // injection (never a reload), and wholesale content changes remount us.
    const [html] = useState(() =>
      buildEditorHtml({
        content: initialContent,
        editable,
        theme,
        imagePlaceholder,
        taskInteractive,
        compact,
        topInset,
      }),
    );
    const editableRef = useRef(editable);
    editableRef.current = editable;
    const taskInteractiveRef = useRef(taskInteractive);
    taskInteractiveRef.current = taskInteractive;

    const inject = useCallback((js: string) => {
      webRef.current?.injectJavaScript(`${js}; true;`);
    }, []);

    // Toggle preview⇄edit in place (no reload). Harmless no-op before the page
    // is ready — the ready handler re-syncs the current editable state.
    useEffect(() => {
      inject(`window.__cmSetEditable && window.__cmSetEditable(${editable})`);
    }, [editable, inject]);

    // Checkbox tap-toggling can change at runtime too (FR-28 edit opt-in
    // flipped in Settings while a file stays mounted).
    useEffect(() => {
      inject(
        `window.__cmSetTaskInteractive && window.__cmSetTaskInteractive(${!!taskInteractive})`,
      );
    }, [taskInteractive, inject]);

    useImperativeHandle(
      ref,
      () => ({
        undo: () => inject("window.__cmUndo && window.__cmUndo()"),
        redo: () => inject("window.__cmRedo && window.__cmRedo()"),
        setEditable: (on: boolean) =>
          inject(`window.__cmSetEditable && window.__cmSetEditable(${on})`),
        reveal: (from: number, to: number) =>
          inject(`window.__cmReveal && window.__cmReveal(${from | 0}, ${to | 0})`),
        runCommand: (command: EditCommand) => {
          // Command keys map to window.__cm<Pascal> (heading → __cmHeading).
          const fn = `__cm${command.charAt(0).toUpperCase()}${command.slice(1)}`;
          inject(`window.${fn} && window.${fn}()`);
        },
      }),
      [inject],
    );

    return (
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={style}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView
        // The page itself scrolls (native UIScrollView) since the editor grows
        // to its content. Without this prop react-native-webview writes its
        // unset ivar (0.0) into scrollView.decelerationRate on every drag,
        // killing fling momentum almost instantly — "normal" is the iOS
        // standard 0.998.
        decelerationRate="normal"
        // Let the page paint on the app background (no white flash pre-init).
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === "change") {
              onChange?.(msg.doc);
              onHistoryChange?.(!!msg.canUndo, !!msg.canRedo);
            } else if (msg.type === "history") {
              onHistoryChange?.(!!msg.canUndo, !!msg.canRedo);
            } else if (msg.type === "link") {
              onLinkPress?.(msg.url);
            } else if (msg.type === "scroll") {
              onScroll?.(msg.y);
            } else if (msg.type === "ready") {
              // Sync editable / task toggling in case they changed between
              // mount and ready.
              inject(
                `window.__cmSetEditable && window.__cmSetEditable(${editableRef.current});` +
                  `window.__cmSetTaskInteractive && window.__cmSetTaskInteractive(${!!taskInteractiveRef.current})`,
              );
              onReady?.();
            } else if (msg.type === "error") {
              // The CodeMirror bundle threw while setting up. Previously this was
              // swallowed, leaving a blank (dark = black) WebView with no signal.
              console.warn("[MarkdownWebView] editor error:", msg.message);
              onError?.(String(msg.message ?? "editor error"));
            }
          } catch {
            // Ignore non-JSON messages.
          }
        }}
        // A blank/black WebView with no JS error usually means the web content
        // process was terminated (memory) or the HTML failed to load — surface
        // both instead of leaving a silent black void.
        onContentProcessDidTerminate={() => {
          console.warn("[MarkdownWebView] content process terminated");
          onError?.("content-process-terminated");
        }}
        onError={(e) => {
          console.warn("[MarkdownWebView] load error:", e.nativeEvent);
          onError?.(String(e.nativeEvent?.description ?? "load error"));
        }}
      />
    );
  },
);
