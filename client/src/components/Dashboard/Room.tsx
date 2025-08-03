import { StyledContainer } from '../StyledContainer';
import { YellowButton } from '../Button/YellowButton';
import { useTranslation } from 'react-i18next';

type RoomProps = {
  id: number;
  players: number;
  stake: number;
};

export function Room({ id, players, stake }: RoomProps) {
  const { t } = useTranslation('common');
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
        {/* Первая строка */}
        <p className="text-sm font-semibold text-gray-400 text-center m-0">{t('room')}</p>
        <p className="text-sm font-semibold text-gray-400 text-center m-0">{t('players')}</p>
        <p className="text-sm font-semibold text-gray-400 text-center m-0">{t('stake')}</p>
        <YellowButton style={{ marginTop: '5px' }}>{t('enter')}</YellowButton>

        {/* Вторая строка */}
        <p className="text-base font-semibold text-white text-left m-0">№{id}</p>
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
        >
          {t('watch')}
        </button>
      </div>

      {/* Горизонтальная линия */}
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
