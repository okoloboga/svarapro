import { StyledContainer } from '@/components/StyledContainer';
import { ButtonProps } from '@/types/components';

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

  const renderIcon = (src: string, className: string) => {
    const srcString = String(src);
    
    // Check for URL-based icons (like copy.svg)
    const isCopyIcon = srcString.includes('copy');
    
    // Check for specific SVG content patterns
    const isRightIcon = srcString.includes('data:image/svg+xml') && srcString.includes('width=\'6\'') && srcString.includes('height=\'17\'');
    const isSlideDownIcon = srcString.includes('data:image/svg+xml') && srcString.includes('width=\'10\'') && srcString.includes('height=\'6\'');
    
    const isThemeable = isRightIcon || isSlideDownIcon || isCopyIcon;

    if (isThemeable) {
      if (isCopyIcon) {
        // For URL-based SVG (copy.svg) - use mask
        const iconStyles: React.CSSProperties = {
          backgroundColor: '#BBB9BD',
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
        };
        return <div className={className} style={iconStyles} />;
      } else {
        // For data URL SVG (right.svg, slide-down.svg) - use background-image
        const iconStyles: React.CSSProperties = {
          backgroundImage: `url(${src})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          filter: 'brightness(0) saturate(100%) invert(85%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(0.9) contrast(0.9)',
        };
        return <div className={className} style={iconStyles} />;
      }
    }
    return <img src={src} alt="" className={className} />;
  };

  const leftIconElement = icon ? renderIcon(icon, `${iconClassName} ${iconMargin}`) : null;

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
              {rightIcon && renderIcon(rightIcon, `${iconClassName} ml-2`)}
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
          {rightIcon && renderIcon(rightIcon, `${iconClassName} ml-2`)}
        </div>
      )}
    </div>
  </button>
  );
}