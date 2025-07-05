import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
// Обновлённый импорт
import errorCodes from '../../src/locales/en/errors.json';

type Props = {
  code?: keyof typeof errorCodes;
  customMessage?: string;
  className?: string;
  severity?: 'error' | 'warning';
};

export function ErrorAlert({
  code,
  customMessage,
  className = '',
  severity = 'error',
}: Props) {
  const { t } = useTranslation('errors');

  return (
    <div className={clsx(
      'p-3 rounded-lg border',
      severity === 'error' 
        ? 'bg-error-muted border-error' 
        : 'bg-warning-muted border-warning',
      className
    )}>
      <p className={severity === 'error' ? 'text-error' : 'text-warning'}>
        {customMessage || (code ? t(code) : t('unknown_error'))}
      </p>
    </div>
  );
}
