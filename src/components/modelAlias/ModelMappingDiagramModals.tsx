import type { KeyboardEvent, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn-dialog';
import { Switch } from '@/components/ui/switch';
import { Trash2Icon } from 'lucide-react';
import type { AliasNode, SourceNode } from './ModelMappingDiagramTypes';
import styles from './ModelMappingDiagram.module.scss';

interface DiagramDialogProps {
  open: boolean;
  title: string;
  wide?: boolean;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}

function DiagramDialog({
  open,
  title,
  wide,
  onClose,
  footer,
  children,
}: DiagramDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className={wide ? styles.diagramDialogWide : styles.diagramDialog}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RenameAliasModalProps {
  open: boolean;
  t: TFunction;
  value: string;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function RenameAliasModal({
  open,
  t,
  value,
  error,
  onChange,
  onClose,
  onSubmit
}: RenameAliasModalProps) {
  return (
    <DiagramDialog
      open={open}
      title={t('oauth_model_alias.diagram_rename_alias_title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit}>{t('oauth_model_alias.diagram_rename_btn')}</Button>
        </>
      }
    >
      <Input
        label={t('oauth_model_alias.diagram_rename_alias_label')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') onSubmit();
        }}
        error={error}
        placeholder={t('oauth_model_alias.diagram_rename_placeholder')}
        autoFocus
      />
    </DiagramDialog>
  );
}

interface AddAliasModalProps {
  open: boolean;
  t: TFunction;
  value: string;
  error: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function AddAliasModal({
  open,
  t,
  value,
  error,
  onChange,
  onClose,
  onSubmit
}: AddAliasModalProps) {
  return (
    <DiagramDialog
      open={open}
      title={t('oauth_model_alias.diagram_add_alias_title')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit}>{t('oauth_model_alias.diagram_add_btn')}</Button>
        </>
      }
    >
      <Input
        label={t('oauth_model_alias.diagram_add_alias_label')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') onSubmit();
        }}
        error={error}
        placeholder={t('oauth_model_alias.diagram_add_placeholder')}
        autoFocus
      />
    </DiagramDialog>
  );
}

interface SettingsAliasModalProps {
  open: boolean;
  t: TFunction;
  alias: string | null;
  aliasNodes: AliasNode[];
  onClose: () => void;
  onToggleFork: (provider: string, sourceModel: string, alias: string, fork: boolean) => void;
  onUnlink: (provider: string, sourceModel: string, alias: string) => void;
}

export function SettingsAliasModal({
  open,
  t,
  alias,
  aliasNodes,
  onClose,
  onToggleFork,
  onUnlink
}: SettingsAliasModalProps) {
  return (
    <DiagramDialog
      open={open}
      title={t('oauth_model_alias.diagram_settings_title', { alias: alias ?? '' })}
      wide
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {alias ? (
        (() => {
          const node = aliasNodes.find((n) => n.alias === alias);
          if (!node || node.sources.length === 0) {
            return <div className={styles.settingsEmpty}>{t('oauth_model_alias.diagram_settings_empty')}</div>;
          }
          return (
            <div className={styles.settingsList}>
              {node.sources.map((source) => {
                const entry = source.aliases.find((item) => item.alias === alias);
                const forkEnabled = entry?.fork === true;
                return (
                  <div key={source.id} className={styles.settingsRow}>
                    <div className={styles.settingsNames}>
                      <span className={styles.settingsSource}>{source.name}</span>
                      <span className={styles.settingsArrow}>→</span>
                      <span className={styles.settingsAlias}>{alias}</span>
                    </div>
                    <div className={styles.settingsActions}>
                      <span className={styles.settingsLabel}>
                        {t('oauth_model_alias.alias_fork_label')}
                      </span>
                      <Switch
                        size="sm"
                        checked={forkEnabled}
                        onCheckedChange={(value) => onToggleFork(source.provider, source.name, alias, value)}
                        aria-label={t('oauth_model_alias.alias_fork_label')}
                      />
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => onUnlink(source.provider, source.name, alias)}
                        aria-label={t('oauth_model_alias.diagram_delete_link', {
                          provider: source.provider,
                          name: source.name
                        })}
                        title={t('oauth_model_alias.diagram_delete_link', {
                          provider: source.provider,
                          name: source.name
                        })}
                      >
                        <Trash2Icon data-icon="inline-start" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : null}
    </DiagramDialog>
  );
}

interface SettingsSourceModalProps {
  open: boolean;
  t: TFunction;
  source: SourceNode | null;
  onClose: () => void;
  onToggleFork: (provider: string, sourceModel: string, alias: string, fork: boolean) => void;
  onUnlink: (provider: string, sourceModel: string, alias: string) => void;
}

export function SettingsSourceModal({
  open,
  t,
  source,
  onClose,
  onToggleFork,
  onUnlink
}: SettingsSourceModalProps) {
  return (
    <DiagramDialog
      open={open}
      title={t('oauth_model_alias.diagram_settings_source_title')}
      wide
      onClose={onClose}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {source ? (
        source.aliases.length === 0 ? (
          <div className={styles.settingsEmpty}>{t('oauth_model_alias.diagram_settings_empty')}</div>
        ) : (
          <div className={styles.settingsList}>
            {source.aliases.map((entry) => (
              <div key={`${source.id}-${entry.alias}`} className={styles.settingsRow}>
                <div className={styles.settingsNames}>
                  <span className={styles.settingsSource}>{source.name}</span>
                  <span className={styles.settingsArrow}>→</span>
                  <span className={styles.settingsAlias}>{entry.alias}</span>
                </div>
                <div className={styles.settingsActions}>
                  <span className={styles.settingsLabel}>
                    {t('oauth_model_alias.alias_fork_label')}
                  </span>
                  <Switch
                    size="sm"
                    checked={entry.fork === true}
                    onCheckedChange={(value) => onToggleFork(source.provider, source.name, entry.alias, value)}
                    aria-label={t('oauth_model_alias.alias_fork_label')}
                  />
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => onUnlink(source.provider, source.name, entry.alias)}
                    aria-label={t('oauth_model_alias.diagram_delete_link', {
                      provider: source.provider,
                      name: source.name
                    })}
                    title={t('oauth_model_alias.diagram_delete_link', {
                      provider: source.provider,
                      name: source.name
                    })}
                  >
                    <Trash2Icon data-icon="inline-start" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </DiagramDialog>
  );
}
