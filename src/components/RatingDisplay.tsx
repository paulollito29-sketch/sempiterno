import React from 'react';

interface RatingDisplayProps {
  rating: number; // 1 to 5
  max?: number;
  type?: 'cheese' | 'heart';
  interactive?: boolean;
  onChange?: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const RatingDisplay: React.FC<RatingDisplayProps> = ({
  rating,
  max = 5,
  type = 'cheese',
  interactive = false,
  onChange,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const iconFilled = type === 'cheese' ? '🧀' : '❤️';
  const iconEmpty = type === 'cheese' ? '⚪' : '🤍';

  return (
    <div className="flex items-center gap-1 select-none">
      {Array.from({ length: max }).map((_, idx) => {
        const starValue = idx + 1;
        const isFilled = starValue <= rating;

        return (
          <button
            key={idx}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange && onChange(starValue)}
            className={`transition-transform duration-100 ${sizeClasses[size]} ${
              interactive
                ? 'cursor-pointer hover:scale-125 active:scale-95'
                : 'cursor-default'
            }`}
            title={`${starValue} ${type === 'cheese' ? 'quesitos' : 'corazones'}`}
          >
            {isFilled ? iconFilled : iconEmpty}
          </button>
        );
      })}
    </div>
  );
};
