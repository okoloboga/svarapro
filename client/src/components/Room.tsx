type RoomProps = {
  id: number;
  players: number;
  stake: number;
};

export function Room({ id, players, stake }: RoomProps) {
  return (
    <div
      className="shadow-lg p-4 relative"
      style={{
        width: '336px',
        height: '90px',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        borderRadius: '15px',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '1px',
          background: '#48454D',
          borderRadius: '15px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gridTemplateRows: '10px 24px',
          gap: '25px',
        }}
        className="relative z-10"
      >
        {/* Первая строка */}
        <p
          style={{
            height: '20px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '13px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#C9C6CE',
            margin: '0px',
            textAlign: 'center',
          }}
        >
          Комната
        </p>
        <p
          style={{
            height: '20px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '13px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#C9C6CE',
            margin: '0px',
            textAlign: 'center',
          }}
        >
          Игроки
        </p>
        <p
          style={{
            height: '20px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '13px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#C9C6CE',
            margin: '0px',
            textAlign: 'center',
          }}
        >
          Ставка
        </p>
        <button
          style={{
            height: '28px',
            background: 'linear-gradient(180deg, #FFC53F 7.5%, #AF6600 100%)',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '13px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#000000',
            width: '100%',
            marginTop: '5px',
          }}
        >
          Войти
        </button>

        {/* Вторая строка */}
        <p
          style={{
            height: '24px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#FFFFFF',
            margin: '0',
            textAlign: 'left',
          }}
        >
          №{id}
        </p>
        <p
          style={{
            height: '24px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            margin: '0',
            textAlign: 'center',
          }}
        >
          <span style={{ color: '#12B754' }}>{players}</span>{' '}
          <span style={{ color: '#FFFFFF' }}>/ 6</span>
        </p>
        <p
          style={{
            height: '24px',
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '16px',
            lineHeight: '150%',
            letterSpacing: '-0.011em',
            color: '#FFFFFF',
            margin: '0',
            textAlign: 'center',
          }}
        >
          ${stake}
        </p>
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
          Смотреть
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
    </div>
  );
}
