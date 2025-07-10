type MoreButtonProps = {
  icon: string;
  label: string;
  onClick?: () => void;
};

export function MoreButton({ icon, label, onClick }: MoreButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-[336px] h-[53px] flex items-center px-4 relative rounded-lg mb-3"
      style={{
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, #2D2B31 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '1px',
          background: '#46434B',
          borderRadius: '7px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <img 
        src={icon} 
        alt="" 
        className="w-[24px] h-[24px] mr-3 relative z-10" 
      />
      <span className="text-white text-left relative z-10">{label}</span>
    </button>
  );
}
