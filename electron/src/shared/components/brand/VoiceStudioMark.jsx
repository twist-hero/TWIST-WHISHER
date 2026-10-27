import React from 'react';

/**
 * TWIST WHISPER's compact mark: the same five rounded waveform bars the
 * desktop icon uses, without the tile. App chrome keeps it transparent so it
 * stays crisp at titlebar sizes and adapts to every theme.
 */
export default function VoiceStudioMark({ className = '', title, ...props }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M17.1 29.5V34.5M24.6 24.5V39.5M32 18.6V45.4M39.4 26.4V37.6M46.8 31.1V32.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
