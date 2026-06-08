import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNotificationStore } from '@/stores';

export function ConfirmationModal() {
  const { t } = useTranslation();
  const confirmation = useNotificationStore((state) => state.confirmation);
  const hideConfirmation = useNotificationStore((state) => state.hideConfirmation);
  const setConfirmationLoading = useNotificationStore((state) => state.setConfirmationLoading);

  const { isOpen, isLoading, options } = confirmation;

  if (!isOpen || !options) {
    return null;
  }

  const { title, message, onConfirm, onCancel, confirmText, cancelText, variant = 'primary' } = options;
  const actionVariant =
    variant === 'danger' ? 'destructive' : variant === 'secondary' ? 'secondary' : 'default';

  const handleConfirm = async () => {
    try {
      setConfirmationLoading(true);
      await onConfirm();
      hideConfirmation();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      // Optional: show error notification here if needed, 
      // but usually the calling component handles specific errors.
    } finally {
      setConfirmationLoading(false);
    }
  };

  const handleCancel = () => {
    if (isLoading) {
      return;
    }
    if (onCancel) {
      onCancel();
    }
    hideConfirmation();
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isLoading) {
          handleCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || t('common.confirm')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {typeof message === 'string' ? <p>{message}</p> : <div>{message}</div>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault();
              handleCancel();
            }}
          >
            {cancelText || t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={actionVariant}
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {isLoading ? t('common.loading') : confirmText || t('common.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
