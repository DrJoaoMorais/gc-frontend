const VAPID_PUBLIC_KEY = "BKaeMBcOGqPsq3XSy638mswPOS9c5ZWrJOVu-xbaclgzl22lSqFgh_P_CCzmJ-TrxDfMua8lLbS6FgDaHJuGIYI";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return navigator.platform || "unknown";
}

function defaultDeviceLabel() {
  const platform = detectPlatform();
  if (platform === "iOS") return "iPhone/iPad";
  if (platform === "macOS") return "Mac";
  return platform;
}

function subscriptionKeys(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh || "",
    authKey: json.keys?.auth || "",
  };
}

export function isPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushStatus() {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
  };
}

export async function enablePushNotifications({ deviceLabel } = {}) {
  if (!isPushSupported()) {
    throw new Error("Este browser/dispositivo não suporta Web Push.");
  }

  const { data: sessionData, error: sessionError } = await window.sb.auth.getSession();
  if (sessionError) throw sessionError;

  const session = sessionData?.session;
  const user = session?.user;
  if (!session || !user) {
    throw new Error("É necessário iniciar sessão no Gestão Clínica.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "As notificações foram recusadas neste dispositivo."
        : "A autorização para notificações não foi concedida."
    );
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { endpoint, p256dh, authKey } = subscriptionKeys(subscription);
  if (!endpoint || !p256dh || !authKey) {
    throw new Error("A subscrição Push criada pelo browser está incompleta.");
  }

  const row = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth_key: authKey,
    device_label: String(deviceLabel || defaultDeviceLabel()).slice(0, 120),
    user_agent: String(navigator.userAgent || "").slice(0, 1000),
    platform: String(detectPlatform()).slice(0, 120),
    is_active: true,
    last_used_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await window.sb
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" })
    .select("id, endpoint, device_label, platform, is_active, created_at, updated_at")
    .single();

  if (error) {
    try {
      await subscription.unsubscribe();
    } catch (_) {
      // Não mascarar o erro real de persistência.
    }
    throw error;
  }

  return {
    ok: true,
    permission,
    subscription: data,
  };
}
