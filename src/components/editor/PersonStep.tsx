'use client';

import { capitaliseName, type Draft, type Person } from '@/lib/memorial';
import { PanelFoot, type Nav, type Update } from './shared';
import { QuickPicks, recentDays } from './QuickPicks';

export function PersonStep({
  draft,
  update,
  onPortrait,
  portraitBusy,
  nav,
}: {
  draft: Draft;
  update: Update;
  onPortrait: (file: File) => void;
  portraitBusy: boolean;
  nav: Nav;
}) {
  const p = draft.person;
  const set = (key: keyof Person, value: string) => update((d) => ({ ...d, person: { ...d.person, [key]: value } }));
  const tidy = (key: keyof Person) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = capitaliseName(e.target.value.trim());
    if (v !== e.target.value) set(key, v);
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="panel">
      <header className="panel-head">
        <span className="eyebrow">Step 1 · Loved one</span>
        <h1 className="h1">Tell us about them.</h1>
        <p className="lede">Start with what you know. You can leave anything unfinished and come back while the family gathers the rest.</p>
      </header>

      <div className="field">
        <span className="label">Portrait</span>
        <div className="portrait-picker">
          <div className="portrait-frame">{p.portraitUrl ? <img src={p.portraitUrl} alt="Portrait preview" /> : <span>No photo yet</span>}</div>
          <div className="stack" style={{ ['--stack' as string]: '10px' }}>
            <label className="btn file-btn" aria-busy={portraitBusy}>
              {portraitBusy ? 'Preparing photo…' : p.portraitUrl ? 'Replace photo' : 'Choose a photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={portraitBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onPortrait(file);
                }}
              />
            </label>
            <p className="hint small muted" style={{ margin: 0, maxWidth: 360 }}>
              A clear, portrait-shaped photo works best. JPG, PNG or WebP. Photos are resized on your device and kept private until you publish.
            </p>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 28 }}>
        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input className="input" id="firstName" value={p.firstName} onChange={(e) => set('firstName', e.target.value)} onBlur={tidy('firstName')} autoComplete="off" autoCapitalize="words" />
        </div>
        <div className="field">
          <label htmlFor="lastName">Surname</label>
          <input className="input" id="lastName" value={p.lastName} onChange={(e) => set('lastName', e.target.value)} onBlur={tidy('lastName')} autoComplete="off" autoCapitalize="words" />
        </div>
        <div className="field span-2">
          <label htmlFor="preferredName">The name they were known by</label>
          <input
            className="input"
            id="preferredName"
            value={p.preferredName}
            onChange={(e) => set('preferredName', e.target.value)}
            onBlur={tidy('preferredName')}
            placeholder="Optional, e.g. Mama Naledi or Uncle Jo"
            autoCapitalize="words"
          />
          <span className="hint">Used as the headline name on the memorial. Leave empty to use their first name.</span>
        </div>
        <div className="field">
          <label htmlFor="birthDate">Date of birth</label>
          <input className="input" id="birthDate" type="date" max={p.passingDate || today} value={p.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="passingDate">Date of passing</label>
          <input className="input" id="passingDate" type="date" min={p.birthDate || undefined} max={today} value={p.passingDate} onChange={(e) => set('passingDate', e.target.value)} />
          <QuickPicks label="Recent days" picks={recentDays} value={p.passingDate} onPick={(v) => set('passingDate', v)} />
        </div>
      </div>

      <PanelFoot nav={nav} />
    </div>
  );
}
