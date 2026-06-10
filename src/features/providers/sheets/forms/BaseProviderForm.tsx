import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Input,
} from '@/components/ui/input';
import { Collapsible } from '@/components/ui/collapsible';
import { OptionSelect } from '@/components/ui/shadcn-option-select';
import { Textarea } from '@/components/ui/textarea';
import { hasDisableAllModelsRule } from '@/components/providers/utils';
import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '@/types';
import type { ModelInfo } from '@/utils/models';
import { PROVIDER_DESCRIPTORS } from '../../descriptors';
import type {
  ApiKeyEntryInput,
  ModelEntryInput,
  ProviderBrand,
  ProviderEntryFormInput,
  ProviderResource,
} from '../../types';
import {
  useConnectivityTest,
  type ConnectivityErrorMessages,
  type ConnectivityState,
} from './useConnectivityTest';
import { useModelDiscovery } from './useModelDiscovery';
import { ModelDiscoveryPanel } from './ModelDiscoveryPanel';
import styles from './sharedForm.module.scss';

export interface BaseProviderFormHandle {
  submit: () => Promise<void>;
}

interface BaseProviderFormProps {
  brand: Exclude<ProviderBrand, 'ampcode'>;
  resource: ProviderResource | null;
  mode: 'create' | 'edit';
  mutating: boolean;
  formId: string;
  onSubmit: (input: ProviderEntryFormInput) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

const emptyHeader = () => ({ key: '', value: '' });
const emptyModel = (): ModelEntryInput => ({ name: '', alias: '' });
const emptyApiKeyEntry = (): ApiKeyEntryInput => ({
  apiKey: '',
  proxyUrl: '',
});
const AUTO_TEST_MODEL_VALUE = '__auto__';

const stripDisableAllRule = (list?: string[]): string[] =>
  (list ?? []).filter((s) => s.trim() !== '*');

function buildInitialForm(
  brand: Exclude<ProviderBrand, 'ampcode'>,
  resource: ProviderResource | null,
  mode: 'create' | 'edit'
): ProviderEntryFormInput {
  if (mode === 'create' || !resource) {
    return {
      apiKey: '',
      name: '',
      baseUrl: '',
      proxyUrl: '',
      prefix: '',
      disabled: false,
      priority: undefined,
      models: [emptyModel()],
      headers: [emptyHeader()],
      excludedModelsText: '',
      websockets: brand === 'codex' ? false : undefined,
      cloak:
        brand === 'claude' ? { mode: '', strictMode: false, sensitiveWordsText: '' } : undefined,
      testModel: brand === 'openaiCompatibility' || brand === 'claude' ? '' : undefined,
      apiKeyEntries: brand === 'openaiCompatibility' ? [emptyApiKeyEntry()] : undefined,
    };
  }

  const raw = resource.raw;
  if (brand === 'openaiCompatibility') {
    const cfg = raw as OpenAIProviderConfig;
    return {
      apiKey: '',
      name: cfg.name ?? '',
      baseUrl: cfg.baseUrl ?? '',
      proxyUrl: '',
      prefix: cfg.prefix ?? '',
      disabled: cfg.disabled === true,
      priority: cfg.priority,
      models: cfg.models?.length
        ? cfg.models.map((m) => ({
            name: m.name,
            alias: m.alias ?? '',
            priority: m.priority,
            testModel: m.testModel,
          }))
        : [emptyModel()],
      headers: cfg.headers
        ? Object.entries(cfg.headers).map(([k, v]) => ({ key: k, value: String(v) }))
        : [emptyHeader()],
      excludedModelsText: '',
      testModel: cfg.testModel ?? '',
      apiKeyEntries: cfg.apiKeyEntries?.length
        ? cfg.apiKeyEntries.map((entry) => ({
            apiKey: '',
            existingApiKey: entry.apiKey,
            proxyUrl: entry.proxyUrl ?? '',
            authIndex: entry.authIndex,
          }))
        : [emptyApiKeyEntry()],
    };
  }

  const cfg = raw as GeminiKeyConfig & ProviderKeyConfig;
  const disabled = hasDisableAllModelsRule(cfg.excludedModels);
  const excludedList = stripDisableAllRule(cfg.excludedModels);
  return {
    // Keep the API key blank in edit mode. Pre-filling the real key makes this
    // password field a browser-autofill target (the saved management key can
    // overwrite it) and defeats the "leave empty = keep unchanged" contract; an
    // empty field is preserved on save via buildProviderKeyConfig's existing fallback.
    apiKey: '',
    name: '',
    baseUrl: cfg.baseUrl ?? '',
    proxyUrl: cfg.proxyUrl ?? '',
    prefix: cfg.prefix ?? '',
    disabled,
    priority: cfg.priority,
    models: cfg.models?.length
      ? cfg.models.map((m) => ({
          name: m.name,
          alias: m.alias ?? '',
          priority: m.priority,
          testModel: m.testModel,
        }))
      : [emptyModel()],
    headers: cfg.headers
      ? Object.entries(cfg.headers).map(([k, v]) => ({ key: k, value: String(v) }))
      : [emptyHeader()],
    excludedModelsText: excludedList.join('\n'),
    websockets: brand === 'codex' ? (cfg as ProviderKeyConfig).websockets === true : undefined,
    cloak:
      brand === 'claude'
        ? {
            mode: (cfg as ProviderKeyConfig).cloak?.mode ?? '',
            strictMode: (cfg as ProviderKeyConfig).cloak?.strictMode === true,
            sensitiveWordsText: (cfg as ProviderKeyConfig).cloak?.sensitiveWords?.join('\n') ?? '',
          }
        : undefined,
    testModel: brand === 'claude' ? '' : undefined,
  };
}

function ConnectivityStatusIcon({ state }: { state: ConnectivityState }) {
  if (state === 'loading') {
    return (
      <span className={`${styles.statusIcon} ${styles.statusIconLoading}`}>
        <Loader2Icon data-icon="inline-start" />
      </span>
    );
  }
  if (state === 'success') {
    return (
      <span className={`${styles.statusIcon} ${styles.statusIconSuccess}`}>
        <CheckCircle2Icon data-icon="inline-start" />
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className={`${styles.statusIcon} ${styles.statusIconError}`}>
        <AlertTriangleIcon data-icon="inline-start" />
      </span>
    );
  }
  return null;
}

export function BaseProviderForm({
  brand,
  resource,
  mode,
  mutating,
  formId,
  onSubmit,
  onDirtyChange,
}: BaseProviderFormProps) {
  const { t } = useTranslation();
  const descriptor = PROVIDER_DESCRIPTORS[brand];
  const fid = useId();
  const [form, setForm] = useState<ProviderEntryFormInput>(() =>
    buildInitialForm(brand, resource, mode)
  );
  const [initialFormSignature] = useState<string>(() =>
    JSON.stringify(buildInitialForm(brand, resource, mode))
  );
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Set<number>>(new Set());
  const [showSingleApiKey, setShowSingleApiKey] = useState(false);

  const togglePasswordVisibility = (idx: number) => {
    setShowPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const isDirty = useMemo(
    () => JSON.stringify(form) !== initialFormSignature,
    [form, initialFormSignature]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const fallbackApiKey = useMemo(() => {
    if (mode !== 'edit' || !resource) return '';
    if (brand === 'openaiCompatibility') return '';
    return (resource.raw as { apiKey?: string } | undefined)?.apiKey ?? '';
  }, [brand, mode, resource]);

  const fallbackAuthIndex = useMemo(() => {
    if (mode !== 'edit' || !resource) return '';
    return (resource.raw as { authIndex?: string } | undefined)?.authIndex ?? '';
  }, [mode, resource]);

  const connectivityMessages = useMemo<ConnectivityErrorMessages>(
    () => ({
      baseUrlRequired: t('providersPage.connectivity.baseUrlRequired'),
      endpointInvalid: t('providersPage.connectivity.endpointInvalid'),
      apiKeyRequired: t('providersPage.connectivity.apiKeyRequired'),
      modelRequired: t('providersPage.connectivity.modelRequired'),
      timeout: (seconds: number) => t('providersPage.connectivity.timeout', { seconds }),
      requestFailed: t('providersPage.connectivity.requestFailed'),
    }),
    [t]
  );

  const connectivity = useConnectivityTest(
    {
      brand,
      baseUrl: form.baseUrl,
      testModel: form.testModel,
      models: form.models,
      formHeaders: form.headers,
      apiKeyEntries: form.apiKeyEntries,
      apiKey: form.apiKey,
      fallbackApiKey,
      authIndex: fallbackAuthIndex,
    },
    connectivityMessages
  );

  const discovery = useModelDiscovery({
    brand,
    baseUrl: form.baseUrl,
    formHeaders: form.headers,
    apiKeyEntries: form.apiKeyEntries,
    apiKey: form.apiKey,
    fallbackApiKey,
    authIndex: fallbackAuthIndex,
  });
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  const existingModelNames = useMemo(() => {
    const set = new Set<string>();
    form.models.forEach((m) => {
      const name = (m.name ?? '').trim();
      if (name) set.add(name);
    });
    return set;
  }, [form.models]);

  const testModelOptions = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    form.models.forEach((m) => {
      const name = (m.name ?? '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      names.push(name);
    });
    const firstName = names[0];
    const autoLabel = firstName
      ? t('providersPage.form.testModelAutoWith', { name: firstName })
      : t('providersPage.form.testModelAutoEmpty');
    const opts: Array<{ value: string; label: string }> = [
      { value: AUTO_TEST_MODEL_VALUE, label: autoLabel },
    ];
    names.forEach((n) => opts.push({ value: n, label: n }));
    const tm = (form.testModel ?? '').trim();
    if (tm && !seen.has(tm)) {
      opts.push({
        value: tm,
        label: t('providersPage.form.testModelCustom', { name: tm }),
      });
    }
    return opts;
  }, [form.models, form.testModel, t]);

  const testModelValue = form.testModel?.trim() ? form.testModel : AUTO_TEST_MODEL_VALUE;

  const openDiscovery = () => {
    setDiscoveryOpen(true);
    if (!discovery.loading && !discovery.hasFetched) {
      void discovery.fetch();
    }
  };

  const closeDiscovery = () => {
    setDiscoveryOpen(false);
  };

  const applyDiscoveredModels = (incoming: ModelInfo[]) => {
    if (!incoming.length) return;
    setForm((prev) => {
      const seen = new Set<string>();
      const next: ModelEntryInput[] = [];
      prev.models.forEach((entry) => {
        const trimmed = (entry.name ?? '').trim();
        if (trimmed) {
          if (seen.has(trimmed)) return;
          seen.add(trimmed);
        }
        next.push(entry);
      });
      // If the existing list is just an empty placeholder row, drop it.
      const placeholderIdx = next.findIndex(
        (it) => !(it.name ?? '').trim() && !(it.alias ?? '').trim()
      );
      if (placeholderIdx !== -1) {
        next.splice(placeholderIdx, 1);
      }
      incoming.forEach((info) => {
        const trimmed = info.name.trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        next.push({
          name: trimmed,
          alias: (info.alias ?? '').trim(),
        });
      });
      return { ...prev, models: next };
    });
  };

  const updateField = <K extends keyof ProviderEntryFormInput>(
    key: K,
    value: ProviderEntryFormInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateCloak = <K extends keyof NonNullable<ProviderEntryFormInput['cloak']>>(
    key: K,
    value: NonNullable<ProviderEntryFormInput['cloak']>[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      cloak: {
        ...(prev.cloak ?? { mode: '', strictMode: false, sensitiveWordsText: '' }),
        [key]: value,
      },
    }));
  };

  const validate = (): string | null => {
    if (descriptor.supportsName && !form.name.trim()) {
      return t('providersPage.form.validation.nameRequired');
    }
    if (descriptor.supportsApiKey && mode === 'create' && !form.apiKey.trim()) {
      return t('providersPage.form.validation.apiKeyRequired');
    }
    if (descriptor.baseUrlRequired && !form.baseUrl.trim()) {
      return t('providersPage.form.validation.baseUrlRequired');
    }
    if (
      brand === 'openaiCompatibility' &&
      mode === 'create' &&
      !form.apiKeyEntries?.some((e) => e.apiKey.trim())
    ) {
      return t('providersPage.form.validation.apiKeyRequired');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    try {
      setError(null);
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /* ------------------ entries helpers ------------------ */

  const headersList = useMemo(
    () => (form.headers.length ? form.headers : [emptyHeader()]),
    [form.headers]
  );
  const modelsList = useMemo(
    () => (form.models.length ? form.models : [emptyModel()]),
    [form.models]
  );
  const apiKeyEntries = useMemo(
    () =>
      form.apiKeyEntries && form.apiKeyEntries.length ? form.apiKeyEntries : [emptyApiKeyEntry()],
    [form.apiKeyEntries]
  );

  const removeApiKeyEntry = (removeIdx: number) => {
    setShowPasswords((prev) => {
      if (!prev.size) return prev;
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < removeIdx) {
          next.add(idx);
        } else if (idx > removeIdx) {
          next.add(idx - 1);
        }
      });
      return next;
    });
    updateField(
      'apiKeyEntries',
      apiKeyEntries.filter((_, i) => i !== removeIdx)
    );
  };

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* 基础字段 */}
      <FieldGroup className={styles.section}>
        {descriptor.supportsName ? (
          <Field>
            <FieldLabel htmlFor={`${fid}-name`}>
              {t('providersPage.form.name')}
            </FieldLabel>
            <Input
              id={`${fid}-name`}
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              disabled={mutating}
            />
          </Field>
        ) : null}

