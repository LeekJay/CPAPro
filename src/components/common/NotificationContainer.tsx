import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon
} from 'lucide-react';
import { useNotificationStore } from '@/stores';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/types';

interface AnimatedNotification extends Notification {
  isExiting?: boolean;
}

const ANIMATION_DURATION = 300; // ms
const NOTIFICATION_ICON: Record<Notification['type'], LucideIcon> = {
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: TriangleAlertIcon,
  error: AlertCircleIcon
};

export function NotificationContainer() {
  const { t } = useTranslation();
  const { notifications, removeNotification } = useNotificationStore();
  const [animatedNotifications, setAnimatedNotifications] = useState<AnimatedNotification[]>([]);
  const prevNotificationsRef = useRef<Notification[]>([]);

  useEffect(() => {
    const prevNotifications = prevNotificationsRef.current;
    const prevIds = new Set(prevNotifications.map((n) => n.id));
    const currentIds = new Set(notifications.map((n) => n.id));

    const newNotifications = notifications.filter((n) => !prevIds.has(n.id));

    const removedIds = new Set(prevNotifications.filter((n) => !currentIds.has(n.id)).map((n) => n.id));

    setAnimatedNotifications((prev) => {
      let updated = prev.map((n) => (removedIds.has(n.id) ? { ...n, isExiting: true } : n));

      newNotifications.forEach((n) => {
        if (!updated.find((animatedNotification) => animatedNotification.id === n.id)) {
          updated.push({ ...n, isExiting: false });
        }
      });

      updated = updated.filter((n) => currentIds.has(n.id) || n.isExiting);

      return updated;
    });

    if (removedIds.size > 0) {
      setTimeout(() => {
        setAnimatedNotifications((prev) => prev.filter((n) => !removedIds.has(n.id)));
      }, ANIMATION_DURATION);
    }

    prevNotificationsRef.current = notifications;
  }, [notifications]);

  const handleClose = (id: string) => {
    setAnimatedNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isExiting: true } : n)));

    setTimeout(() => {
      removeNotification(id);
    }, ANIMATION_DURATION);
  };

  if (!animatedNotifications.length) return null;

  return (
    <div className="notification-container">
      {animatedNotifications.map((notification) => {
        const Icon = NOTIFICATION_ICON[notification.type];

        return (
          <Alert
            key={notification.id}
            variant={notification.type === 'error' ? 'destructive' : 'default'}
            className={`notification ${notification.isExiting ? 'exiting' : 'entering'}`}
          >
            <Icon data-icon="inline-start" />
            <AlertDescription>{notification.message}</AlertDescription>
            <AlertAction>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => handleClose(notification.id)}
                aria-label={t('common.close')}
              >
                <XIcon data-icon="inline-start" />
              </Button>
            </AlertAction>
          </Alert>
        );
      })}
    </div>
  );
}
