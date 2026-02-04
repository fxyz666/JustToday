import { useEffect, useState } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
}

// Simple event emitter for notifications
class NotificationService {
  private listeners: ((notification: Notification) => void)[] = [];
  private idCounter = 0;

  subscribe(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(notification: Notification) {
    this.listeners.forEach(listener => listener(notification));
  }

  private generateId(): string {
    return `notification-${++this.idCounter}-${Date.now()}`;
  }

  show(message: string, type: NotificationType = 'info', duration = 3000) {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      duration
    };
    this.emit(notification);
  }

  success(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 4000) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration = 3000) {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration = 4000) {
    this.show(message, 'warning', duration);
  }
}

export const notificationService = new NotificationService();

// Hook for consuming notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      setNotifications(prev => [...prev, notification]);
      
      // Auto remove after duration
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, notification.duration + 300); // +300ms for exit animation
    });

    return unsubscribe;
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return { notifications, removeNotification };
};