// Compact top-right card for an incoming chat message. Tap opens Chat.
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ROLE_LABEL, useMemberNames } from '../../state/hooks';
import { color, font, haptics, space } from '../../ui';

export interface ToastMsg {
  key: string;
  authorHex: string;
  authorName: string;
  body: string;
  counsel: boolean;
}

const nativeDriver = Platform.OS !== 'web';

export function MessageToast({ msg, onDismiss }: { msg: ToastMsg | null; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const names = useMemberNames();
  const anim = useRef(new Animated.Value(0)).current;
  // Keep the last message rendered while animating out.
  const [shown, setShown] = useState<ToastMsg | null>(msg);

  useEffect(() => {
    if (msg) {
      setShown(msg);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: nativeDriver }).start();
      if (Platform.OS !== 'web') haptics.tick();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
  }, [msg, anim]);

  if (!shown) return null;
  const role = names.get(shown.authorHex)?.role;
  const roleLabel = role ? ROLE_LABEL[role] ?? role : undefined;

  const open = () => {
    onDismiss();
    router.push('/(tabs)/chat' as never);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm, right: Math.max(insets.right, 12) }]}>
      <Animated.View
        style={{
          opacity: anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        }}
      >
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`New message from ${shown.authorName}: ${shown.body}. Open chat.`}
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.head}>
            <Text style={styles.name} numberOfLines={1}>{shown.authorName}</Text>
            {roleLabel ? <Text style={styles.role} numberOfLines={1}>{roleLabel}</Text> : null}
            {shown.counsel ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Counsel</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.body} numberOfLines={1}>{shown.body}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 1000, elevation: 1000, maxWidth: 280, minWidth: 200 },
  card: {
    backgroundColor: color.surfaceRaised,
    borderColor: color.hairline,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 14, lineHeight: 18, fontFamily: font.semibold, color: color.text },
  role: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontFamily: font.medium, color: color.textTertiary },
  tag: { marginLeft: 'auto', backgroundColor: color.control, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 11, lineHeight: 15, fontFamily: font.medium, color: color.textSecondary },
  body: { fontSize: 14, lineHeight: 19, fontFamily: font.regular, color: color.textSecondary },
});
