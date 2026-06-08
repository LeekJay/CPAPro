import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircleIcon, PlusIcon, XIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible } from '@/components/ui/collapsible';
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { AmpcodeConfig, AmpcodeModelMapping, AmpcodeUpstreamApiKeyMapping } from '@/types';
import type { ProviderResource } from '../../types';
import styles from './sharedForm.module.scss';

interface AmpcodeFormState {
  upstreamUrl: string;
  upstreamApiKey: string;
  forceModelMappings: boolean;
  upstreamMappings: Array<{ upstreamApiKey: string; clientKeysText: string }>;
  modelMappings: Array<{ from: string; to: string }>;
}

const emptyUpstream = () => ({ upstreamApiKey: '', clientKeysText: '' });
const emptyModelMapping = () => ({ from: '', to: '' });

function buildState(config?: AmpcodeConfig | null): AmpcodeFormState {
  const safe = config ?? {};
  const upstreamMappings = (safe.upstreamApiKeys ?? []).length
    ? (safe.upstreamApiKeys ?? []).map((m) => ({
        upstreamApiKey: m.upstreamApiKey ?? '',
        clientKeysText: (m.apiKeys ?? []).join('\n'),
      }))
    : [emptyUpstream()];
  const modelMappings = (safe.modelMappings ?? []).length
    ? (safe.modelMappings ?? []).map((m) => ({ from: m.from ?? '', to: m.to ?? '' }))
    : [emptyModelMapping()];
  return {
    upstreamUrl: safe.upstreamUrl ?? '',
    upstreamApiKey: '',
    forceModelMappings: safe.forceModelMappings === true,
    upstreamMappings,
    modelMappings,
  };
}

const parseClientKeys = (text: string): string[] =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

