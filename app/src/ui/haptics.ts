import * as Haptics from 'expo-haptics';

const safe = (fn: () => Promise<unknown>) => {
  try {
    fn().catch(() => {});
  } catch {
    /* no-op */
  }
};

export const haptics = {
  tick: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};
