import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn-dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import type { AuthFileModelItem } from '@/features/authFiles/constants';
import { isModelExcluded } from '@/features/authFiles/constants';
import styles from '@/pages/AuthFilesPage.module.scss';

export type AuthFileModelsModalProps = {
  open: boolean;
  fileName: string;
  fileType: string;
  loading: boolean;
  error: 'unsupported' | null;
  models: AuthFileModelItem[];
  excluded: Record<string, string[]>;
  onClose: () => void;
  onCopyText: (text: string) => void;
};

export function AuthFileModelsModal(props: AuthFileModelsModalProps) {
  const { t } = useTranslation();
  const { open, fileName, fileType, loading, error, models, excluded, onClose, onCopyText } = props;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className={styles.modelsDialogContent}>
        <DialogHeader>
          <DialogTitle>
            {t('auth_files.models_title', { defaultValue: '支持的模型' })} - {fileName}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className={styles.hint}>
            {t('auth_files.models_loading', { defaultValue: '正在加载模型列表...' })}
          </div>
        ) : error === 'unsupported' ? (
          <Empty className={styles.modalEmptyState}>
            <EmptyHeader>
              <EmptyTitle>
                {t('auth_files.models_unsupported', { defaultValue: '当前版本不支持此功能' })}
              </EmptyTitle>
              <EmptyDescription>
                {t('auth_files.models_unsupported_desc', {
                  defaultValue: '请更新 CLI Proxy API 到最新版本后重试',
                })}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : models.length === 0 ? (
          <Empty className={styles.modalEmptyState}>
            <EmptyHeader>
              <EmptyTitle>
                {t('auth_files.models_empty', { defaultValue: '该凭证暂无可用模型' })}
              </EmptyTitle>
              <EmptyDescription>
                {t('auth_files.models_empty_desc', {
                  defaultValue: '该认证凭证可能尚未被服务器加载或没有绑定任何模型',
                })}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className={styles.modelsList}>
            {models.map((model) => {
              const excludedModel = isModelExcluded(model.id, fileType, excluded);
              return (
                <div
                  key={model.id}
                  className={`${styles.modelItem} ${excludedModel ? styles.modelItemExcluded : ''}`}
                  onClick={() => {
                    onCopyText(model.id);
                  }}
                  title={
                    excludedModel
                      ? t('auth_files.models_excluded_hint', {
                          defaultValue: '此 OAuth 模型已被禁用',
                        })
                      : t('common.copy', { defaultValue: '点击复制' })
                  }
                >
                  <span className={styles.modelId}>{model.id}</span>
                  {model.display_name && model.display_name !== model.id && (
                    <span className={styles.modelDisplayName}>{model.display_name}</span>
                  )}
                  {model.type && <span className={styles.modelType}>{model.type}</span>}
                  {excludedModel && (
                    <span className={styles.modelExcludedBadge}>
                      {t('auth_files.models_excluded_badge', { defaultValue: '已禁用' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

