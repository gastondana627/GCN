import React, { useState, useEffect } from 'react';

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  priority?: boolean;
}

export const Image: React.FC<ImageProps> = ({ src, alt, className, priority, onError, ...props }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) onError(e);
  };

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950/80 border-2 border-dashed border-orange-500/30 rounded-xl p-6 text-center shadow-[0_0_15px_rgba(255,85,0,0.05)]">
        <div className="text-orange-500 font-mono text-xs uppercase mb-3 tracking-wider font-bold animate-pulse">
          [ Awaiting Asset ]
        </div>
        <div className="text-[10px] text-zinc-500 font-mono leading-relaxed max-w-[180px]">
          Place cropped PNG sprite at:<br/>
          <span className="text-orange-400 font-bold block mt-1 break-all select-all p-1 bg-black/40 rounded border border-zinc-800">{src}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      onError={handleError}
      {...props}
    />
  );
};

export default Image;
