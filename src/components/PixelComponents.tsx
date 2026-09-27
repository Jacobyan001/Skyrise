import React from 'react';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export const PixelButton: React.FC<PixelButtonProps> = ({ children, className = '', variant = 'primary', ...props }) => {
  const bgColors = {
    primary: 'bg-pixel-primary hover:bg-blue-400',
    secondary: 'bg-white hover:bg-gray-100',
    danger: 'bg-pixel-danger hover:bg-red-400',
    success: 'bg-pixel-success hover:bg-green-400',
  };

  const textColors = {
    primary: 'text-white',
    secondary: 'text-black',
    danger: 'text-white',
    success: 'text-white',
  };

  return (
    <button
      className={`
        ${bgColors[variant]}
        ${textColors[variant]}
        font-pixel text-xl uppercase tracking-widest
        border-4 border-black
        shadow-pixel active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
        px-6 py-3 transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export const PixelCard: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-white border-4 border-black shadow-pixel p-4 ${className}`}>
      {title && (
        <h3 className="font-pixel text-2xl mb-4 border-b-4 border-black pb-2 uppercase tracking-wide bg-yellow-100 -mx-4 -mt-4 p-4">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};
