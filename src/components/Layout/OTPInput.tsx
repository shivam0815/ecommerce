import React, { useEffect, useRef } from 'react';

interface OTPInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number; // default 6
  disabled?: boolean;
  className?: string;
}

const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled,
  className,
}) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const values = Array.from({ length }, (_, i) => value[i] ?? '');

  const focusIndex = (i: number) => {
    if (i >= 0 && i < length) inputsRef.current[i]?.focus();
  };

  const handleChange = (i: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const next = value.split('');
    next[i] = digit;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    if (i < length - 1) focusIndex(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = value.split('');
      if (next[i]) {
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        focusIndex(i - 1);
        const prev = value.split('');
        prev[i - 1] = '';
        onChange(prev.join(''));
      }
    }
    if (e.key === 'ArrowLeft') focusIndex(i - 1);
    if (e.key === 'ArrowRight') focusIndex(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    focusIndex(Math.min(text.length, length - 1));
  };

  useEffect(() => {
    const firstEmpty = Math.max(0, value.length);
    focusIndex(firstEmpty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-12 h-12 text-center text-lg rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      ))}
    </div>
  );
};

export default OTPInput;
