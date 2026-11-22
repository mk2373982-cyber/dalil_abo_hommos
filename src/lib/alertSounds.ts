/**
 * Zero-cost client-side Web Audio API chimes & optional browser Notifications.
 * No audio files hosted, no push server required.
 */

type ChimeVariant = 'order' | 'turn' | 'gentle';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function playNotificationChime(variant: ChimeVariant = 'order'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes =
      variant === 'turn'
        ? [
            { freq: 659.25, start: 0, dur: 0.16 },
            { freq: 880, start: 0.18, dur: 0.18 },
            { freq: 1046.5, start: 0.38, dur: 0.28 },
          ]
        : variant === 'order'
        ? [
            { freq: 587.33, start: 0, dur: 0.15 },
            { freq: 880, start: 0.16, dur: 0.24 },
          ]
        : [{ freq: 740, start: 0, dur: 0.14 }];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.dur + 0.02);
    }
  } catch {
    // Audio playback may be blocked until first user gesture
  }
}

export function triggerVibration(pattern: number[] = [180, 90, 180]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported browsers
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function triggerBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      dir: 'rtl',
      lang: 'ar',
    });
  } catch {
    // ignore notification restrictions inside iframes
  }
}
