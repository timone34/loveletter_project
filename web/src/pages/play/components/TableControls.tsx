import type { ReactNode } from "react";
import {
  BookOpen, Eye, EyeOff, Maximize2, Minimize2, Pause, Play, Rabbit, RotateCcw, Settings2, Snail, Turtle,
} from "lucide-react";
import type { Speed } from "../config";
import type { GameStatus } from "../useGame";
import "./TableControls.css";

type Props = {
  status: GameStatus;
  speed: Speed;
  fullscreen: boolean;
  cheatSheet: boolean;
  onNewGame: () => void;
  onSettings: () => void;
  onPause: () => void;
  onReveal: () => void;
  onSpeed: (speed: Speed) => void;
  onCheatSheet: () => void;
  onFullscreen: () => void;
};

const SPEEDS: { value: Speed; label: string; icon: ReactNode }[] = [
  { value: "slow", label: "Slow", icon: <Snail /> },
  { value: "normal", label: "Normal", icon: <Turtle /> },
  { value: "fast", label: "Fast", icon: <Rabbit /> },
];

// The row of buttons above the table. Icons are lucide-react components
// (https://lucide.dev/icons): import one by name and it renders as an inline
// SVG in the current text colour. The keyboard shortcuts are handled in Play.tsx.
export function TableControls(props: Props) {
  const { status } = props;

  return (
    <div className="controls" role="toolbar" aria-label="Table controls">
      <button type="button" className="btn btn--primary btn--icon-text" onClick={props.onNewGame} disabled={!status.connected}>
        <RotateCcw aria-hidden="true" /> New game
      </button>

      <div className="controls__group" role="radiogroup" aria-label="Speed">
        {SPEEDS.map((s) => (
          <IconButton
            key={s.value}
            label={`${s.label} speed`}
            pressed={props.speed === s.value}
            onClick={() => props.onSpeed(s.value)}
            role="radio"
          >
            {s.icon}
          </IconButton>
        ))}
      </div>

      <IconButton
        label={status.paused ? "Resume (Space)" : "Pause (Space)"}
        onClick={props.onPause}
        disabled={!status.connected || !status.running}
      >
        {status.paused ? <Play /> : <Pause />}
      </IconButton>

      <IconButton label="Reveal hands (R)" pressed={status.reveal} onClick={props.onReveal} disabled={!status.connected}>
        {status.reveal ? <Eye /> : <EyeOff />}
      </IconButton>

      <IconButton label="Cheat sheet (C)" pressed={props.cheatSheet} onClick={props.onCheatSheet}>
        <BookOpen />
      </IconButton>

      <IconButton label={props.fullscreen ? "Exit full screen (F)" : "Full screen (F)"} onClick={props.onFullscreen}>
        {props.fullscreen ? <Minimize2 /> : <Maximize2 />}
      </IconButton>

      <IconButton label="Table settings" onClick={props.onSettings}>
        <Settings2 />
      </IconButton>
    </div>
  );
}

type IconButtonProps = {
  label: string; // the tooltip, and what a screen reader says
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean; // a toggle: filled while on
  disabled?: boolean;
  role?: "radio";
};

function IconButton({ label, onClick, children, pressed, disabled, role }: IconButtonProps) {
  return (
    <button
      type="button"
      className="btn btn--icon"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      role={role}
      aria-pressed={role ? undefined : pressed}
      aria-checked={role ? pressed : undefined}
      data-on={pressed || undefined}
    >
      {children}
    </button>
  );
}
