import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
// 1. Импортируем JSON, чтобы получить его структуру для типов
import errorCodes from '../../public/locales/en/errors.json';

type Props = {
  // 2. Используем ключи из импортированного JSON как тип для `code`
  code?: keyof typeof errorCodes;
  customMessage?: string;
  className?: string;
  severity?: 'error' | 'warning';
};

export function ErrorAlert({
  code,
  customMessage,
  className = '',
  severity = 'error'
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
        {/* Логика осталась прежней, но теперь она корректно работает с типами */}
        {customMessage || (code ? t(code) : t('unknown_error'))}
      </p>
    </div>
  );
}
