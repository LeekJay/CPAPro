import { useTranslation } from 'react-i18next';
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn-dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type {
  PrefixProxyEditorField,
  PrefixProxyEditorFieldValue,
  PrefixProxyEditorState,
} from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import styles from '@/pages/AuthFilesPage.module.scss';

export type AuthFilesPrefixProxyEditorModalProps = {
  disableControls: boolean;
  editor: PrefixProxyEditorState | null;
  updatedText: string;
  dirty: boolean;
  onClose: () => void;
  onCopyText: (text: string) => void | Promise<void>;
  onSave: () => void;
  onChange: (field: PrefixProxyEditorField, value: PrefixProxyEditorFieldValue) => void;
};

export function AuthFilesPrefixProxyEditorModal(props: AuthFilesPrefixProxyEditorModalProps) {
  const { t } = useTranslation();
  const { disableControls, editor, updatedText, dirty, onClose, onCopyText, onSave, onChange } =
    props;
  const formatJsonText = (text: string) => {
    if (!text) return '';
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };
  const previewText = formatJsonText(updatedText);
  const invalidContentPreview = editor?.invalidContentPreview ?? '';

  return (
    <Dialog
      open={Boolean(editor)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && editor?.saving !== true) onClose();
      }}
    >
      <DialogContent
        className={styles.prefixProxyDialogContent}
        showCloseButton={editor?.saving !== true}
      >
        <DialogHeader>
          <DialogTitle>
            {editor?.fileName
              ? t('auth_files.auth_field_editor_title', { name: editor.fileName })
              : t('auth_files.prefix_proxy_button')}
          </DialogTitle>
        </DialogHeader>
        {editor && (
          <div className={styles.prefixProxyEditor}>
            {editor.loading ? (
              <div className={styles.prefixProxyLoading}>
                <LoaderCircleIcon className={styles.prefixProxySpinner} />
                <span>{t('auth_files.prefix_proxy_loading')}</span>
              </div>
            ) : (
              <>
                {editor.error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertDescription>{editor.error}</AlertDescription>
                  </Alert>
                )}
                <div className={styles.prefixProxyJsonWrapper}>
                  <label className={styles.prefixProxyLabel}>
                    {t('auth_files.prefix_proxy_info_label')}
                  </label>
                  <textarea
                    className={styles.prefixProxyTextarea}
                    rows={6}
                    readOnly
                    value={editor.fileInfoText}
                  />
                </div>
                <div className={styles.prefixProxyJsonWrapper}>
                  <label className={styles.prefixProxyLabel}>
                    {editor.json
                      ? t('auth_files.prefix_proxy_source_label')
                      : t('auth_files.prefix_proxy_invalid_content_label')}
                  </label>
                  {editor.json ? (
                    <textarea
                      className={styles.prefixProxyTextarea}
                      rows={8}
                      readOnly
                      value={previewText}
                    />
                  ) : (
                    <pre className={styles.prefixProxyInvalidContentPreview}>
                      {invalidContentPreview}
                    </pre>
                  )}
                </div>
                {editor.json && (
                  <div className={styles.prefixProxyFields}>
                    <Input
                      label={t('auth_files.prefix_label')}
                      value={editor.prefix}
                      disabled={disableControls || editor.saving || !editor.json}
                      onChange={(e) => onChange('prefix', e.target.value)}
                    />
                    <Input
                      label={t('auth_files.proxy_url_label')}
                      value={editor.proxyUrl}
                      placeholder={t('auth_files.proxy_url_placeholder')}
                      disabled={disableControls || editor.saving || !editor.json}
                      onChange={(e) => onChange('proxyUrl', e.target.value)}
                    />
                    <Input
                      label={t('auth_files.priority_label')}
                      value={editor.priority}
                      placeholder={t('auth_files.priority_placeholder')}
                      hint={t('auth_files.priority_hint')}
                      disabled={disableControls || editor.saving || !editor.json}
                      onChange={(e) => onChange('priority', e.target.value)}
                    />
                    {editor.providerKey === 'codex' && (
                      <div className={styles.prefixProxySwitchRow}>
                        <Switch
                          checked={editor.websockets}
                          onCheckedChange={(value) => onChange('websockets', value)}
                          disabled={disableControls || editor.saving || !editor.json}
                          aria-label={t('auth_files.codex_websockets_label')}
                          size="sm"
                        />
                        <div className={styles.prefixProxySwitchCopy}>
                          <div className={styles.prefixProxyLabel}>
                            {t('auth_files.codex_websockets_label')}
                          </div>
                          <div className={styles.hint}>{t('auth_files.codex_websockets_hint')}</div>
                        </div>
                      </div>
                    )}
                    <div className="form-group">
                      <label>{t('auth_files.headers_label')}</label>
                      <textarea
                        className={`input ${editor.headersError ? styles.prefixProxyTextareaInvalid : ''}`}
                        value={editor.headersText}
                        placeholder={t('auth_files.headers_placeholder')}
                        rows={4}
                        aria-invalid={Boolean(editor.headersError)}
                        disabled={disableControls || editor.saving || !editor.json}
                        onChange={(e) => onChange('headersText', e.target.value)}
                      />
                      {editor.headersError && (
                        <Alert variant="destructive">
                          <AlertCircleIcon />
                          <AlertDescription>{editor.headersError}</AlertDescription>
                        </Alert>
                      )}
                      <div className="hint">{t('auth_files.headers_hint')}</div>
                    </div>
                    <Input
                      label={t('auth_files.note_label')}
                      value={editor.note}
                      placeholder={t('auth_files.note_placeholder')}
                      hint={t('auth_files.note_hint')}
                      disabled={disableControls || editor.saving || !editor.json}
                      onChange={(e) => onChange('note', e.target.value)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={editor?.saving === true}>
            {dirty ? t('common.cancel') : t('common.close')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!updatedText) return;
              void onCopyText(updatedText);
            }}
            disabled={editor?.saving === true || !updatedText}
          >
            {t('common.copy')}
          </Button>
          <Button
            onClick={onSave}
            loading={editor?.saving === true}
            disabled={
              disableControls ||
              editor?.saving === true ||
              !dirty ||
              !editor?.json ||
              Boolean(editor?.headersTouched && editor.headersError)
            }
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
