import React from 'react';

export type AvatarConfig = {
  skinTone: string;
  hairStyle: string; // 'short', 'long', 'spiky', 'curly', 'bald'
  hairColor: string;
  eyes: string; // 'normal', 'angry', 'tired', 'happy'
  eyeColor: string;
  mouth: string; // 'smile', 'neutral', 'sad', 'smirk'
  clothing: string; // 'tshirt', 'hoodie', 'suit'
  clothingColor: string;
  accessory: string; // 'none', 'glasses', 'sunglasses', 'cap'
};

export const defaultAvatarConfig: AvatarConfig = {
  skinTone: '#fcdcb4',
  hairStyle: 'short',
  hairColor: '#4a3123',
  eyes: 'normal',
  eyeColor: '#3b82f6',
  mouth: 'smile',
  clothing: 'hoodie',
  clothingColor: '#8b5cf6',
  accessory: 'none'
};

interface ModularAvatarProps {
  config: AvatarConfig;
  className?: string;
}

export function ModularAvatar({ config, className = "w-full h-full" }: ModularAvatarProps) {
  return (
    <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Background/Backdrop */}
      <circle cx="200" cy="200" r="190" fill="transparent" />

      {/* CLOTHING (Back layer) */}
      {config.clothing === 'hoodie' && (
        <path d="M100 400 C100 280, 300 280, 300 400 Z" fill={config.clothingColor} />
      )}
      {config.clothing === 'tshirt' && (
        <path d="M120 400 C120 300, 280 300, 280 400 Z" fill={config.clothingColor} />
      )}
      {config.clothing === 'suit' && (
        <g>
          <path d="M100 400 C100 280, 300 280, 300 400 Z" fill="#1f2937" />
          <path d="M170 300 L200 400 L230 300 Z" fill="#f3f4f6" />
          <path d="M200 320 L190 350 L210 350 Z" fill="#dc2626" />
        </g>
      )}

      {/* NECK & HEAD */}
      <rect x="175" y="240" width="50" height="60" fill={config.skinTone} rx="10" />
      <path d="M175 280 Q200 300 225 280 L225 300 L175 300 Z" fill="rgba(0,0,0,0.1)" /> {/* Neck shadow */}
      <rect x="120" y="90" width="160" height="180" rx="70" fill={config.skinTone} />

      {/* EYES */}
      <g>
        {/* Whites */}
        <circle cx="160" cy="180" r="15" fill="white" />
        <circle cx="240" cy="180" r="15" fill="white" />
        
        {/* Irises */}
        <circle cx="160" cy="180" r="7" fill={config.eyeColor} />
        <circle cx="240" cy="180" r="7" fill={config.eyeColor} />
        
        {/* Pupils */}
        <circle cx="160" cy="180" r="3" fill="black" />
        <circle cx="240" cy="180" r="3" fill="black" />

        {/* Expressions / Eyebrows */}
        {config.eyes === 'angry' && (
          <g stroke="black" strokeWidth="4" strokeLinecap="round">
            <line x1="140" y1="155" x2="175" y2="165" />
            <line x1="260" y1="155" x2="225" y2="165" />
          </g>
        )}
        {config.eyes === 'normal' && (
          <g stroke="black" strokeWidth="4" strokeLinecap="round">
            <path d="M140 160 Q160 150 180 160" fill="transparent" />
            <path d="M220 160 Q240 150 260 160" fill="transparent" />
          </g>
        )}
        {config.eyes === 'sad' && (
          <g stroke="black" strokeWidth="4" strokeLinecap="round">
            <line x1="140" y1="165" x2="175" y2="155" />
            <line x1="260" y1="165" x2="225" y2="155" />
          </g>
        )}
      </g>

      {/* MOUTH */}
      {config.mouth === 'smile' && (
        <path d="M170 230 Q200 250 230 230" stroke="black" strokeWidth="4" fill="transparent" strokeLinecap="round" />
      )}
      {config.mouth === 'neutral' && (
        <line x1="180" y1="240" x2="220" y2="240" stroke="black" strokeWidth="4" strokeLinecap="round" />
      )}
      {config.mouth === 'sad' && (
        <path d="M170 245 Q200 230 230 245" stroke="black" strokeWidth="4" fill="transparent" strokeLinecap="round" />
      )}
      {config.mouth === 'smirk' && (
        <path d="M170 240 Q200 245 230 230" stroke="black" strokeWidth="4" fill="transparent" strokeLinecap="round" />
      )}

      {/* HAIR */}
      {config.hairStyle === 'short' && (
        <path d="M110 140 C110 50, 290 50, 290 140 C280 100, 120 100, 110 140 Z" fill={config.hairColor} />
      )}
      {config.hairStyle === 'spiky' && (
        <path d="M110 120 L130 50 L160 90 L200 30 L240 90 L270 50 L290 120 Q200 130 110 120 Z" fill={config.hairColor} />
      )}
      {config.hairStyle === 'curly' && (
        <path d="M100 130 A30 30 0 1 1 130 80 A40 40 0 1 1 200 60 A40 40 0 1 1 270 80 A30 30 0 1 1 300 130 Q200 110 100 130 Z" fill={config.hairColor} />
      )}
      {config.hairStyle === 'long' && (
        <path d="M120 80 C80 150, 80 250, 140 280 C120 200, 120 100, 200 80 C280 100, 280 200, 260 280 C320 250, 320 150, 280 80 Z" fill={config.hairColor} />
      )}

      {/* ACCESSORIES */}
      {config.accessory === 'glasses' && (
        <g stroke="black" strokeWidth="6" fill="transparent">
          <rect x="135" y="160" width="50" height="40" rx="10" />
          <rect x="215" y="160" width="50" height="40" rx="10" />
          <line x1="185" y1="180" x2="215" y2="180" />
          <line x1="120" y1="180" x2="135" y2="180" />
          <line x1="265" y1="180" x2="280" y2="180" />
        </g>
      )}
      {config.accessory === 'sunglasses' && (
        <g stroke="#111" strokeWidth="6" fill="#222">
          <rect x="135" y="160" width="50" height="40" rx="10" />
          <rect x="215" y="160" width="50" height="40" rx="10" />
          <line x1="185" y1="180" x2="215" y2="180" />
          <line x1="120" y1="180" x2="135" y2="180" />
          <line x1="265" y1="180" x2="280" y2="180" />
          <polygon points="140,165 155,165 140,185" fill="rgba(255,255,255,0.3)" />
          <polygon points="220,165 235,165 220,185" fill="rgba(255,255,255,0.3)" />
        </g>
      )}
      {config.accessory === 'cap' && (
        <g>
          <path d="M110 110 C110 40, 290 40, 290 110 Z" fill="#ef4444" />
          <rect x="90" y="100" width="180" height="15" rx="5" fill="#dc2626" />
        </g>
      )}
    </svg>
  );
}
