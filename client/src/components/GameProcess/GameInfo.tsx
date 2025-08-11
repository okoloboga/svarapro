
import { GameState } from '@/types/game';

interface GameInfoProps {
  gameState: GameState;
}

export function GameInfo({ gameState }: GameInfoProps) {
  const { pot, status, round, rake } = gameState;
  
  // Получаем последние 5 действий из лога
  const recentActions = gameState.log.slice(-5).reverse();
  
  // Функция для форматирования статуса игры
  const formatStatus = (status: string) => {
    switch (status) {
      case 'waiting': return 'Ожидание игроков';
      case 'ante': return 'Входные ставки';
      case 'blind_betting': return 'Ставки вслепую';
      case 'betting': return 'Торги';
      case 'showdown': return 'Вскрытие карт';
      case 'svara': return 'Свара';
      case 'finished': return 'Игра завершена';
      default: return status;
    }
  };

  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg">
      <div className="flex justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Статус</h3>
          <p className="text-md">{formatStatus(status)}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Раунд</h3>
          <p className="text-md">{round}</p>
        </div>
        {rake > 0 && (
          <div>
            <h3 className="text-lg font-semibold">Комиссия</h3>
            <p className="text-md text-red-400">${rake}</p>
          </div>
        )}
      </div>
      
      {/* Лог игры */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Последние действия</h3>
        <div className="bg-gray-700 p-2 rounded-lg max-h-32 overflow-y-auto">
          {recentActions.map((action, index) => (
            <div key={index} className="text-sm mb-1">
              <span className="text-gray-400">
                {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}:
              </span>{' '}
              {action.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
