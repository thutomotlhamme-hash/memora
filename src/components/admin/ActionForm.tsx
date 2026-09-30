'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { useToast } from '../Toast';

// One small form for every command-centre change: fields in, a permission-checked
// action out, then the page refreshes with the result. Keeps each screen short.

export type Field =
  | { name: string; label: string; type: 'text' | 'tel' | 'email' | 'date' | 'money'; value?: string; placeholder?: string; required?: boolean; hint?: string }
  | { name: string; label: string; type: 'select'; value?: string; options: { value: string; label: string }[]; hint?: string }
  | { name: string; label: string; type: 'checkbox'; value?: boolean; hint?: string }
  | { name: string; label: string; type: 'multi'; value?: string[]; options: { value: string; label: string; hint?: string; disabled?: boolean }[]; hint?: string };

export function ActionForm({
  action,
  fields,
  submit,
  extra,
  confirm,
  reset = false,
  compact = false,
  variant = 'primary',
  endpoint = '/api/admin/actions',
}: {
  /** Where the action goes: the command centre, or a funeral home's own dashboard. */
  endpoint?: string;
  action: string;
  fields: Field[];
  submit: string;
  extra?: Record<string, unknown>;
  confirm?: string;
  reset?: boolean;
  compact?: boolean;
  variant?: 'primary' | 'accent' | 'danger' | '';
}) {
  const uid = useId();
  const router = useRouter();
  const toast = useToast();
  const initial = () => Object.fromEntries(fields.map((f) => [f.name, f.value ?? (f.type === 'multi' ? [] : f.type === 'checkbox' ? false : '')])) as Record<string, unknown>;
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  return (
    <form
      className={`action-form${compact ? ' compact' : ''}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...extra, ...values }),
        }).catch(() => null);
        const out = res ? await res.json().catch(() => ({})) : { error: 'Couldn’t reach Memora. Check the connection and try again.' };
        setBusy(false);
        const ok = Boolean(res?.ok);
        toast(out?.message || out?.error || (ok ? 'Done.' : 'That didn’t work.'), ok ? 'info' : 'error');
        if (ok) {
          if (reset) setValues(initial());
          router.refresh();
        }
      }}
    >
      {fields.map((f) => {
        const id = `${uid}-${f.name}`;
        if (f.type === 'checkbox')
          return (
            <label key={f.name} className="af-check">
              <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
              <span>{f.label}</span>
            </label>
          );
        if (f.type === 'multi') {
          const chosen = new Set((values[f.name] as string[]) ?? []);
          return (
            <fieldset key={f.name} className="af-multi">
              <legend>{f.label}</legend>
              {f.options.map((o) => (
                <label key={o.value} className={`af-role${chosen.has(o.value) ? ' on' : ''}${o.disabled ? ' disabled' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={o.disabled}
                    checked={chosen.has(o.value)}
                    onChange={(e) => {
                      const next = new Set(chosen);
                      if (e.target.checked) next.add(o.value);
                      else next.delete(o.value);
                      set(f.name, [...next]);
                    }}
                  />
                  <span>
                    <strong>{o.label}</strong>
                    {o.hint && <small>{o.hint}</small>}
                  </span>
                </label>
              ))}
              {f.hint && <span className="hint">{f.hint}</span>}
            </fieldset>
          );
        }
        return (
          <div className="field" key={f.name}>
            <label htmlFor={id}>{f.label}</label>
            {f.type === 'select' ? (
              <select id={id} className="select" value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                className="input"
                type={f.type === 'money' ? 'text' : f.type}
                inputMode={f.type === 'money' ? 'decimal' : f.type === 'tel' ? 'tel' : undefined}
                value={String(values[f.name] ?? '')}
                placeholder={f.type === 'money' ? f.placeholder ?? 'R0' : f.placeholder}
                required={f.required}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
            {f.hint && <span className="hint">{f.hint}</span>}
          </div>
        );
      })}
      <div className="af-actions">
        <button className={`btn ${variant} ${compact ? 'sm' : ''}`} type="submit" disabled={busy}>
          {busy ? 'Saving…' : submit}
        </button>
      </div>
    </form>
  );
}
