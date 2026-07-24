import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { type EditCommand } from "@/components/markdown-web-view";
import { Spacing } from "@/theme";

// FR-37: the formatting toolbar shown above the keyboard while editing. Each
// button runs a Markdown command on the current selection (toggle a heading /
// list / checkbox, wrap emphasis, insert a link / rule …) so the user rarely
// types raw syntax. Icons carry meaning by shape and share one neutral tint.
type ToolbarButton = {
  cmd: EditCommand;
  icon: SymbolViewProps["name"];
  labelKey: string;
};

// Grouped left→right: headings, lists, inline emphasis, then blocks. The order
// stays fixed; the row scrolls horizontally when it overflows the width.
const BUTTONS: ToolbarButton[] = [
  { cmd: "heading", icon: "number", labelKey: "screens.viewer.toolbar.heading" },
  { cmd: "bulletList", icon: "list.bullet", labelKey: "screens.viewer.toolbar.bulletList" },
  { cmd: "numberedList", icon: "list.number", labelKey: "screens.viewer.toolbar.numberedList" },
  { cmd: "checkbox", icon: "checklist", labelKey: "screens.viewer.toolbar.checkbox" },
  { cmd: "bold", icon: "bold", labelKey: "screens.viewer.toolbar.bold" },
  { cmd: "italic", icon: "italic", labelKey: "screens.viewer.toolbar.italic" },
  { cmd: "strikethrough", icon: "strikethrough", labelKey: "screens.viewer.toolbar.strikethrough" },
  {
    cmd: "code",
    icon: "chevron.left.forwardslash.chevron.right",
    labelKey: "screens.viewer.toolbar.code",
  },
  { cmd: "quote", icon: "text.quote", labelKey: "screens.viewer.toolbar.quote" },
  { cmd: "codeBlock", icon: "curlybraces", labelKey: "screens.viewer.toolbar.codeBlock" },
  { cmd: "link", icon: "link", labelKey: "screens.viewer.toolbar.link" },
  { cmd: "horizontalRule", icon: "minus", labelKey: "screens.viewer.toolbar.horizontalRule" },
];

export function EditToolbar({ onCommand }: { onCommand: (cmd: EditCommand) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.backgroundElement }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Register the tap without first dismissing the keyboard, so the editor
        // keeps focus and the toolbar stays put.
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.content}
      >
        {BUTTONS.map((b) => (
          <Pressable
            key={b.cmd}
            onPress={() => onCommand(b.cmd)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t(b.labelKey)}
            style={({ pressed }) => [
              styles.button,
              pressed && { backgroundColor: theme.backgroundElement },
            ]}
          >
            <SymbolView name={b.icon} size={22} weight="regular" tintColor={theme.text} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
