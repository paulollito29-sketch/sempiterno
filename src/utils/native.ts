import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function triggerHapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium', enabled = true): Promise<void> {
  if (!enabled) return;
  try {
    if (isNativePlatform()) {
      const mapped =
        style === 'light'
          ? ImpactStyle.Light
          : style === 'heavy'
          ? ImpactStyle.Heavy
          : ImpactStyle.Medium;
      await Haptics.impact({ style: mapped });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(style === 'heavy' ? 40 : style === 'medium' ? 20 : 10);
    }
  } catch {
    // Gracefully ignore haptic errors in unsupported environments
  }
}

export async function triggerHapticSuccess(enabled = true): Promise<void> {
  if (!enabled) return;
  try {
    if (isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 40, 25]);
    }
  } catch {
    // Ignore
  }
}

export async function syncNativeStatusBar(darkMode: boolean): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: darkMode ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: darkMode ? '#0F1015' : '#FAF8F5' });
  } catch {
    // Ignore
  }
}
