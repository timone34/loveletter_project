import type { ReactNode } from "react";
import "./Field.css";

// Small form controls shared by pages with settings (Play setup now, Simulate later).
// Each is a plain controlled component: pass the value, get the new one in onChange.

type FieldProps = {
  label: string;
  hint?: ReactNode;
  htmlFor?: string; // the id of the input inside, so clicking the label focuses it
  aside?: ReactNode; // shown at the right of the label, e.g. a small button
  children: ReactNode;
};

// A label above a control, with an optional hint below it.
export function Field({ label, hint, htmlFor, aside, children }: FieldProps) {
  return (
    <div className="field">
      <div className="field__top">
        {htmlFor ? (
          <label className="field__label" htmlFor={htmlFor}>{label}</label>
        ) : (
          <span className="field__label">{label}</span>
        )}
        {aside}
      </div>
      {children}
      {hint && <small className="field__hint">{hint}</small>}
    </div>
  );
}

type Option<T> = { value: T; label: string };

// A row of buttons where exactly one is selected (like radio buttons).
export function Segmented<T extends string | number>({
  value, options, onChange, label,
}: { value: T; options: Option<T>[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segmented__option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// − value + for small whole numbers.
export function Stepper({
  value, min, max, onChange, label, children,
}: { value: number; min: number; max: number; onChange: (value: number) => void; label: string; children?: ReactNode }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper__btn" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Fewer">−</button>
      <span className="stepper__value" aria-live="polite">{value}</span>
      <button type="button" className="stepper__btn" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="More">+</button>
      {children && <span className="stepper__extra">{children}</span>}
    </div>
  );
}

// An on/off switch with a text label beside it.
export function Toggle({
  checked, onChange, children,
}: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__track"><span className="toggle__thumb" /></span>
      <span className="toggle__label">{children}</span>
    </button>
  );
}
