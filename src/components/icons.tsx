/**
 * FIX50 icon-set — strakke line-iconen (24×24 grid, 1.8px stroke, ronde uiteinden).
 * Eén consistente stijl over de hele app, geen emojis. Kleur default: tekstkleur.
 */
import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function Base({
  size = 20,
  color = colors.text,
  strokeWidth = 1.8,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

// ── Navigatie ────────────────────────────────────────────────
export function HomeIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 11 12 4l8 7" />
      <Path d="M6 9.5V20h12V9.5" />
      <Path d="M10 20v-5h4v5" />
    </Base>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <Path d="M8 10h.01" />
      <Path d="M12 10h.01" />
      <Path d="M16 10h.01" />
    </Base>
  );
}

export function WrenchIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Base>
  );
}

export function SlidersIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M21 4h-7" />
      <Path d="M10 4H3" />
      <Path d="M21 12h-9" />
      <Path d="M8 12H3" />
      <Path d="M21 20h-5" />
      <Path d="M12 20H3" />
      <Path d="M14 2v4" />
      <Path d="M8 10v4" />
      <Path d="M16 18v4" />
    </Base>
  );
}

export function GaugeIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="m12 14 4-4" />
      <Path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </Base>
  );
}

export function MotoIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="5.5" cy="17" r="2.5" />
      <Circle cx="18.5" cy="17" r="2.5" />
      <Path d="M5.5 17h7l2-4.5" />
      <Path d="M14.5 12.5h2.3L18.5 17" />
      <Path d="M16.8 12.5 15.6 6h-2.6" />
    </Base>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Base>
  );
}

// ── Inhoud ───────────────────────────────────────────────────
export function ClipboardIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x="8" y="2" width="8" height="4" rx="1" />
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Path d="M9.5 8H12" />
      <Path d="M9.5 12H15" />
      <Path d="M9.5 16H15" />
    </Base>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Base>
  );
}

export function ScaleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <Path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <Path d="M7 21h10" />
      <Path d="M12 3v18" />
      <Path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </Base>
  );
}

export function TimerIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Line x1="10" y1="2" x2="14" y2="2" />
      <Line x1="12" y1="14" x2="15" y2="11" />
      <Circle cx="12" cy="14" r="8" />
    </Base>
  );
}

export function TrendingUpIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <Path d="M16 7h6v6" />
    </Base>
  );
}

export function DropletIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </Base>
  );
}

// ── Acties ───────────────────────────────────────────────────
export function PlusIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Base>
  );
}

export function SendIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="m22 2-7 20-4-9-9-4Z" />
      <Path d="M22 2 11 13" />
    </Base>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M20 6 9 17l-5-5" />
    </Base>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="m9 18 6-6-6-6" />
    </Base>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 12h14" />
      <Path d="m12 5 7 7-7 7" />
    </Base>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M18 6 6 18" />
      <Path d="m6 6 12 12" />
    </Base>
  );
}

// ── Status ───────────────────────────────────────────────────
export function WarningIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </Base>
  );
}

export function AlertCircleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 8v4" />
      <Path d="M12 16h.01" />
    </Base>
  );
}

export function CameraIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 8.5A2 2 0 0 1 6 6.5h1.6l1.2-2h6.4l1.2 2H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <Circle cx={12} cy={13.2} r={3.4} />
    </Base>
  );
}

export function ImageIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x={3.5} y={4.5} width={17} height={15} rx={2} />
      <Circle cx={9} cy={9.5} r={1.6} />
      <Path d="M4.5 17.5 9.8 12.6l3.1 3 2.7-2.6 4 4.2" />
    </Base>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4.5 6.5h15" />
      <Path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <Path d="M6.5 6.5 7.4 20h9.2l.9-13.5" />
      <Path d="M10 10.5v6" />
      <Path d="M14 10.5v6" />
    </Base>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <Circle cx="12" cy="12" r="3" />
    </Base>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x="3" y="11" width="18" height="10" rx="2" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Base>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Base>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Path d="M3 10h18" />
    </Base>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <Line x1="4" y1="22" x2="4" y2="15" />
    </Base>
  );
}
