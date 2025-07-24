import React from 'react';
import { StyledContainer } from '../StyledContainer';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: string; // Путь к левой иконке
  iconPosition?: 'left' | 'right';
  layout?: 'horizontal' | 'vertical';
  iconClassName?: string;
  isActive?: boolean;
  justify?: 'start' | 'center' | 'end';
  rightIcon?: string; // Путь к правой иконке, всегда в крайнем правом углу
  rightText?: string;
  rightContentClassName?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  icon,
  iconPosition = 'left',
  layout = 'horizontal',
  iconClassName = 'w-6 h-6',
  isActive = false,
  justify = 'center',
  rightIcon,
  rightText,
  rightContentClassName,
  ...rest
}: ButtonProps) {
  const baseClasses = 'relative flex items-center font-semibold text-white';

  const sizeClasses = {
    sm: 'h-10 text-sm',
    md: 'h-12 text-base',
    lg: 'h-14 text-lg',
  };
  const finalSizeClasses = `${sizeClasses[size]}`;

  const fullWidthClass = fullWidth ? 'w-full' : '';

  const iconMargin = layout === 'vertical'
    ? (iconPosition === 'left' ? '-mb-1' : 'mt-0')
    : (iconPosition === 'left' ? 'mr-2' : 'ml-2');

  const leftIconElement = icon ? <img src={icon} alt="" className={`${iconClassName} ${iconMargin}`} /> : null;

  const textElement = <span className="relative z-10">{children}</span>;

  let content;
  if (layout === 'vertical') {
    if (iconPosition === 'right') {
      content = <>{textElement}{leftIconElement}</>;
    } else {
      content = <>{leftIconElement}{textElement}</>;
    }
  } else {
    content = <>{leftIconElement}{textElement}</>;
  }

  const contentLayoutClass = layout === 'vertical' ? 'flex-col' : 'flex-row';
  const justifyClass = `justify-${justify}`;

  if (variant === 'secondary') {
    return (
      <button onClick={onClick} className={`${baseClasses} ${finalSizeClasses} ${fullWidthClass} ${rest.className || ''}`} {...rest}>
        <StyledContainer
          className="w-full h-full"
          contentClassName={`w-full h-full flex items-center px-4 ${justifyClass} ${contentLayoutClass}`}
          isActive={isActive}
        >
          {content}
          {(rightIcon || rightText) && (
            <div className={`ml-auto flex-shrink-0 flex items-center ${rightContentClassName}`}>
              {rightText && <span>{rightText}</span>}
              {rightIcon && <img src={rightIcon} alt="" className={`${iconClassName} ml-2`} />}
            </div>
          )}
        </StyledContainer>
      </button>
    );
  }

  const variantClasses = {
    primary: 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-white rounded-lg',
    tertiary: 'bg-transparent text-white rounded-lg',
  };
  const finalVariantClasses = variantClasses[variant] || '';

  return (
    <button onClick={onClick} className={`${baseClasses} ${finalSizeClasses} ${fullWidthClass} ${finalVariantClasses} ${rest.className || ''}`} {...rest}>
    <div className={`flex items-center px-4 ${justifyClass} ${contentLayoutClass}`}>
      {content}
      {(rightIcon || rightText) && (
        <div className={`ml-auto flex-shrink-0 flex items-center ${rightContentClassName}`}>
          {rightText && <span>{rightText}</span>}
          {rightIcon && <img src={rightIcon} alt="" className={`${iconClassName} ml-2`} />}
        </div>
      )}
    </div>
  </button>
  );
}
