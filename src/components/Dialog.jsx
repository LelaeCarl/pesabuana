import { useEffect, useRef } from 'react';

export function Dialog({ titleId, onDismiss, children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.open) return undefined;
    el.showModal();
    const preferred = el.querySelector('[autofocus]');
    if (preferred instanceof HTMLElement) preferred.focus();
    return () => {
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
