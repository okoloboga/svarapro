import React from 'react';

interface NoConnectProps {
  isVisible: boolean;
  onRetry?: () => void;
}

export function NoConnect({ isVisible, onRetry }: NoConnectProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#36333B] rounded-lg p-6 mx-4 max-w-sm w-full text-center">
        <div className="mb-4">
          {/* Иконка подключения - будет заменена на дизайн */}
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl">!</span>
          </div>
          
          {/* Заголовок */}
          <h3 className="text-white text-lg font-semibold mb-2">
            Проблемы с подключением
          </h3>
          
          {/* Описание */}
          <p className="text-gray-300 text-sm mb-4">
            Потеряно соединение с сервером. Проверьте интернет-соединение.
          </p>
        </div>
        
        {/* Кнопка повтора */}
        <button
          onClick={onRetry}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}