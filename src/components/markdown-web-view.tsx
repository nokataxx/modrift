import { useState } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

import { buildViewerHtml, type CmTheme } from "@/lib/cm/html";

type Props = {
  /** The document. Baked into the HTML at mount; a different file remounts
   *  this component via `key`. */
  content: string;
  theme: CmTheme;
  /** Localized "[Image: __F__]" template for non-https images. */
  imagePlaceholder?: string;
  /** Settings preview: trim the reading surface's bottom scroll margin. */
  compact?: boolean;
  /** Extra top padding (px) so the first lines clear the floating header
   *  (hide-on-scroll). Baked into the HTML at mount. */
  topInset?: number;
  onLinkPress?: (url: string) => void;
  /** Vertical scroll offset (px) of the page, for the hide-on-scroll header.
   *  Sourced from an injected JS scroll listener (posted over the message
   *  bridge), not react-native-webview's onScroll. */
  onScroll?: (offsetY: number) => void;
  /** The viewer failed to set up (bundle threw, content process gone, or the
   *  HTML failed to load) — the surface would otherwise be a silent black void. */
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The CodeMirror Markdown viewer hosted in a WebView, used by the viewer screen
 * and the settings preview. Read-only: the RN side only hears about link taps,
 * scrolling and failures.
 */
export function MarkdownWebView({
  content,
  theme,
  imagePlaceholder,
  compact,
  topInset,
  onLinkPress,
  onScroll,
  onError,
  style,
}: Props) {
  // Built once at mount; a different document remounts us.
  const [html] = useState(() =>
    buildViewerHtml({ content, theme, imagePlaceholder, compact, topInset }),
  );

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      style={style}
      // The page itself scrolls (native UIScrollView) since the document grows
      // to its content. Without this prop react-native-webview writes its
      // unset ivar (0.0) into scrollView.decelerationRate on every drag,
      // killing fling momentum almost instantly — "normal" is the iOS
      // standard 0.998.
      decelerationRate="normal"
      onMessage={(e) => {
        try {
          const msg = JSON.parse(e.nativeEvent.data);
          if (msg.type === "link") {
            onLinkPress?.(msg.url);
          } else if (msg.type === "scroll") {
            onScroll?.(msg.y);
          } else if (msg.type === "error") {
            // The CodeMirror bundle threw while setting up. Previously this was
            // swallowed, leaving a blank (dark = black) WebView with no signal.
            console.warn("[MarkdownWebView] viewer error:", msg.message);
            onError?.(String(msg.message ?? "viewer error"));
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
}
