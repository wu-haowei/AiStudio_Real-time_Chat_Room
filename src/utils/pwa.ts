let deferredPrompt: any = null;

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
        },
        (err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        }
      );
    });
  }
}

export function initPWAInstallListener(onInstallableChange: (installable: boolean) => void) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    onInstallableChange(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onInstallableChange(false);
    console.log('[PWA] Application was successfully installed');
  });
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    alert('如果沒有出現安裝按鈕，您可以點擊瀏覽器選單並選擇「新增至主畫面」或「安裝應用程式」。');
    return false;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    alert('您的瀏覽器不支援桌面通知功能');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export function triggerDesktopNotification(title: string, body: string, icon = '/pwa-192x192.svg') {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon,
            badge: icon,
            vibrate: [100, 50, 100],
            tag: 'chat-message'
          } as any);
        });
      } else {
        new Notification(title, {
          body,
          icon
        });
      }
    } catch (e) {
      console.warn('Failed to send notification:', e);
    }
  }
}
