import {
  useCallback,
  useId,
  useMemo,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Code2Icon,
  DiamondIcon,
  KeyRoundIcon,
  SatelliteDishIcon,
  SettingsIcon,
  TimerIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
  FieldContent,
} from '@/components/ui/field';
import { Input as BaseInput } from '@/components/ui/input';
import { OptionSelect as Select } from '@/components/ui/shadcn-option-select';
import { Switch } from '@/components/ui/switch';
import { ConfigSection } from '@/components/config/ConfigSection';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type {
  PayloadFilterRule,
  PayloadParamValidationErrorCode,
  PayloadRule,
  VisualConfigFieldPath,
  VisualConfigValidationErrorCode,
  VisualConfigValidationErrors,
  VisualConfigValues,
} from '@/types/visualConfig';
import {
  ApiKeysCardEditor,
  PayloadFilterRulesEditor,
  PayloadRulesEditor,
} from './VisualConfigEditorBlocks';
import styles from './VisualConfigEditor.module.scss';

export type VisualSectionId = 'server' | 'auth' | 'system' | 'quota' | 'streaming' | 'payload';

type VisualSection = {
  id: VisualSectionId;
  title: string;
  icon: ComponentType<ComponentProps<LucideIcon>>;
  errorCount: number;
};

interface VisualConfigEditorProps {
  activeSectionId: VisualSectionId;
  values: VisualConfigValues;
  validationErrors?: VisualConfigValidationErrors;
  hasPayloadValidationErrors?: boolean;
  disabled?: boolean;
  pageActions?: ReactNode;
  onChange: (values: Partial<VisualConfigValues>) => void;
}

function getValidationMessage(
  t: ReturnType<typeof useTranslation>['t'],
  errorCode?: VisualConfigValidationErrorCode | PayloadParamValidationErrorCode
) {
  if (!errorCode) return undefined;
  return t(`config_management.visual.validation.${errorCode}`);
}

type ToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

function ToggleRow({ title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <Field className={styles.toggleRow} orientation="horizontal" data-disabled={disabled}>
      <FieldContent>
        <FieldTitle>{title}</FieldTitle>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={title}
        size="sm"
      />
    </Field>
  );
}

function SectionGrid({ children }: { children: ReactNode }) {
  return <FieldGroup className={styles.sectionGrid}>{children}</FieldGroup>;
}

function SectionStack({ children }: { children: ReactNode }) {
  return <div className={styles.sectionStack}>{children}</div>;
}

function Divider() {
  return <div className={styles.divider} />;
}

function SectionSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.subsection}>
      <div className={styles.subsectionHeader}>
        <h3 className={styles.subsectionTitle}>{title}</h3>
        {description ? <p className={styles.subsectionDescription}>{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function FieldShell({
  label,
  labelId,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <Field className={styles.fieldShell} data-invalid={Boolean(error)}>
      <FieldLabel id={labelId} htmlFor={htmlFor}>
        {label}
      </FieldLabel>
      {children}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
    </Field>
  );
}

function ConfigInputField({
  label,
  hint,
  error,
  id,
  ...props
}: ComponentProps<typeof BaseInput> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <Field className={styles.fieldShell} data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <BaseInput
        id={inputId}
        aria-describedby={[props['aria-describedby'], errorId, hintId]
          .filter(Boolean)
          .join(' ') || undefined}
        aria-invalid={Boolean(error) || props['aria-invalid'] || undefined}
        {...props}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
    </Field>
  );
}

const Input = ConfigInputField;

export function VisualConfigEditor({
  activeSectionId,
  values,
  validationErrors,
  hasPayloadValidationErrors = false,
  disabled = false,
  pageActions,
  onChange,
}: VisualConfigEditorProps) {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const routingStrategyLabelId = useId();
  const routingStrategyHintId = `${routingStrategyLabelId}-hint`;
  const disableImageGenerationLabelId = useId();
  const disableImageGenerationHintId = `${disableImageGenerationLabelId}-hint`;
  const keepaliveInputId = useId();
  const keepaliveHintId = `${keepaliveInputId}-hint`;
  const keepaliveErrorId = `${keepaliveInputId}-error`;
  const nonstreamKeepaliveInputId = useId();
  const nonstreamKeepaliveHintId = `${nonstreamKeepaliveInputId}-hint`;
  const nonstreamKeepaliveErrorId = `${nonstreamKeepaliveInputId}-error`;
  const isKeepaliveDisabled =
    values.streaming.keepaliveSeconds === '' || values.streaming.keepaliveSeconds === '0';
  const isNonstreamKeepaliveDisabled =
    values.streaming.nonstreamKeepaliveInterval === '' ||
    values.streaming.nonstreamKeepaliveInterval === '0';

  const portError = getValidationMessage(t, validationErrors?.port);
  const logsMaxSizeError = getValidationMessage(t, validationErrors?.logsMaxTotalSizeMb);
  const errorLogsMaxFilesError = getValidationMessage(t, validationErrors?.errorLogsMaxFiles);
  const redisUsageQueueRetentionError = getValidationMessage(
    t,
    validationErrors?.redisUsageQueueRetentionSeconds
  );
  const requestRetryError = getValidationMessage(t, validationErrors?.requestRetry);
  const maxRetryCredentialsError = getValidationMessage(t, validationErrors?.maxRetryCredentials);
  const maxRetryIntervalError = getValidationMessage(t, validationErrors?.maxRetryInterval);
  const authAutoRefreshWorkersError = getValidationMessage(
    t,
    validationErrors?.authAutoRefreshWorkers
  );
  const keepaliveError = getValidationMessage(t, validationErrors?.['streaming.keepaliveSeconds']);
  const bootstrapRetriesError = getValidationMessage(
    t,
    validationErrors?.['streaming.bootstrapRetries']
  );
  const nonstreamKeepaliveError = getValidationMessage(
    t,
    validationErrors?.['streaming.nonstreamKeepaliveInterval']
  );

  const handleApiKeysTextChange = useCallback(
    (apiKeysText: string) => onChange({ apiKeysText }),
    [onChange]
  );
  const handlePayloadDefaultRulesChange = useCallback(
    (payloadDefaultRules: PayloadRule[]) => onChange({ payloadDefaultRules }),
    [onChange]
  );
  const handlePayloadDefaultRawRulesChange = useCallback(
    (payloadDefaultRawRules: PayloadRule[]) => onChange({ payloadDefaultRawRules }),
    [onChange]
  );
  const handlePayloadOverrideRulesChange = useCallback(
    (payloadOverrideRules: PayloadRule[]) => onChange({ payloadOverrideRules }),
    [onChange]
  );
  const handlePayloadOverrideRawRulesChange = useCallback(
    (payloadOverrideRawRules: PayloadRule[]) => onChange({ payloadOverrideRawRules }),
    [onChange]
  );
  const handlePayloadFilterRulesChange = useCallback(
    (payloadFilterRules: PayloadFilterRule[]) => onChange({ payloadFilterRules }),
    [onChange]
  );
  const disableImageGenerationOptions = useMemo(
    () => [
      {
        value: 'false',
        label: t('config_management.visual.sections.network.disable_image_generation_false'),
      },
      {
        value: 'true',
        label: t('config_management.visual.sections.network.disable_image_generation_true'),
      },
      {
        value: 'chat',
        label: t('config_management.visual.sections.network.disable_image_generation_chat'),
      },
    ],
    [t]
  );

  const countErrors = useCallback(
    (fields: VisualConfigFieldPath[]) =>
      fields.reduce((total, field) => total + (validationErrors?.[field] ? 1 : 0), 0),
    [validationErrors]
  );

  const sections = useMemo<VisualSection[]>(
    () => [
      {
        id: 'server',
        title: t('config_management.visual.sections.server.title'),
        icon: SettingsIcon,
        errorCount: countErrors(['port']),
      },
      {
        id: 'auth',
        title: t('config_management.visual.sections.auth.title'),
        icon: KeyRoundIcon,
        errorCount: 0,
      },
      {
        id: 'system',
        title: t('config_management.visual.sections.system.title'),
        icon: DiamondIcon,
        errorCount: countErrors([
          'errorLogsMaxFiles',
          'logsMaxTotalSizeMb',
          'redisUsageQueueRetentionSeconds',
          'requestRetry',
          'maxRetryCredentials',
          'maxRetryInterval',
          'authAutoRefreshWorkers',
        ]),
      },
      {
        id: 'quota',
        title: t('config_management.visual.sections.quota.title'),
        icon: TimerIcon,
        errorCount: 0,
      },
      {
        id: 'streaming',
        title: t('config_management.visual.sections.streaming.title'),
        icon: SatelliteDishIcon,
        errorCount: countErrors([
          'streaming.keepaliveSeconds',
          'streaming.bootstrapRetries',
          'streaming.nonstreamKeepaliveInterval',
        ]),
      },
      {
        id: 'payload',
        title: t('config_management.visual.sections.payload.title'),
        icon: Code2Icon,
        errorCount: hasPayloadValidationErrors ? 1 : 0,
      },
    ],
    [countErrors, hasPayloadValidationErrors, t]
  );

  const navContent = (
    <div className={styles.navList}>
      {sections.map((section, index) => {
        const Icon = section.icon;
        const active = activeSectionId === section.id;

        return (
          <Link
            key={section.id}
            to={`/config/${section.id}`}
            className={cn(
              buttonVariants({ variant: active ? 'secondary' : 'ghost', size: 'sm' }),
              styles.navButton
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon data-icon="inline-start" />
            <span className={styles.navLabel}>
              {String(index + 1).padStart(2, '0')} {section.title}
            </span>
            {section.errorCount > 0 ? (
              <Badge
                className={styles.navBadge}
                variant="outline"
                aria-label={`${section.errorCount}`}
              >
                {section.errorCount}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className={styles.visualEditor}>
      <div className={styles.workspace}>
        {isMobile ? (
          <div className={styles.mobileSectionNav}>
            <div
              className={styles.mobileSectionNavScroller}
              aria-label={t('config_management.visual.quick_jump', { defaultValue: '快速跳转' })}
            >
              {sections.map((section, index) => (
                <Link
                  key={section.id}
                  to={`/config/${section.id}`}
                  className={cn(
                    styles.mobileSectionNavButton,
                    activeSectionId === section.id && styles.mobileSectionNavButtonActive
                  )}
                  aria-current={activeSectionId === section.id ? 'page' : undefined}
                >
                  <span className={styles.mobileSectionNavLabel}>
                    {String(index + 1).padStart(2, '0')} {section.title}
                  </span>
                  {section.errorCount > 0 ? (
                    <Badge className={styles.mobileSectionNavBadge} variant="outline">
                      {section.errorCount}
                    </Badge>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <aside className={styles.sidebar}>
          <div className={styles.sidebarRail}>{navContent}</div>
        </aside>

        <div className={styles.sections}>
          {activeSectionId === 'server' ? (
          <ConfigSection
            id="server"
            indexLabel="01"
            icon={<SettingsIcon size={16} />}
            title={t('config_management.visual.sections.server.title')}
            description={t('config_management.visual.sections.server.description')}
            action={pageActions}
          >
            <SectionStack>
              <SectionGrid>
                <Input
                  label={t('config_management.visual.sections.server.host')}
                  placeholder="0.0.0.0"
                  value={values.host}
                  onChange={(e) => onChange({ host: e.target.value })}
                  disabled={disabled}
                />
                <Input
                  label={t('config_management.visual.sections.server.port')}
                  type="number"
                  placeholder="8317"
                  value={values.port}
                  onChange={(e) => onChange({ port: e.target.value })}
                  disabled={disabled}
                  error={portError}
                />
              </SectionGrid>

              <SectionSubsection
                title={t('config_management.visual.sections.tls.title')}
                description={t('config_management.visual.sections.tls.description')}
              >
                <SectionStack>
                  <ToggleRow
                    title={t('config_management.visual.sections.tls.enable')}
                    description={t('config_management.visual.sections.tls.enable_desc')}
                    checked={values.tlsEnable}
                    disabled={disabled}
                    onChange={(tlsEnable) => onChange({ tlsEnable })}
                  />

                  {values.tlsEnable ? (
                    <>
                      <Divider />
                      <SectionGrid>
                        <Input
                          label={t('config_management.visual.sections.tls.cert')}
                          placeholder="/path/to/cert.pem"
                          value={values.tlsCert}
                          onChange={(e) => onChange({ tlsCert: e.target.value })}
                          disabled={disabled}
                        />
                        <Input
                          label={t('config_management.visual.sections.tls.key')}
                          placeholder="/path/to/key.pem"
                          value={values.tlsKey}
                          onChange={(e) => onChange({ tlsKey: e.target.value })}
                          disabled={disabled}
                        />
                      </SectionGrid>
                    </>
                  ) : null}
                </SectionStack>
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.remote.title')}
                description={t('config_management.visual.sections.remote.description')}
              >
                <SectionStack>
                  <SectionGrid>
                    <ToggleRow
                      title={t('config_management.visual.sections.remote.allow_remote')}
                      description={t('config_management.visual.sections.remote.allow_remote_desc')}
                      checked={values.rmAllowRemote}
                      disabled={disabled}
                      onChange={(rmAllowRemote) => onChange({ rmAllowRemote })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.remote.disable_panel')}
                      description={t('config_management.visual.sections.remote.disable_panel_desc')}
                      checked={values.rmDisableControlPanel}
                      disabled={disabled}
                      onChange={(rmDisableControlPanel) => onChange({ rmDisableControlPanel })}
                    />
                    <ToggleRow
                      title={t(
                        'config_management.visual.sections.remote.disable_auto_update_panel'
                      )}
                      description={t(
                        'config_management.visual.sections.remote.disable_auto_update_panel_desc'
                      )}
                      checked={values.rmDisableAutoUpdatePanel}
                      disabled={disabled}
                      onChange={(rmDisableAutoUpdatePanel) =>
                        onChange({ rmDisableAutoUpdatePanel })
                      }
                    />
                  </SectionGrid>
                  <SectionGrid>
                    <Input
                      label={t('config_management.visual.sections.remote.secret_key')}
                      type="password"
                      placeholder={t(
                        'config_management.visual.sections.remote.secret_key_placeholder'
                      )}
                      value={values.rmSecretKey}
                      onChange={(e) => onChange({ rmSecretKey: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.remote.panel_repo')}
                      placeholder="https://github.com/CuzTeam/CPAPro"
                      value={values.rmPanelRepo}
                      onChange={(e) => onChange({ rmPanelRepo: e.target.value })}
                      disabled={disabled}
                    />
                  </SectionGrid>
                </SectionStack>
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>
          ) : null}

          {activeSectionId === 'auth' ? (
          <ConfigSection
            id="auth"
            indexLabel="02"
            icon={<KeyRoundIcon size={16} />}
            title={t('config_management.visual.sections.auth.title')}
            description={t('config_management.visual.sections.auth.description')}
            action={pageActions}
          >
            <SectionStack>
              <Input
                label={t('config_management.visual.sections.auth.auth_dir')}
                placeholder="~/.cli-proxy-api"
                value={values.authDir}
                onChange={(e) => onChange({ authDir: e.target.value })}
                disabled={disabled}
                hint={t('config_management.visual.sections.auth.auth_dir_hint')}
              />
              <div className={styles.subsection}>
                <ApiKeysCardEditor
                  value={values.apiKeysText}
                  disabled={disabled}
                  onChange={handleApiKeysTextChange}
                />
              </div>
            </SectionStack>
          </ConfigSection>
          ) : null}

          {activeSectionId === 'system' ? (
          <ConfigSection
            id="system"
            indexLabel="03"
            icon={<DiamondIcon size={16} />}
            title={t('config_management.visual.sections.system.title')}
            description={t('config_management.visual.sections.system.description')}
            action={pageActions}
          >
            <SectionStack>
              <SectionGrid>
                <ToggleRow
                  title={t('config_management.visual.sections.system.debug')}
                  description={t('config_management.visual.sections.system.debug_desc')}
                  checked={values.debug}
                  disabled={disabled}
                  onChange={(debug) => onChange({ debug })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.system.commercial_mode')}
                  description={t('config_management.visual.sections.system.commercial_mode_desc')}
                  checked={values.commercialMode}
                  disabled={disabled}
                  onChange={(commercialMode) => onChange({ commercialMode })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.system.logging_to_file')}
                  description={t('config_management.visual.sections.system.logging_to_file_desc')}
                  checked={values.loggingToFile}
                  disabled={disabled}
                  onChange={(loggingToFile) => onChange({ loggingToFile })}
                />
              </SectionGrid>

              <SectionGrid>
                <Input
                  label={t('config_management.visual.sections.system.logs_max_size')}
                  type="number"
                  placeholder="0"
                  value={values.logsMaxTotalSizeMb}
                  onChange={(e) => onChange({ logsMaxTotalSizeMb: e.target.value })}
                  disabled={disabled}
                  error={logsMaxSizeError}
                />
                <Input
                  label={t('config_management.visual.sections.system.error_logs_max_files')}
                  type="number"
                  placeholder="10"
                  value={values.errorLogsMaxFiles}
                  onChange={(e) => onChange({ errorLogsMaxFiles: e.target.value })}
                  disabled={disabled}
                  error={errorLogsMaxFilesError}
                />
                <Input
                  label={t('config_management.visual.sections.system.redis_usage_retention')}
                  type="number"
                  placeholder="60"
                  value={values.redisUsageQueueRetentionSeconds}
                  onChange={(e) => onChange({ redisUsageQueueRetentionSeconds: e.target.value })}
                  disabled={disabled}
                  hint={t('config_management.visual.sections.system.redis_usage_retention_hint')}
                  error={redisUsageQueueRetentionError}
                />
              </SectionGrid>
              <SectionGrid>
                <ToggleRow
                  title={t('config_management.visual.sections.system.usage_statistics_enabled')}
                  description={t(
                    'config_management.visual.sections.system.usage_statistics_enabled_desc'
                  )}
                  checked={values.usageStatisticsEnabled}
                  disabled={disabled}
                  onChange={(usageStatisticsEnabled) => onChange({ usageStatisticsEnabled })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.system.antigravity_signature_cache')}
                  description={t(
                    'config_management.visual.sections.system.antigravity_signature_cache_desc'
                  )}
                  checked={values.antigravitySignatureCacheEnabled}
                  disabled={disabled}
                  onChange={(antigravitySignatureCacheEnabled) =>
                    onChange({ antigravitySignatureCacheEnabled })
                  }
                />
                <ToggleRow
                  title={t('config_management.visual.sections.system.antigravity_signature_strict')}
                  description={t(
                    'config_management.visual.sections.system.antigravity_signature_strict_desc'
                  )}
                  checked={values.antigravitySignatureBypassStrict}
                  disabled={disabled}
                  onChange={(antigravitySignatureBypassStrict) =>
                    onChange({ antigravitySignatureBypassStrict })
                  }
                />
              </SectionGrid>

              <SectionSubsection
                title={t('config_management.visual.sections.headers.title')}
                description={t('config_management.visual.sections.headers.description')}
              >
                <SectionStack>
                  <div className={styles.subsectionHeader}>
                    <h3 className={styles.subsectionTitle}>
                      {t('config_management.visual.sections.headers.claude_title')}
                    </h3>
                  </div>
                  <SectionGrid>
                    <Input
                      label={t('config_management.visual.sections.headers.user_agent')}
                      placeholder="claude-cli/2.1.44 (external, sdk-cli)"
                      value={values.claudeHeaderUserAgent}
                      onChange={(e) => onChange({ claudeHeaderUserAgent: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.headers.package_version')}
                      placeholder="0.74.0"
                      value={values.claudeHeaderPackageVersion}
                      onChange={(e) => onChange({ claudeHeaderPackageVersion: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.headers.runtime_version')}
                      placeholder="v24.3.0"
                      value={values.claudeHeaderRuntimeVersion}
                      onChange={(e) => onChange({ claudeHeaderRuntimeVersion: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.headers.os')}
                      placeholder="MacOS"
                      value={values.claudeHeaderOs}
                      onChange={(e) => onChange({ claudeHeaderOs: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.headers.arch')}
                      placeholder="arm64"
                      value={values.claudeHeaderArch}
                      onChange={(e) => onChange({ claudeHeaderArch: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.headers.timeout')}
                      placeholder="600"
                      value={values.claudeHeaderTimeout}
                      onChange={(e) => onChange({ claudeHeaderTimeout: e.target.value })}
                      disabled={disabled}
                    />
                  </SectionGrid>
                  <SectionGrid>
                    <ToggleRow
                      title={t('config_management.visual.sections.headers.stabilize_device')}
                      description={t(
                        'config_management.visual.sections.headers.stabilize_device_desc'
                      )}
                      checked={values.claudeHeaderStabilizeDeviceProfile}
                      disabled={disabled}
                      onChange={(claudeHeaderStabilizeDeviceProfile) =>
                        onChange({ claudeHeaderStabilizeDeviceProfile })
                      }
                    />
                  </SectionGrid>
                  <Divider />
                  <div className={styles.subsectionHeader}>
                    <h3 className={styles.subsectionTitle}>
                      {t('config_management.visual.sections.headers.codex_title')}
                    </h3>
                  </div>
                  <SectionGrid>
                    <Input
                      label={t('config_management.visual.sections.headers.user_agent')}
                      placeholder="codex_cli_rs/0.114.0 (Mac OS 14.2.0; x86_64) vscode/1.111.0"
                      value={values.codexHeaderUserAgent}
                      onChange={(e) => onChange({ codexHeaderUserAgent: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.headers.beta_features')}
                      placeholder="multi_agent"
                      value={values.codexHeaderBetaFeatures}
                      onChange={(e) => onChange({ codexHeaderBetaFeatures: e.target.value })}
                      disabled={disabled}
                    />
                  </SectionGrid>
                </SectionStack>
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.network.title')}
                description={t('config_management.visual.sections.network.description')}
              >
                <SectionStack>
                  <SectionGrid>
                    <Input
                      label={t('config_management.visual.sections.network.proxy_url')}
                      placeholder="socks5://user:pass@127.0.0.1:1080/"
                      value={values.proxyUrl}
                      onChange={(e) => onChange({ proxyUrl: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.request_retry')}
                      type="number"
                      placeholder="3"
                      value={values.requestRetry}
                      onChange={(e) => onChange({ requestRetry: e.target.value })}
                      disabled={disabled}
                      error={requestRetryError}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.max_retry_credentials')}
                      type="number"
                      placeholder="0"
                      value={values.maxRetryCredentials}
                      onChange={(e) => onChange({ maxRetryCredentials: e.target.value })}
                      disabled={disabled}
                      hint={t(
                        'config_management.visual.sections.network.max_retry_credentials_hint'
                      )}
                      error={maxRetryCredentialsError}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.max_retry_interval')}
                      type="number"
                      placeholder="30"
                      value={values.maxRetryInterval}
                      onChange={(e) => onChange({ maxRetryInterval: e.target.value })}
                      disabled={disabled}
                      error={maxRetryIntervalError}
                    />
                    <Input
                      label={t(
                        'config_management.visual.sections.network.auth_auto_refresh_workers'
                      )}
                      type="number"
                      placeholder="16"
                      value={values.authAutoRefreshWorkers}
                      onChange={(e) => onChange({ authAutoRefreshWorkers: e.target.value })}
                      disabled={disabled}
                      hint={t(
                        'config_management.visual.sections.network.auth_auto_refresh_workers_hint'
                      )}
                      error={authAutoRefreshWorkersError}
                    />
                    <FieldShell
                      label={t('config_management.visual.sections.network.routing_strategy')}
                      labelId={routingStrategyLabelId}
                      hint={t('config_management.visual.sections.network.routing_strategy_hint')}
                      hintId={routingStrategyHintId}
                    >
                      <Select
                        value={values.routingStrategy}
                        options={[
                          {
                            value: 'round-robin',
                            label: t(
                              'config_management.visual.sections.network.strategy_round_robin'
                            ),
                          },
                          {
                            value: 'fill-first',
                            label: t(
                              'config_management.visual.sections.network.strategy_fill_first'
                            ),
                          },
                        ]}
                        id={`${routingStrategyLabelId}-select`}
                        disabled={disabled}
                        ariaLabelledBy={routingStrategyLabelId}
                        ariaDescribedBy={routingStrategyHintId}
                        onChange={(nextValue) =>
                          onChange({
                            routingStrategy: nextValue as VisualConfigValues['routingStrategy'],
                          })
                        }
                      />
                    </FieldShell>
                    <FieldShell
                      label={t(
                        'config_management.visual.sections.network.disable_image_generation'
                      )}
                      labelId={disableImageGenerationLabelId}
                      hint={t(
                        'config_management.visual.sections.network.disable_image_generation_hint'
                      )}
                      hintId={disableImageGenerationHintId}
                    >
                      <Select
                        value={values.disableImageGeneration}
                        options={disableImageGenerationOptions}
                        id={`${disableImageGenerationLabelId}-select`}
                        disabled={disabled}
                        ariaLabelledBy={disableImageGenerationLabelId}
                        ariaDescribedBy={disableImageGenerationHintId}
                        onChange={(nextValue) =>
                          onChange({
                            disableImageGeneration:
                              nextValue as VisualConfigValues['disableImageGeneration'],
                          })
                        }
                      />
                    </FieldShell>
                    <Input
                      label={t('config_management.visual.sections.network.session_affinity_ttl')}
                      placeholder="1h"
                      value={values.routingSessionAffinityTTL}
                      onChange={(e) => onChange({ routingSessionAffinityTTL: e.target.value })}
                      disabled={disabled}
                    />
                  </SectionGrid>

                  <SectionGrid>
                    <ToggleRow
                      title={t('config_management.visual.sections.network.force_model_prefix')}
                      description={t(
                        'config_management.visual.sections.network.force_model_prefix_desc'
                      )}
                      checked={values.forceModelPrefix}
                      disabled={disabled}
                      onChange={(forceModelPrefix) => onChange({ forceModelPrefix })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.passthrough_headers')}
                      description={t(
                        'config_management.visual.sections.network.passthrough_headers_desc'
                      )}
                      checked={values.passthroughHeaders}
                      disabled={disabled}
                      onChange={(passthroughHeaders) => onChange({ passthroughHeaders })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.disable_cooling')}
                      description={t(
                        'config_management.visual.sections.network.disable_cooling_desc'
                      )}
                      checked={values.disableCooling}
                      disabled={disabled}
                      onChange={(disableCooling) => onChange({ disableCooling })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.session_affinity')}
                      checked={values.routingSessionAffinity}
                      disabled={disabled}
                      onChange={(routingSessionAffinity) => onChange({ routingSessionAffinity })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.ws_auth')}
                      description={t('config_management.visual.sections.network.ws_auth_desc')}
                      checked={values.wsAuth}
                      disabled={disabled}
                      onChange={(wsAuth) => onChange({ wsAuth })}
                    />
                    <ToggleRow
                      title={t(
                        'config_management.visual.sections.network.enable_gemini_cli_endpoint'
                      )}
                      description={t(
                        'config_management.visual.sections.network.enable_gemini_cli_endpoint_desc'
                      )}
                      checked={values.enableGeminiCliEndpoint}
                      disabled={disabled}
                      onChange={(enableGeminiCliEndpoint) => onChange({ enableGeminiCliEndpoint })}
                    />
                  </SectionGrid>
                </SectionStack>
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>
          ) : null}

          {activeSectionId === 'quota' ? (
          <ConfigSection
            id="quota"
            indexLabel="04"
            icon={<TimerIcon size={16} />}
            title={t('config_management.visual.sections.quota.title')}
            description={t('config_management.visual.sections.quota.description')}
            action={pageActions}
          >
            <SectionGrid>
              <ToggleRow
                title={t('config_management.visual.sections.quota.switch_project')}
                description={t('config_management.visual.sections.quota.switch_project_desc')}
                checked={values.quotaSwitchProject}
                disabled={disabled}
                onChange={(quotaSwitchProject) => onChange({ quotaSwitchProject })}
              />
              <ToggleRow
                title={t('config_management.visual.sections.quota.switch_preview_model')}
                description={t('config_management.visual.sections.quota.switch_preview_model_desc')}
                checked={values.quotaSwitchPreviewModel}
                disabled={disabled}
                onChange={(quotaSwitchPreviewModel) => onChange({ quotaSwitchPreviewModel })}
              />
              <ToggleRow
                title={t('config_management.visual.sections.quota.antigravity_credits')}
                checked={values.quotaAntigravityCredits}
                disabled={disabled}
                onChange={(quotaAntigravityCredits) => onChange({ quotaAntigravityCredits })}
              />
            </SectionGrid>
          </ConfigSection>
          ) : null}

          {activeSectionId === 'streaming' ? (
          <ConfigSection
            id="streaming"
            indexLabel="05"
            icon={<SatelliteDishIcon size={16} />}
            title={t('config_management.visual.sections.streaming.title')}
            description={t('config_management.visual.sections.streaming.description')}
            action={pageActions}
          >
            <SectionStack>
              <SectionGrid>
                <FieldShell
                  label={t('config_management.visual.sections.streaming.keepalive_seconds')}
                  htmlFor={keepaliveInputId}
                  hint={t('config_management.visual.sections.streaming.keepalive_hint')}
                  hintId={keepaliveHintId}
                  error={keepaliveError}
                  errorId={keepaliveErrorId}
                >
                  <div className={styles.fieldControl}>
                    <input
                      id={keepaliveInputId}
                      className="input"
                      type="number"
                      placeholder="0"
                      value={values.streaming.keepaliveSeconds}
                      onChange={(e) =>
                        onChange({
                          streaming: {
                            ...values.streaming,
                            keepaliveSeconds: e.target.value,
                          },
                        })
                      }
                      disabled={disabled}
                    />
                    {isKeepaliveDisabled ? (
                      <span className={styles.inlinePill}>
                        {t('config_management.visual.sections.streaming.disabled')}
                      </span>
                    ) : null}
                  </div>
                </FieldShell>

                <Input
                  label={t('config_management.visual.sections.streaming.bootstrap_retries')}
                  type="number"
                  placeholder="1"
                  value={values.streaming.bootstrapRetries}
                  onChange={(e) =>
                    onChange({
                      streaming: {
                        ...values.streaming,
                        bootstrapRetries: e.target.value,
                      },
                    })
                  }
                  disabled={disabled}
                  hint={t('config_management.visual.sections.streaming.bootstrap_hint')}
                  error={bootstrapRetriesError}
                />
              </SectionGrid>

              <SectionGrid>
                <FieldShell
                  label={t('config_management.visual.sections.streaming.nonstream_keepalive')}
                  htmlFor={nonstreamKeepaliveInputId}
                  hint={t('config_management.visual.sections.streaming.nonstream_keepalive_hint')}
                  hintId={nonstreamKeepaliveHintId}
                  error={nonstreamKeepaliveError}
                  errorId={nonstreamKeepaliveErrorId}
                >
                  <div className={styles.fieldControl}>
                    <input
                      id={nonstreamKeepaliveInputId}
                      className="input"
                      type="number"
                      placeholder="0"
                      value={values.streaming.nonstreamKeepaliveInterval}
                      onChange={(e) =>
                        onChange({
                          streaming: {
                            ...values.streaming,
                            nonstreamKeepaliveInterval: e.target.value,
                          },
                        })
                      }
                      disabled={disabled}
                    />
                    {isNonstreamKeepaliveDisabled ? (
                      <span className={styles.inlinePill}>
                        {t('config_management.visual.sections.streaming.disabled')}
                      </span>
                    ) : null}
                  </div>
                </FieldShell>
              </SectionGrid>
            </SectionStack>
          </ConfigSection>
          ) : null}

          {activeSectionId === 'payload' ? (
          <ConfigSection
            id="payload"
            indexLabel="06"
            icon={<Code2Icon size={16} />}
            title={t('config_management.visual.sections.payload.title')}
            description={t('config_management.visual.sections.payload.description')}
            action={pageActions}
          >
            <SectionStack>
              <SectionSubsection
                title={t('config_management.visual.sections.payload.default_rules')}
                description={t('config_management.visual.sections.payload.default_rules_desc')}
              >
                <PayloadRulesEditor
                  value={values.payloadDefaultRules}
                  disabled={disabled}
                  onChange={handlePayloadDefaultRulesChange}
                />
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.payload.default_raw_rules')}
                description={t('config_management.visual.sections.payload.default_raw_rules_desc')}
              >
                <PayloadRulesEditor
                  value={values.payloadDefaultRawRules}
                  disabled={disabled}
                  rawJsonValues
                  onChange={handlePayloadDefaultRawRulesChange}
                />
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.payload.override_rules')}
                description={t('config_management.visual.sections.payload.override_rules_desc')}
              >
                <PayloadRulesEditor
                  value={values.payloadOverrideRules}
                  disabled={disabled}
                  protocolFirst
                  onChange={handlePayloadOverrideRulesChange}
                />
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.payload.override_raw_rules')}
                description={t('config_management.visual.sections.payload.override_raw_rules_desc')}
              >
                <PayloadRulesEditor
                  value={values.payloadOverrideRawRules}
                  disabled={disabled}
                  protocolFirst
                  rawJsonValues
                  onChange={handlePayloadOverrideRawRulesChange}
                />
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.payload.filter_rules')}
                description={t('config_management.visual.sections.payload.filter_rules_desc')}
              >
                <PayloadFilterRulesEditor
                  value={values.payloadFilterRules}
                  disabled={disabled}
                  onChange={handlePayloadFilterRulesChange}
                />
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
