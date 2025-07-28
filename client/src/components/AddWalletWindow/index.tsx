import './AddWalletWindow.css';

type AddWalletWindowProps = {
  onClose: () => void;
  onAdd: () => void;
};

export function AddWalletWindow({ onClose, onAdd }: AddWalletWindowProps) {
  return (
    <div className="add-wallet-window">
      <div className="add-wallet-content">
        <p className="add-wallet-text">
          Для выполнения вывода средств, пожалуйста, добавьте ваш адрес USDT-TON
        </p>
      </div>
      <div className="add-wallet-buttons">
        <button className="add-wallet-button add-wallet-add-button" onClick={onAdd}>
          Добавить
        </button>
        <button className="add-wallet-button add-wallet-cancel-button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