interface AmpcodeFormProps {
  resource: ProviderResource | null;
  mutating: boolean;
  formId: string;
  onSubmit: (config: AmpcodeConfig) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

export function AmpcodeForm({
  resource,
  mutating,
  formId,
  onSubmit,
  onDirtyChange,
}: AmpcodeFormProps) {
  const { t } = useTranslation();
  const fid = useId();
  const initialConfig = (resource?.raw as AmpcodeConfig | undefined) ?? {};
  const [form, setForm] = useState<AmpcodeFormState>(() => buildState(initialConfig));
  const [initialFormSignature] = useState<string>(() => JSON.stringify(buildState(initialConfig)));
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== initialFormSignature,
    [form, initialFormSignature]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setError(null);
      const upstreamApiKeys: AmpcodeUpstreamApiKeyMapping[] = [];
      const seen = new Set<string>();
      form.upstreamMappings.forEach((m) => {
        const key = m.upstreamApiKey.trim();
        if (!key || seen.has(key)) return;
        const clientKeys = parseClientKeys(m.clientKeysText);
        if (!clientKeys.length) return;
        seen.add(key);
        upstreamApiKeys.push({ upstreamApiKey: key, apiKeys: clientKeys });
      });

      const modelMappings: AmpcodeModelMapping[] = [];
      const seenFrom = new Set<string>();
      form.modelMappings.forEach((m) => {
        const from = m.from.trim();
        const to = m.to.trim();
        if (!from || !to) return;
        const id = from.toLowerCase();
        if (seenFrom.has(id)) return;
        seenFrom.add(id);
        modelMappings.push({ from, to });
      });

      const next: AmpcodeConfig = {
        upstreamUrl: form.upstreamUrl.trim() || undefined,
        upstreamApiKey:
          form.upstreamApiKey.trim() || initialConfig.upstreamApiKey?.trim() || undefined,
        upstreamApiKeys: upstreamApiKeys.length ? upstreamApiKeys : undefined,
        modelMappings: modelMappings.length ? modelMappings : undefined,
        forceModelMappings: form.forceModelMappings,
      };
      await onSubmit(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
      <FieldGroup className={styles.section}>
        <Field>
          <FieldLabel htmlFor={`${fid}-url`}>
            {t('providersPage.ampcode.upstreamUrl')}
          </FieldLabel>
          <Input
            id={`${fid}-url`}
            value={form.upstreamUrl}
            onChange={(e) => setForm((s) => ({ ...s, upstreamUrl: e.target.value }))}
            placeholder="https://api.ampcode.com"
            disabled={mutating}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${fid}-key`}>
            {t('providersPage.ampcode.upstreamApiKey')}
            <span className={styles.labelHint}>
              {' '}
              · {t('providersPage.ampcode.upstreamApiKeyHint')}
            </span>
          </FieldLabel>
          <Input
            id={`${fid}-key`}
            type="password"
            value={form.upstreamApiKey}
            onChange={(e) => setForm((s) => ({ ...s, upstreamApiKey: e.target.value }))}
            autoComplete="new-password"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            disabled={mutating}
          />
        </Field>
        <label className={styles.checkboxRow}>
          <Checkbox
            checked={form.forceModelMappings}
            disabled={mutating}
            onCheckedChange={(value) =>
              setForm((s) => ({ ...s, forceModelMappings: value === true }))
            }
            aria-label={t('providersPage.ampcode.forceModelMappings')}
          />
          <span className={styles.checkboxText}>
            <span>{t('providersPage.ampcode.forceModelMappings')}</span>
            <small>{t('providersPage.ampcode.forceModelMappingsHint')}</small>
          </span>
        </label>
      </FieldGroup>

      <Collapsible label={t('providersPage.ampcode.keyMappingsSection')} defaultOpen>
        <div className={styles.entriesList}>
          {form.upstreamMappings.map((m, idx) => (
            <div key={idx} className={styles.entryCard}>
              <div className={styles.entryCardHeader}>
                <span>{t('providersPage.ampcode.mappingRow', { index: idx + 1 })}</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  disabled={mutating || form.upstreamMappings.length <= 1}
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      upstreamMappings: s.upstreamMappings.filter((_, i) => i !== idx),
                    }))
                  }
                  aria-label={t('common.delete')}
                >
                  <XIcon data-icon="inline-start" />
                </Button>
              </div>
              <Field>
                <FieldLabel>{t('providersPage.ampcode.upstreamApiKey')}</FieldLabel>
                <Input
                  value={m.upstreamApiKey}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      upstreamMappings: s.upstreamMappings.map((it, i) =>
                        i === idx ? { ...it, upstreamApiKey: e.target.value } : it
                      ),
                    }))
                  }
                  disabled={mutating}
                />
              </Field>
              <Field>
                <FieldLabel>
                  {t('providersPage.ampcode.clientKeys')}
                  <span className={styles.labelHint}>
                    {' '}
                    · {t('providersPage.ampcode.clientKeysHint')}
                  </span>
                </FieldLabel>
                <Textarea
                  rows={3}
                  value={m.clientKeysText}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      upstreamMappings: s.upstreamMappings.map((it, i) =>
                        i === idx ? { ...it, clientKeysText: e.target.value } : it
                      ),
                    }))
                  }
                  disabled={mutating}
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={mutating}
            onClick={() =>
              setForm((s) => ({
                ...s,
                upstreamMappings: [...s.upstreamMappings, emptyUpstream()],
              }))
            }
          >
            <PlusIcon data-icon="inline-start" />
            <span>{t('providersPage.ampcode.addMapping')}</span>
          </Button>
        </div>
      </Collapsible>

      <Collapsible label={t('providersPage.ampcode.modelMappingsSection')}>
        <div className={styles.entriesList}>
          {form.modelMappings.map((m, idx) => (
            <div key={idx} className={styles.entryGrid}>
              <Input
                placeholder="from"
                value={m.from}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    modelMappings: s.modelMappings.map((it, i) =>
                      i === idx ? { ...it, from: e.target.value } : it
                    ),
                  }))
                }
                disabled={mutating}
              />
              <Input
                placeholder="to"
                value={m.to}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    modelMappings: s.modelMappings.map((it, i) =>
                      i === idx ? { ...it, to: e.target.value } : it
                    ),
                  }))
                }
                disabled={mutating}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                disabled={mutating || form.modelMappings.length <= 1}
                onClick={() =>
                  setForm((s) => ({
                    ...s,
                    modelMappings: s.modelMappings.filter((_, i) => i !== idx),
                  }))
                }
                aria-label={t('common.delete')}
              >
                <XIcon data-icon="inline-start" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={mutating}
            onClick={() =>
              setForm((s) => ({
                ...s,
                modelMappings: [...s.modelMappings, emptyModelMapping()],
              }))
            }
          >
            <PlusIcon data-icon="inline-start" />
            <span>{t('providersPage.ampcode.addModelMapping')}</span>
          </Button>
        </div>
      </Collapsible>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
