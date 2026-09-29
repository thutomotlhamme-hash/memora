// Product "renders" for the landing page, drawn in HTML and SVG so they stay
// crisp at any size and need no photography. Decorative: hidden from screen readers.

function Portrait({ className = '' }: { className?: string }) {
  return <div className={`v-portrait ${className}`} />;
}

/** A phone showing a published memorial on the funeral day. */
export function PhoneMemorial({ className = '' }: { className?: string }) {
  return (
    <div className={`v-phone ${className}`} aria-hidden="true">
      <div className="v-screen">
        <div className="v-status">
          <span>9:41</span>
          <span className="v-island" />
          <span>●●●</span>
        </div>
        <div className="v-mem">
          <Portrait className="v-mem-portrait" />
          <div className="v-kicker">In loving memory</div>
          <div className="v-name">Naledi Mokoena</div>
          <div className="v-dates">1958 — 2026</div>
          <div className="v-live">
            <div className="v-live-k">
              <span className="v-dot" /> Happening now
            </div>
            <div className="v-live-t">Celebration service</div>
            <div className="v-live-s">10:00 · Main entrance</div>
            <div className="v-live-row">
              <span>Google Maps</span>
              <span>Waze</span>
            </div>
          </div>
          <div className="v-next">
            <span>Next · 12:30</span>
            <strong>Burial, East gate</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The printable QR card guests scan at the door. */
export function QrCard({ className = '' }: { className?: string }) {
  const cells = Array.from({ length: 121 }, (_, i) => {
    const x = i % 11;
    const y = Math.floor(i / 11);
    const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return finder || (x * 7 + y * 13 + x * y) % 5 < 2;
  });
  return (
    <div className={`v-card v-qr ${className}`} aria-hidden="true">
      <div className="v-kicker">Scan for directions</div>
      <div className="v-qr-grid">
        {cells.map((on, i) => (
          <span key={i} className={on ? 'on' : ''} />
        ))}
      </div>
      <div className="v-qr-name">Naledi Mokoena</div>
      <div className="v-qr-sub">memora · funeral details</div>
    </div>
  );
}

/** A slice of the printed order of service. */
export function ProgrammeSheet({ className = '' }: { className?: string }) {
  const items = [
    ['10:00', 'Opening prayer', 'Pastor Mokoena'],
    ['10:10', 'Psalm 23', 'Lerato Mokoena'],
    ['10:20', 'Amazing Grace', 'Congregation'],
    ['10:30', 'Family tributes', 'Family & friends'],
    ['11:00', 'Eulogy', 'Thabo Mokoena'],
  ];
  return (
    <div className={`v-card v-prog ${className}`} aria-hidden="true">
      <div className="v-kicker">Order of service</div>
      <div className="v-prog-title">Celebrating Naledi</div>
      {items.map(([t, title, who]) => (
        <div key={t} className="v-prog-row">
          <span>{t}</span>
          <div>
            <strong>{title}</strong>
            <em>{who}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pins on a quiet map, joined by the route. */
export function MapVisual() {
  return (
    <div className="v-map" aria-hidden="true">
      <svg viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice">
        <rect width="600" height="380" fill="#eef0f3" />
        <g stroke="#ffffff" strokeWidth="10" fill="none" strokeLinecap="round">
          <path d="M-20 300 C 120 280, 180 200, 300 210 S 520 120, 640 90" />
          <path d="M80 -20 C 110 120, 60 240, 140 400" />
          <path d="M420 -20 C 400 100, 470 220, 430 400" />
          <path d="M-20 120 C 160 140, 260 90, 640 150" />
        </g>
        <g fill="#dfe6da">
          <circle cx="520" cy="300" r="70" />
          <circle cx="240" cy="60" r="44" />
        </g>
        <path d="M120 290 C 200 250, 250 215, 320 205 S 440 170, 492 132" stroke="#0071e3" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="1 11" />
        <g>
          <circle cx="120" cy="290" r="12" fill="#1d1d1f" />
          <circle cx="120" cy="290" r="5" fill="#fff" />
          <circle cx="320" cy="205" r="12" fill="#1d1d1f" />
          <circle cx="320" cy="205" r="5" fill="#fff" />
          <path d="M492 132 m-15 0 a15 15 0 1 1 30 0 c0 14-15 26-15 26 s-15-12-15-26Z" fill="#0071e3" />
          <circle cx="492" cy="132" r="5.5" fill="#fff" />
        </g>
      </svg>
      <div className="v-map-chip" style={{ left: '14%', top: '80%' }}>
        Home · 08:00
      </div>
      <div className="v-map-chip" style={{ left: '48%', top: '64%' }}>
        Church · 10:00
      </div>
      <div className="v-map-chip on" style={{ left: '70%', top: '22%' }}>
        East gate · 12:30
      </div>
    </div>
  );
}

/** "Now & next" on the day. */
export function LiveVisual() {
  return (
    <div className="v-livecard" aria-hidden="true">
      <div className="v-live-k">
        <span className="v-dot" /> Live
      </div>
      <div className="v-live-h">Happening now.</div>
      <div className="v-live-grid">
        <div className="now">
          <span>Now</span>
          <strong>Celebration service</strong>
          <em>10:00 · Family church</em>
        </div>
        <div>
          <span>Next</span>
          <strong>Burial</strong>
          <em>12:30 · East gate</em>
        </div>
      </div>
      <div className="v-live-prog">
        <span>In the service</span>
        <strong>Family tributes</strong>
      </div>
    </div>
  );
}

/** The procession, following the road to the cemetery. */
export function ProcessionVisual() {
  return (
    <div className="v-proc" aria-hidden="true">
      <svg viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice">
        <rect width="600" height="380" fill="#eef0f3" />
        <g stroke="#ffffff" strokeWidth="12" fill="none" strokeLinecap="round">
          <path d="M-20 320 C 140 300, 220 220, 330 230 S 520 120, 640 110" />
          <path d="M200 -20 C 230 140, 170 260, 250 400" />
        </g>
        <path d="M60 314 C 140 300, 220 222, 330 230 S 460 150, 520 124" stroke="#0071e3" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.25" />
        <path className="v-proc-path" d="M60 314 C 140 300, 220 222, 330 230" stroke="#0071e3" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M520 124 m-15 0 a15 15 0 1 1 30 0 c0 14-15 26-15 26 s-15-12-15-26Z" fill="#1d1d1f" />
        <circle cx="520" cy="124" r="5.5" fill="#fff" />
        <circle className="v-proc-halo" cx="330" cy="230" r="22" fill="#0071e3" opacity="0.18" />
        <circle cx="330" cy="230" r="10" fill="#0071e3" stroke="#fff" strokeWidth="4" />
      </svg>
      <div className="v-proc-eta">
        <span>Estimated arrival</span>
        <strong>About 10–15 min</strong>
      </div>
    </div>
  );
}

/** The coordinator's run-sheet, mid-service. */
export function RunSheetVisual({ className = '' }: { className?: string }) {
  const rows: [string, string, string][] = [
    ['10:00', 'Opening prayer', 'done'],
    ['10:12', 'Psalm 23', 'done'],
    ['10:24', 'Family tributes', 'now'],
    ['10:54', 'Amazing Grace', 'next'],
    ['11:04', 'Eulogy', ''],
  ];
  return (
    <div className={`v-phone ${className}`} aria-hidden="true">
      <div className="v-screen v-run">
        <div className="v-status">
          <span>10:31</span>
          <span className="v-island" />
          <span>●●●</span>
        </div>
        <div className="v-run-head">
          <span>Run-sheet</span>
          <strong>Naledi Mokoena</strong>
        </div>
        <div className="v-run-now">
          <span>Happening now</span>
          <strong>Family tributes</strong>
          <em>Next: Amazing Grace</em>
        </div>
        <div className="v-run-late">
          <span>Running late?</span>
          <div>
            <b>+5</b>
            <b>+10</b>
            <b>+15</b>
          </div>
        </div>
        {rows.map(([t, title, state]) => (
          <div key={title} className={`v-run-row ${state}`}>
            <i>⠿</i>
            <span>{t}</span>
            <strong>{title}</strong>
            {state === 'now' && <em>Now</em>}
            {state === 'next' && <em className="n">Next</em>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Cards the family shares on WhatsApp. */
export function KeepsakeStack() {
  return (
    <div className="v-stack" aria-hidden="true">
      <div className="v-card v-keep dark">
        <Portrait className="v-keep-portrait" />
        <div className="v-keep-copy">
          <div className="v-kicker">In loving memory</div>
          <div className="v-keep-name">Naledi Mokoena</div>
          <div className="v-keep-sub">Service · Saturday 10:00</div>
        </div>
      </div>
      <QrCard className="v-stack-qr" />
    </div>
  );
}