        {descriptor.supportsApiKey ? (
          <Field>
            <FieldLabel htmlFor={`${fid}-apiKey`}>
              {t('providersPage.form.apiKey')}
            </FieldLabel>
            <Input
              id={`${fid}-apiKey`}
              type={showSingleApiKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(e) => updateField('apiKey', e.target.value)}
              autoComplete="new-password"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
              placeholder={
                mode === 'edit'
                  ? t('providersPage.form.apiKeyEditPlaceholder')
                  : t('providersPage.form.apiKeyCreatePlaceholder')
              }
              disabled={mutating}
              rightElement={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowSingleApiKey((v) => !v)}
                  disabled={mutating}
                  aria-label={
                    showSingleApiKey
                      ? t('providersPage.form.hideApiKey')
                      : t('providersPage.form.showApiKey')
                  }
                  title={
                    showSingleApiKey
                      ? t('providersPage.form.hideApiKey')
                      : t('providersPage.form.showApiKey')
                  }
                >
                  {showSingleApiKey ? (
                    <EyeOffIcon data-icon="inline-start" />
                  ) : (
                    <EyeIcon data-icon="inline-start" />
                  )}
                </Button>
              }
            />
          </Field>
        ) : null}

        {descriptor.supportsBaseUrl ? (
          <Field>
            <FieldLabel htmlFor={`${fid}-baseUrl`}>
              {t('providersPage.form.baseUrl')}
              {descriptor.baseUrlRequired ? (
                <span className={styles.labelHint}>
                  {' '}
                  · {t('providersPage.form.baseUrlRequiredHint')}
                </span>
              ) : null}
            </FieldLabel>
            <Input
              id={`${fid}-baseUrl`}
              value={form.baseUrl}
              onChange={(e) => updateField('baseUrl', e.target.value)}
              placeholder="https://api.example.com"
              disabled={mutating}
            />
          </Field>
        ) : null}

        {descriptor.supportsProxyUrl ? (
          <Field>
            <FieldLabel htmlFor={`${fid}-proxy`}>
              {t('providersPage.form.proxyUrl')}
            </FieldLabel>
            <Input
              id={`${fid}-proxy`}
              value={form.proxyUrl}
              onChange={(e) => updateField('proxyUrl', e.target.value)}
              placeholder="http://127.0.0.1:7890"
              disabled={mutating}
            />
          </Field>
        ) : null}

        {descriptor.supportsPrefix ? (
          <div className={styles.fieldRow}>
            <Field>
              <FieldLabel htmlFor={`${fid}-prefix`}>
                {t('providersPage.form.prefix')}
              </FieldLabel>
              <Input
                id={`${fid}-prefix`}
                value={form.prefix}
                onChange={(e) => updateField('prefix', e.target.value)}
                disabled={mutating}
              />
            </Field>
            {descriptor.supportsPriority ? (
              <Field>
                <FieldLabel htmlFor={`${fid}-prio`}>
                  {t('providersPage.form.priority')}
                </FieldLabel>
                <Input
                  id={`${fid}-prio`}
                  type="number"
                  value={form.priority ?? ''}
                  onChange={(e) =>
                    updateField(
                      'priority',
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                  disabled={mutating}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {descriptor.supportsTestModel ? (
          <Field>
            <FieldLabel htmlFor={`${fid}-testModel`}>
              {t('providersPage.form.testModel')}
              {brand === 'claude' ? (
                <span className={styles.labelHint}>
                  {' '}
                  · {t('providersPage.form.testModelClaudeHint')}
                </span>
              ) : null}
            </FieldLabel>
            <OptionSelect
              id={`${fid}-testModel`}
              value={testModelValue}
              options={testModelOptions}
              onChange={(value) =>
                updateField('testModel', value === AUTO_TEST_MODEL_VALUE ? '' : value)
              }
              disabled={mutating}
              ariaLabel={t('providersPage.form.testModel')}
            />
            {brand === 'claude' ? (
              <div className={styles.connectivityRow}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={mutating || connectivity.isTestingAny}
                  loading={connectivity.claudeStatus.state === 'loading'}
                  onClick={() => void connectivity.runClaude()}
                >
                  <span>{t('providersPage.connectivity.test')}</span>
                </Button>
                <ConnectivityStatusIcon state={connectivity.claudeStatus.state} />
                {connectivity.claudeStatus.state === 'success' ? (
                  <span className={styles.connectivityHintSuccess}>
                    {t('providersPage.connectivity.success')}
                  </span>
                ) : null}
              </div>
            ) : null}
            {brand === 'claude' && connectivity.claudeStatus.state === 'error' ? (
              <div className={styles.connectivityError}>{connectivity.claudeStatus.message}</div>
            ) : null}
          </Field>
        ) : null}

        {descriptor.supportsWebsockets ? (
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={form.websockets ?? false}
              disabled={mutating}
              onCheckedChange={(value) => updateField('websockets', value === true)}
              aria-label={t('providersPage.form.websockets')}
            />
            <span className={styles.checkboxText}>
              <span>{t('providersPage.form.websockets')}</span>
            </span>
          </label>
        ) : null}

        {descriptor.supportsDisabled ? (
          <label className={styles.checkboxRow}>
            <Checkbox
              checked={form.disabled}
              disabled={mutating}
              onCheckedChange={(value) => updateField('disabled', value === true)}
              aria-label={t('providersPage.form.disabled')}
            />
            <span className={styles.checkboxText}>
              <span>{t('providersPage.form.disabled')}</span>
              <small>{t('providersPage.form.disabledHint')}</small>
            </span>
          </label>
        ) : null}
      </FieldGroup>

      {/* 高级折叠区 */}
      {descriptor.supportsApiKeyEntries && form.apiKeyEntries ? (
        <Collapsible
          label={t('providersPage.form.apiKeyEntriesSection')}
          hint={`${
            apiKeyEntries.filter((e) => e.apiKey.trim() || e.existingApiKey?.trim()).length
          }`}
          defaultOpen
        >
          <div className={styles.entriesList}>
            <div className={`${styles.entriesToolbar} ${styles.entriesToolbarSplit}`}>
              {/* Add entry button on the left */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={mutating}
                onClick={() => updateField('apiKeyEntries', [...apiKeyEntries, emptyApiKeyEntry()])}
              >
                <PlusIcon data-icon="inline-start" />
                <span>{t('providersPage.form.addApiKeyEntry')}</span>
              </Button>
              {/* Test all button on the right */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={mutating || connectivity.isTestingAny}
                loading={connectivity.isTestingAny}
                onClick={() => void connectivity.runOpenAIAllKeys()}
              >
                <span>{t('providersPage.connectivity.testAll')}</span>
              </Button>
            </div>
            {[...apiKeyEntries].reverse().map((entry, visualIdx) => {
              const realIdx = apiKeyEntries.length - 1 - visualIdx;
              const status = connectivity.openaiStatuses[realIdx] ?? {
                state: 'idle' as ConnectivityState,
                message: '',
              };
              return (
                <div key={realIdx} className={styles.entryCard}>
                  <div className={styles.entryCardHeader}>
                    <span>{t('providersPage.form.apiKeyEntry', { index: realIdx + 1 })}</span>
                    <div className={styles.entryCardHeaderRight}>
                      <ConnectivityStatusIcon state={status.state} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={mutating || status.state === 'loading'}
                        loading={status.state === 'loading'}
                        onClick={() => void connectivity.runOpenAIKey(realIdx)}
                      >
                        <span>{t('providersPage.connectivity.test')}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        disabled={mutating || apiKeyEntries.length <= 1}
                        onClick={() => removeApiKeyEntry(realIdx)}
                        aria-label={t('common.delete')}
                      >
                        <XIcon data-icon="inline-start" />
                      </Button>
                    </div>
                  </div>
                  <Field>
                    <FieldLabel>{t('providersPage.form.apiKey')}</FieldLabel>
                    <Input
                      type={showPasswords.has(realIdx) ? 'text' : 'password'}
                      value={entry.apiKey}
                      onChange={(e) =>
                        updateField(
                          'apiKeyEntries',
                          apiKeyEntries.map((it, i) =>
                            i === realIdx ? { ...it, apiKey: e.target.value } : it
                          )
                        )
                      }
                      autoComplete="new-password"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-bwignore="true"
                      disabled={mutating}
                      placeholder={
                        entry.existingApiKey
                          ? t('providersPage.form.apiKeyEditPlaceholder')
                          : t('providersPage.form.apiKeyCreatePlaceholder')
                      }
                      rightElement={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => togglePasswordVisibility(realIdx)}
                          disabled={mutating}
                          aria-label={
                            showPasswords.has(realIdx)
                              ? t('providersPage.form.hideApiKey')
                              : t('providersPage.form.showApiKey')
                          }
                          title={
                            showPasswords.has(realIdx)
                              ? t('providersPage.form.hideApiKey')
                              : t('providersPage.form.showApiKey')
                          }
                        >
                          {showPasswords.has(realIdx) ? (
                            <EyeOffIcon data-icon="inline-start" />
                          ) : (
                            <EyeIcon data-icon="inline-start" />
                          )}
                        </Button>
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t('providersPage.form.proxyUrl')}</FieldLabel>
                    <Input
                      value={entry.proxyUrl}
                      onChange={(e) =>
                        updateField(
                          'apiKeyEntries',
                          apiKeyEntries.map((it, i) =>
                            i === realIdx ? { ...it, proxyUrl: e.target.value } : it
                          )
                        )
                      }
                      disabled={mutating}
                      placeholder="http://127.0.0.1:7890"
                    />
                  </Field>
                  {status.state === 'error' ? (
                    <div className={styles.connectivityError}>{status.message}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Collapsible>
      ) : null}

      {descriptor.supportsHeaders ? (
        <Collapsible label={t('providersPage.form.headersSection')}>
          <div className={styles.entriesList}>
            {headersList.map((entry, idx) => (
              <div key={idx} className={styles.entryGrid}>
                <Input
                  placeholder="X-Custom-Header"
                  value={entry.key}
                  onChange={(e) =>
                    updateField(
                      'headers',
                      headersList.map((it, i) => (i === idx ? { ...it, key: e.target.value } : it))
                    )
                  }
                  disabled={mutating}
                />
                <Input
                  placeholder="value"
                  value={entry.value}
                  onChange={(e) =>
                    updateField(
                      'headers',
                      headersList.map((it, i) =>
                        i === idx ? { ...it, value: e.target.value } : it
                      )
                    )
                  }
                  disabled={mutating}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  disabled={mutating || headersList.length <= 1}
                  onClick={() =>
                    updateField(
                      'headers',
                      headersList.filter((_, i) => i !== idx)
                    )
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
              onClick={() => updateField('headers', [...headersList, emptyHeader()])}
            >
              <PlusIcon data-icon="inline-start" />
              <span>{t('providersPage.form.addHeader')}</span>
            </Button>
          </div>
        </Collapsible>
      ) : null}

      {descriptor.supportsModels ? (
        <Collapsible label={t('providersPage.form.modelsSection')}>
          <div className={styles.entriesList}>
            {discovery.available ? (
              <div className={styles.entriesToolbar}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openDiscovery}
                  disabled={mutating}
                >
                  <DownloadIcon data-icon="inline-start" />
                  <span>{t('providersPage.discovery.openButton')}</span>
                </Button>
              </div>
            ) : null}
            {discovery.available && discoveryOpen ? (
              <ModelDiscoveryPanel
                loading={discovery.loading}
                error={discovery.error}
                models={discovery.models}
                hasFetched={discovery.hasFetched}
                existingNames={existingModelNames}
                mutating={mutating}
                onApply={(names) => {
                  applyDiscoveredModels(names);
                }}
                onReload={() => void discovery.fetch()}
                onClose={closeDiscovery}
              />
            ) : null}
            {modelsList.map((entry, idx) => (
              <div key={idx} className={styles.entryGrid}>
                <Input
                  placeholder="model-name"
                  value={entry.name}
                  onChange={(e) =>
                    updateField(
                      'models',
                      modelsList.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it))
                    )
                  }
                  disabled={mutating}
                />
                <Input
                  placeholder="alias (optional)"
                  value={entry.alias ?? ''}
                  onChange={(e) =>
                    updateField(
                      'models',
                      modelsList.map((it, i) => (i === idx ? { ...it, alias: e.target.value } : it))
                    )
                  }
                  disabled={mutating}
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  disabled={mutating || modelsList.length <= 1}
                  onClick={() =>
                    updateField(
                      'models',
                      modelsList.filter((_, i) => i !== idx)
                    )
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
              onClick={() => updateField('models', [...modelsList, emptyModel()])}
            >
              <PlusIcon data-icon="inline-start" />
              <span>{t('providersPage.form.addModel')}</span>
            </Button>
          </div>
        </Collapsible>
      ) : null}

      {descriptor.supportsExcludedModels ? (
        <Collapsible label={t('providersPage.form.excludedSection')}>
          <Field>
            <FieldDescription>{t('providersPage.form.excludedHint')}</FieldDescription>
            <Textarea
              rows={4}
              value={form.excludedModelsText}
              onChange={(e) => updateField('excludedModelsText', e.target.value)}
              disabled={mutating}
              placeholder="model-1&#10;model-2"
            />
          </Field>
        </Collapsible>
      ) : null}

      {descriptor.supportsCloak && form.cloak ? (
        <Collapsible label={t('providersPage.form.cloakSection')}>
          <FieldGroup className={styles.section}>
            <Field>
              <FieldLabel>{t('providersPage.form.cloakMode')}</FieldLabel>
              <Input
                value={form.cloak.mode}
                onChange={(e) => updateCloak('mode', e.target.value)}
                placeholder="auto / always / never"
                disabled={mutating}
              />
            </Field>
            <label className={styles.checkboxRow}>
              <Checkbox
                checked={form.cloak.strictMode}
                disabled={mutating}
                onCheckedChange={(value) => updateCloak('strictMode', value === true)}
                aria-label={t('providersPage.form.cloakStrict')}
              />
              <span className={styles.checkboxText}>
                <span>{t('providersPage.form.cloakStrict')}</span>
              </span>
            </label>
            <Field>
              <FieldLabel>{t('providersPage.form.cloakSensitiveWords')}</FieldLabel>
              <Textarea
                rows={3}
                value={form.cloak.sensitiveWordsText}
                onChange={(e) => updateCloak('sensitiveWordsText', e.target.value)}
                disabled={mutating}
              />
            </Field>
          </FieldGroup>
        </Collapsible>
      ) : null}

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
