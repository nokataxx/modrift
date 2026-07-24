import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { type EditCommand } from "@/components/markdown-web-view";
import { Spacing } from "@/theme";

// FR-37: the formatting toolbar shown above the keyboard while editing. Each
// button runs a Markdown command on the current selection (toggle a heading /
// list / checkbox, wrap emphasis, insert a link / rule …) so the user rarely
// types raw syntax. undo/redo are pinned at the left (thumb-reachable, always
// visible); the format buttons scroll to their right. Icons carry meaning by
// shape and share one neutral tint.
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

function ToolButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && { backgroundColor: theme.backgroundElement },
      ]}
    >
      <SymbolView
        name={icon}
        size={22}
        weight="regular"
        tintColor={disabled ? theme.textSecondary : theme.text}
      />
    </Pressable>
  );
}

export function EditToolbar({
  onCommand,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  onCommand: (cmd: EditCommand) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.background, borderTopColor: theme.backgroundElement },
      ]}
    >
      {/* Pinned, always-visible undo/redo. */}
      <View style={styles.fixed}>
        <ToolButton
          icon="arrow.uturn.backward"
          label={t("screens.viewer.undo")}
          onPress={onUndo}
          disabled={!canUndo}
        />
        <ToolButton
          icon="arrow.uturn.forward"
          label={t("screens.viewer.redo")}
          onPress={onRedo}
          disabled={!canRedo}
        />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Register the tap without first dismissing the keyboard, so the editor
        // keeps focus and the toolbar stays put.
        keyboardShouldPersistTaps="always"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {BUTTONS.map((b) => (
          <ToolButton
            key={b.cmd}
            icon={b.icon}
            label={t(b.labelKey)}
            onPress={() => onCommand(b.cmd)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.one,
  },
  fixed: {
    flexDirection: "row",
    paddingLeft: Spacing.one,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: Spacing.one,
    marginHorizontal: Spacing.one,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingRight: Spacing.one,
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
