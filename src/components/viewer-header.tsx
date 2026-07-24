import { SymbolView } from "expo-symbols";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

// FR-38: the viewer's own header, rendered instead of the native navigation
// header so that hide-on-scroll can slide it with a reanimated shared value on
// the UI thread — without any React re-render or native-nav change mid-scroll.
// It floats over the full-height editor (the editor's topInset keeps text clear
// of it), so showing/hiding it never resizes the content.
export function ViewerHeader({
  progress,
  insetTop,
  barHeight,
  title,
  renameable,
  onRename,
  onBack,
  right,
}: {
  // 0 = fully shown, 1 = fully hidden (slid up out of view).
  progress: SharedValue<number>;
  insetTop: number;
  barHeight: number;
  title: string;
  renameable: boolean;
  onRename: () => void;
  onBack: () => void;
  right?: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const height = insetTop + barHeight;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.value * height }],
  }));
  return (
    <Animated.View
      style={[
        styles.header,
        {
          height,
          paddingTop: insetTop,
          backgroundColor: theme.background,
          borderBottomColor: theme.backgroundElement,
        },
        animatedStyle,
      ]}
    >
      <View style={[styles.bar, { height: barHeight }]}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.left}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <SymbolView name="chevron.backward" size={20} weight="semibold" tintColor={theme.text} />
        </Pressable>
        <Pressable
          onLongPress={renameable ? onRename : undefined}
          disabled={!renameable}
          style={styles.center}
          accessibilityRole="header"
        >
          <ThemedText numberOfLines={1} style={styles.title}>
            {title}
          </ThemedText>
        </Pressable>
        <View style={styles.right}>{right}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The nav-bar row below the status-bar inset. Positioned children so the title
  // stays screen-centred regardless of the left/right button widths (iOS-like).
  bar: {
    position: "relative",
    justifyContent: "center",
  },
  left: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  right: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    left: 56,
    right: 56,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
});
