import React from 'react';

export type PixelAvatarConfig = {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyes: string;
  eyeColor: string;
  top: string;
  topColor: string;
  pants: string;
  pantsColor: string;
  shoesColor: string;
  accessory: string;
};

export const defaultPixelAvatarConfig: PixelAvatarConfig = {
  skinTone: '#fce2c4',
  hairStyle: 'hero',
  hairColor: '#4a2c11',
  eyes: 'normal',
  eyeColor: '#2563eb',
  top: 'jacket',
  topColor: '#ef4444',
  pants: 'jeans',
  pantsColor: '#1e3a8a',
  shoesColor: '#111827',
  accessory: 'none'
};

interface PixelAvatarProps {
  config: PixelAvatarConfig;
  className?: string;
}

export function PixelAvatar({ config = defaultPixelAvatarConfig, className = "" }: PixelAvatarProps) {
  const { skinTone, hairStyle, hairColor, eyeColor, top, topColor, pantsColor, shoesColor, accessory } = config;

  // Renderiza un bloque de píxeles desde un array de strings (matriz)
  const renderSprite = (sprite: string[], colorMap: Record<string, string>, offsetX = 0, offsetY = 0) => {
    const rects: React.JSX.Element[] = [];
    sprite.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        if (char !== ' ' && colorMap[char]) {
          rects.push(
            <rect key={`${x}-${y}-${char}`} x={x + offsetX} y={y + offsetY} width="1" height="1" fill={colorMap[char]} shapeRendering="crispEdges" />
          );
        }
      }
    });
    return rects;
  };

  // --- PALETAS DE COLOR ---
  const skinMap: Record<string, any> = {
    '#fce2c4': { 'S': '#fce2c4', 'D': '#eab992', 'O': '#6b472e' },
    '#eab992': { 'S': '#eab992', 'D': '#c99468', 'O': '#543621' },
    '#c99468': { 'S': '#c99468', 'D': '#9a6a43', 'O': '#3f2512' },
    '#8b5a2b': { 'S': '#8b5a2b', 'D': '#663f19', 'O': '#241407' },
    '#5c3a21': { 'S': '#5c3a21', 'D': '#3c2412', 'O': '#150a04' },
  };
  const skin = skinMap[skinTone] || { 'S': skinTone, 'D': skinTone, 'O': '#000000' };

  // Helper para generar tonos de color oscuro/claro basados en el principal
  const hairMap: Record<string, string> = {
    'H': hairColor, 
    'L': hairColor, 
    'D': '#111111', // Outline
    'O': '#333333'
  };

  const clothesMap: Record<string, string> = {
    'C': topColor,
    'D': '#333333', // Outline top
    'P': pantsColor, 
    'S': shoesColor,
  };

  // --- SPRITES (Stardew Style 16x32 proporciones) ---
  const baseBody = [
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "     OOOOO      ",
    "    OSSSSSO     ",
    "   OSSSSSSSO    ",
    "   OSSSSSSSO    ",
    "   OSSSSSSSO    ",
    "   OOSSSSSOO    ",
    "    OOSSSOO     ",
    "     ODDDO      ", // Cuello
    "    OCCCCCO     ", // Hombros
    "   OCCCCCCCCO   ",
    "  OCCCCCCCCDCO  ",
    "  OSDCCCCCCDSO  ",
    "  OS C C C  SO  ",
    "  OO C C C  OO  ",
    "     PPPPP      ",
    "    OPPPPPO     ",
    "    OPPPPPO     ",
    "    OP P PO     ",
    "    OP P PO     ",
    "    OS S SO     ",
    "    OS S SO     ",
    "   OOS SOOO     ",
    "                ",
    "                ",
  ];

  const renderEyes = () => {
    return (
      <g>
        {/* Whites */}
        <rect x="5" y="11" width="2" height="2" fill="#FFFFFF" shapeRendering="crispEdges"/>
        <rect x="9" y="11" width="2" height="2" fill="#FFFFFF" shapeRendering="crispEdges"/>
        {/* Iris */}
        <rect x="6" y="11" width="1" height="2" fill={eyeColor} shapeRendering="crispEdges"/>
        <rect x="9" y="11" width="1" height="2" fill={eyeColor} shapeRendering="crispEdges"/>
      </g>
    );
  };

  const hairstyles: Record<string, string[]> = {
    'hero': [
      "                ",
      "                ",
      "      DDDD      ",
      "     DHHHHH     ",
      "    DHHHHHHD    ",
      "   DHHHHHHHHD   ",
      "   DHHHHHHHHD   ",
      "  DDHHHHHHHHDD  ",
      "  DDHHHHHHHHDD  ",
      "    D HHHH D    ",
      "    D  HH  D    ",
      "                ",
    ],
    'messy': [
      "                ",
      "      DDDD      ",
      "     DHHHHHD    ",
      "    DHHHHHHHD   ",
      "   DHHHHHHHHHD  ",
      "  DHHHHHHHHHHHD ",
      "  DHHHHHHHHHHHD ",
      "  DHHHHHHHHHHHD ",
      "   DD HHHH  DD  ",
      "      DD DD     ",
      "                ",
    ],
    'bob': [
      "                ",
      "      DDDD      ",
      "     DHHHHHD    ",
      "    DHHHHHHHD   ",
      "   DHHHHHHHHHD  ",
      "   DHHHHHHHHHD  ",
      "  DDHH DD HHDD  ",
      "  DHHH    HHHD  ",
      "  DHHH    HHHD  ",
      "  DHHH    HHHD  ",
      "  DHDD    DHDD  ",
      "  DDD      DDD  ",
    ]
  };

  const hair = hairstyles[hairStyle] || hairstyles['hero'];

  return (
    <svg viewBox="0 0 16 32" className={className} style={{ imageRendering: 'pixelated' }} xmlns="http://www.w3.org/2000/svg">
      {/* Cuerpo Base */}
      {renderSprite(baseBody, { 'S': skin['S'], 'D': skin['D'], 'O': skin['O'], 'C': clothesMap['C'], 'P': clothesMap['P'] })}
      
      {/* Ojos */}
      {renderEyes()}
      
      {/* Cabello */}
      {renderSprite(hair, { 'H': hairMap['H'], 'L': hairMap['L'], 'D': hairMap['D'] })}
      
      {/* Accesorios - Opcional */}
      {accessory === 'glasses' && (
        <g fill="#333" shapeRendering="crispEdges">
          <rect x="4" y="11" width="4" height="3" fillOpacity="0.3" stroke="#111" strokeWidth="0.5" />
          <rect x="8" y="11" width="4" height="3" fillOpacity="0.3" stroke="#111" strokeWidth="0.5" />
          <rect x="7" y="12" width="2" height="0.5" fill="#111" />
        </g>
      )}
      {accessory === 'cap' && (
        <g shapeRendering="crispEdges">
          <rect x="4" y="6" width="8" height="2" fill={topColor} />
          <rect x="3" y="7" width="11" height="1" fill={topColor} />
        </g>
      )}
    </svg>
  );
}
