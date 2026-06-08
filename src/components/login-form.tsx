import type { ComponentProps, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, EyeOffIcon, LanguagesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';

interface LoginFormProps extends Omit<ComponentProps<'form'>, 'onSubmit'> {
  apiBase: string;
  detectedBase: string;
  error: string;
  language: string;
  loading: boolean;
  managementKey: string;
  rememberPassword: boolean;
  showCustomBase: boolean;
  showKey: boolean;
  onApiBaseChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onManagementKeyChange: (value: string) => void;
  onRememberPasswordChange: (value: boolean) => void;
  onShowCustomBaseChange: (value: boolean) => void;
  onToggleShowKey: () => void;
  onSubmit: () => void;
}

export function LoginForm({
  apiBase,
  className,
  detectedBase,
  error,
  language,
  loading,
  managementKey,
  rememberPassword,
  showCustomBase,
  showKey,
  onApiBaseChange,
  onLanguageChange,
  onManagementKeyChange,
  onRememberPasswordChange,
  onShowCustomBaseChange,
  onToggleShowKey,
  onSubmit,
  ...props
}: LoginFormProps) {
  const { t } = useTranslation();

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !loading) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <form
      className={cn('flex flex-col gap-6', className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      {...props}
    >
      <FieldGroup>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-bold">{t('title.login')}</h1>
            <p className="text-sm text-balance text-muted-foreground">{t('login.subtitle')}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title={t('language.switch')}
                aria-label={t('language.switch')}
              >
                <LanguagesIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuLabel>{t('language.switch')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={language} onValueChange={onLanguageChange}>
                {LANGUAGE_ORDER.map((lang) => (
                  <DropdownMenuRadioItem key={lang} value={lang}>
                    {t(LANGUAGE_LABEL_KEYS[lang])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Field>
          <FieldLabel>{t('login.connection_current')}</FieldLabel>
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <div className="truncate font-medium">{apiBase || detectedBase}</div>
            <p className="mt-1 text-muted-foreground">{t('login.connection_auto_hint')}</p>
          </div>
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            id="custom-base"
            checked={showCustomBase}
            onCheckedChange={(checked) => onShowCustomBaseChange(checked === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor="custom-base">{t('login.custom_connection_label')}</FieldLabel>
            <FieldDescription>{t('login.custom_connection_hint')}</FieldDescription>
          </FieldContent>
        </Field>

        {showCustomBase && (
          <Field>
            <FieldLabel htmlFor="api-base">{t('login.custom_connection_label')}</FieldLabel>
            <Input
              id="api-base"
              value={apiBase}
              onChange={(event) => onApiBaseChange(event.target.value)}
              placeholder={t('login.custom_connection_placeholder')}
              autoComplete="url"
              className="bg-background"
            />
          </Field>
        )}

        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="management-key">{t('login.management_key_label')}</FieldLabel>
          <Input
            id="management-key"
            autoFocus
            type={showKey ? 'text' : 'password'}
            name="cpa-management-key"
            autoComplete="current-password"
            value={managementKey}
            onChange={(event) => onManagementKeyChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('login.management_key_placeholder')}
            aria-invalid={Boolean(error)}
            className="bg-background"
            rightElement={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onToggleShowKey}
                aria-label={
                  showKey
                    ? t('login.hide_key', { defaultValue: 'Hide key' })
                    : t('login.show_key', { defaultValue: 'Show key' })
                }
                title={
                  showKey
                    ? t('login.hide_key', { defaultValue: 'Hide key' })
                    : t('login.show_key', { defaultValue: 'Show key' })
                }
              >
                {showKey ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            }
          />
          <FieldError>{error}</FieldError>
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            id="remember-password"
            checked={rememberPassword}
            onCheckedChange={(checked) => onRememberPasswordChange(checked === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor="remember-password">{t('login.remember_password_label')}</FieldLabel>
          </FieldContent>
        </Field>

        <Field>
          <Button type="submit" fullWidth loading={loading} disabled={loading}>
            {loading ? t('login.submitting') : t('login.submit_button')}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
