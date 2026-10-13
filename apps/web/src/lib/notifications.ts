export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

type NotificationListener = (notifications: AppNotification[]) => void;

let notifications: AppNotification[] = [
  {
    id: 'notif-init',
    title: 'SoyBuy Engine Active',
    message: 'PostgreSQL database connected. PuLP optimizer, Quantile GBM, and live price feeds synchronized.',
    type: 'success',
    timestamp: new Date().toISOString(),
    read: false,
  },
];

const listeners: Set<NotificationListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener([...notifications]));
}

export function addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
  const newNotif: AppNotification = {
    ...notif,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifications = [newNotif, ...notifications].slice(0, 50);
  notifyListeners();
}

export function getNotifications(): AppNotification[] {
  return [...notifications];
}

export function markAllAsRead() {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  notifyListeners();
}

export function clearNotifications() {
  notifications = [];
  notifyListeners();
}

export function subscribeNotifications(listener: NotificationListener) {
  listeners.add(listener);
  listener([...notifications]);
  return () => {
    listeners.delete(listener);
  };
}
