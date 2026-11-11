import { Database, Keyboard, Palette, Rocket } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../lib/errors';
import { shortHash, timeAgo } from '../lib/format';
import { useLoadSample, useSources } from '../lib/hooks';
import { applyReducedMotion, applyTheme, getReducedMotion, getTheme, type ThemeChoice } from '../lib/theme';
import { Badge, Button, Card, CardHead, ErrorState, Notice, PageHead, Skeleton } from '../ui/primitives';
import { useToast } from '../ui/Toast';

const SOURCE_NAMES: Record<string, { name: string; text: string }> = {
  osv: { name: 'OSV', text: 'Open-source vulnerability database' },
  nvd: { name: 'NVD', text: 'US National Vulnerability Database' },
  epss: { name: 'EPSS', text: 'Exploit likelihood scores' },
  kev: { name: 'CISA KEV', text: 'Vulnerabilities attackers are known to exploit' },
};

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl / ⌘ + K', 'Open quick jump'],
  ['Esc', 'Close a panel or menu'],
  ['Tab', 'Move to the next control'],
  ['Enter', 'Open the focused row or press the focused button'],
];

export default function SettingsPage() {
  const toast = useToast();
  const sources = useSources();
  const loadSample = useLoadSample();
  const [theme, setTheme] = useState<ThemeChoice>(getTheme());
  const [reduced, setReduced] = useState(getReducedMotion());

  const chooseTheme = (choice: ThemeChoice) => {
    applyTheme(choice);
    setTheme(choice);
  };

  return (
    <>
      <PageHead
        title="Settings"
        lead="Where the evidence comes from, how the app looks and the shortcuts that save time."
      />

      <Card>
        <CardHead
          title="Data sources"
          hint="PatchGraph scores risk using these four public sources. The demo ships a fixed snapshot so results are repeatable."
          action={
            sources.data?.offline_demo_mode ? <Badge tone="done">Offline demo mode</Badge> : <Badge>Live sources</Badge>
          }
        />
        {sources.isLoading ? (
          <div className="grid grid-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={96} radius={14} />
            ))}
          </div>
        ) : sources.isError ? (
          <ErrorState message={errorMessage(sources.error)} onRetry={() => sources.refetch()} />
        ) : (
          <>
            <div className="grid grid-2" data-testid="sources">
              {Object.entries(sources.data?.sources ?? {}).map(([key, s]) => (
                <div key={key} className="source">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <strong>{SOURCE_NAMES[key]?.name ?? key.toUpperCase()}</strong>
                      <span className="cell-sub">{SOURCE_NAMES[key]?.text}</span>
                    </div>
                    <Badge tone={s.stale ? 'alert' : 'done'}>{s.stale ? 'Out of date' : 'Up to date'}</Badge>
                  </div>
                  <span className="cell-sub">
                    Fetched {timeAgo(s.last_sync)} · fingerprint{' '}
                    <span className="mono">{shortHash(s.content_sha256, 12)}</span>
                  </span>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--text-3)', marginTop: 12, fontSize: '0.84rem' }}>
              Snapshot <span className="mono">{sources.data?.snapshot_id}</span> · manifest{' '}
              <span className="mono">{shortHash(sources.data?.snapshot_sha256, 16)}</span>
            </p>
          </>
        )}
      </Card>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title="Appearance"
            hint="Both themes use the same five brand colours."
            action={<Palette size={20} aria-hidden="true" />}
          />
          <div className="stack">
            <div className="field">
              <span className="field-label" id="theme-label">
                Theme
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
                {(
                  [
                    ['silver', 'Silver (light)'],
                    ['ink', 'Ink (dark)'],
                    ['system', 'Match my device'],
                  ] as Array<[ThemeChoice, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={theme === value}
                    onClick={() => chooseTheme(value)}
                    data-testid={`theme-${value}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field-label" id="motion-label">
                Motion
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="motion-label">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!reduced}
                  onClick={() => {
                    applyReducedMotion(false);
                    setReduced(false);
                  }}
                >
                  Normal
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={reduced}
                  onClick={() => {
                    applyReducedMotion(true);
                    setReduced(true);
                  }}
                  data-testid="motion-reduced"
                >
                  Reduced
                </button>
              </div>
              <span className="field-hint">
                Reduces animation. The app also follows your device&apos;s own setting.
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Keyboard shortcuts"
            hint="Everything can be done without a mouse."
            action={<Keyboard size={20} aria-hidden="true" />}
          />
          <dl className="shortcuts">
            {SHORTCUTS.map(([keys, text]) => (
              <div key={keys}>
                <dt>
                  <span className="kbd">{keys}</span>
                </dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Demo data"
          hint="Reset to the built-in example project."
          action={<Database size={20} aria-hidden="true" />}
        />
        <Button
          icon={Rocket}
          busy={loadSample.isPending}
          onClick={() =>
            loadSample.mutate(undefined, {
              onSuccess: () => toast.success('Sample data reloaded.'),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        >
          Reload sample data
        </Button>
      </Card>

      <Notice>Settings you choose here are stored only in this browser.</Notice>
    </>
  );
}
