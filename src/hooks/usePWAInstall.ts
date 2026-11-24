import { useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

interface PWAInstallSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isInstalling: boolean;
  isDismissedForSession: boolean;
}

const SESSION_DISMISS_KEY = 'abh_pwa_install_modal_dismissed_v1';

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const mediaStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.matchMedia?.('(display-mode: minimal-ui)').matches;
    const navStandalone = (window.navigator as NavigatorWithStandalone).standalone === true;
    return Boolean(mediaStandalone || navStandalone);
  } catch {
    return false;
  }
}

function detectIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isClassicIOS =
    /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isIPadOS =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOS;
}

function readSessionDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSessionDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
  } catch {
    // Ignore restricted storage contexts
  }
}

let snapshot: PWAInstallSnapshot = {
  deferredPrompt: null,
  isInstallable: false,
  isInstalled: detectStandalone(),
  isIOS: detectIOS(),
  isInstalling: false,
  isDismissedForSession: readSessionDismissed(),
};

const listeners = new Set<() => void>();
let initialized = false;

function emit(next: Partial<PWAInstallSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

/**
 * Registers global window listeners once at app startup so `beforeinstallprompt`
 * is never missed across lazy-loaded routes (Home, Admin Dashboard, More, etc.).
 */
export function initPWAInstallListeners(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const standaloneNow = detectStandalone();
  if (standaloneNow !== snapshot.isInstalled) {
    emit({ isInstalled: standaloneNow, deferredPrompt: standaloneNow ? null : snapshot.deferredPrompt, isInstallable: standaloneNow ? false : snapshot.isInstallable });
  }

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    const promptEvent = event as BeforeInstallPromptEvent;
    if (detectStandalone()) {
      emit({ isInstalled: true, deferredPrompt: null, isInstallable: false });
      return;
    }
    emit({
      deferredPrompt: promptEvent,
      isInstallable: true,
      isInstalled: false,
    });
  });

  window.addEventListener('appinstalled', () => {
    emit({
      deferredPrompt: null,
      isInstallable: false,
      isInstalled: true,
      isInstalling: false,
    });
  });

  try {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        emit({
          deferredPrompt: null,
          isInstallable: false,
          isInstalled: true,
          isInstalling: false,
        });
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onDisplayModeChange);
    }
  } catch {
    // Ignore unsupported matchMedia listeners
  }
}

function subscribe(listener: () => void): () => void {
  initPWAInstallListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PWAInstallSnapshot {
  return snapshot;
}

export async function triggerDirectPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const promptEvent = snapshot.deferredPrompt;
  if (!promptEvent || snapshot.isInstalled) {
    return 'unavailable';
  }

  emit({ isInstalling: true });
  try {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      emit({
        deferredPrompt: null,
        isInstallable: false,
        isInstalled: true,
        isInstalling: false,
      });
      return 'accepted';
    }
    // Deferred prompt events are single-use in Chromium; clear after userChoice resolves.
    emit({
      deferredPrompt: null,
      isInstallable: false,
      isInstalling: false,
    });
    return 'dismissed';
  } catch {
    emit({
      deferredPrompt: null,
      isInstallable: false,
      isInstalling: false,
    });
    return 'unavailable';
  }
}

export function dismissPWAInstallForSession(): void {
  writeSessionDismissed();
  emit({ isDismissedForSession: true });
}

export function usePWAInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    deferredPrompt: state.deferredPrompt,
    isInstallable: state.isInstallable,
    isInstalled: state.isInstalled,
    isIOS: state.isIOS,
    isInstalling: state.isInstalling,
    isDismissedForSession: state.isDismissedForSession,
    promptInstall: triggerDirectPWAInstall,
    dismissForSession: dismissPWAInstallForSession,
  };
}
