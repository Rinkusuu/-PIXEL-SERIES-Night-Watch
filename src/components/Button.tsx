import type { ReactNode } from 'react';

export function Button({
  onClick, children, pressed, disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
    >
      {children}
    </button>
  );
}
