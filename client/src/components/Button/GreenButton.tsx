import { ButtonProps } from '@/types/components';

export function GreenButton({ children, onClick, ...rest }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="text-white rounded-lg w-[85px] h-[28px] flex items-center justify-center"
      style={{
        backgroundColor: 'rgb(18 183 84)',
        textShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px rgba(0, 0, 0, 0.15)',
        ...rest.style,
      }}
      {...rest}
    >
      <span className="font-inter font-semibold text-[13px] leading-[20px] text-center">
        {children}
      </span>
    </button>
  );
}
