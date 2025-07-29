import './AddWalletWindow.css';
import { useTranslation } from 'react-i18next';

type AddWalletWindowProps = {
  onClose: () => void;
  onAdd: () => void;
};

export function AddWalletWindow({ onClose, onAdd }: AddWalletWindowProps) {
  const { t } = useTranslation('common');
  return (
    <div className="add-wallet-window">
      <div className="add-wallet-content">
        <p className="add-wallet-text">
          {t('add_wallet_window_text')}
        </p>
      </div>
      <div className="add-wallet-buttons">
        <button className="add-wallet-button add-wallet-add-button" onClick={onAdd}>
          {t('add')}
        </button>
        <button className="add-wallet-button add-wallet-cancel-button" onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
