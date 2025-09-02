import { StyledContainer } from '@/components/StyledContainer';
import { YellowButton } from '@/components/Button/YellowButton';
import { useTranslation } from 'react-i18next';
import { apiService } from '@/services/api/api';
import { useState } from 'react';
import { RoomProps } from '@/types/components';

export function Room({ roomId, players, stake, setCurrentPage, balance, setNotification }: RoomProps) {
  const { t } = useTranslation('common');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    const hasEnoughBalance = parseFloat(balance) >= stake * 10;
    if (!hasEnoughBalance) {
      setNotification('insufficientBalance');
      return;
    }

    setIsJoining(true);
    try {
      await apiService.joinRoom(roomId);
      setCurrentPage('gameRoom', { roomId, autoSit: true });
    } catch (e) {
      const error = e as { response?: { data?: { message?: string } } };
      console.error('Failed to join room:', error);
      
      if (error.response?.data?.message?.includes('game already started')) {
        setCurrentPage('gameRoom', { roomId, autoSit: false });
      } else {
        setNotification('gameJoinError');
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleWatch = async () => {
    setIsJoining(true);
    try {
      setCurrentPage('gameRoom', { roomId, autoSit: false });
    } catch (error) {
      console.error('Failed to watch room:', error);
      setNotification('gameJoinError');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <StyledContainer 
      className="w-[95vw] h-[90px] p-4 rounded-[15px]"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: '10px 25px',
          alignItems: 'center',
        }}
      >
        <p className="text-sm font-semibold text-gray-400 text-center m-0">{t('room')}</p>
        <p className="text-sm font-semibold text-gray-400 text-center m-0">{t('players')}</p>
        <p className="text-sm font-semibold text-gray-400 text-center m-0">{t('stake')}</p>
        <YellowButton 
          style={{ marginTop: '5px' }} 
          onClick={handleJoin}
          disabled={isJoining}
        >
          {t('enter')}
        </YellowButton>
        <p className="text-base font-semibold text-white text-left m-0">№{roomId.slice(0, 8)}</p>
        <p className="text-base font-semibold text-center m-0">
          <span style={{ color: '#12B754' }}>{players}</span>
          <span className="text-white"> / 6</span>
        </p>
        <p className="text-base font-semibold text-white text-center m-0">${stake}</p>
        <button
          style={{
            height: '21px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#808797',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            marginTop: '5px',
          }}
          onClick={handleWatch}
          disabled={isJoining}
        >
          {t('watch')}
        </button>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '5%',
          right: '33.6%',
          top: '50%',
          height: '1px',
          background: '#FFFFFF',
          opacity: 0.05,
        }}
      />
    </StyledContainer>
  );
}