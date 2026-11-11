import { Check, Command, Menu, Moon, Sun } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useJourney, useLoadSample, useSources } from '../lib/hooks';
import { errorMessage } from '../lib/errors';
import { applyTheme, getTheme } from '../lib/theme';
import { Badge } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { findNavItem, NAV_ITEMS, type NavItem } from './nav';

// The jump-to menu is only needed when someone presses Ctrl/Cmd+K, so it loads on demand.
const CommandPalette = lazy(() => import('../ui/CommandPalette'));

function NavGroup({
  title,
  items,
  journey,
}: {
  title?: string;
  items: NavItem[];
  journey: ReturnType<typeof useJourney>;
}) {
  const done = (item: NavItem): boolean => {
    if (item.path === '/import') return journey.total > 0;
    if (item.path === '/risks') return journey.plans > 0;
    if (item.path === '/plan') return journey.plans > 0;
    if (item.path === '/review') return journey.approved > 0;
    return false;
  };
  return (
    <>
      {title ? <div className="nav-label">{title}</div> : null}
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className="nav-link"
          data-testid={`nav-${item.label.toLowerCase()}`}
        >
          <item.icon size={19} aria-hidden="true" />
          {item.label}
          {item.step ? (
            <span
              className="nav-step"
              data-done={done(item)}
              aria-label={done(item) ? 'step complete' : `step ${item.step}`}
            >
              {done(item) ? <Check size={12} aria-hidden="true" /> : item.step}
            </span>
          ) : null}
        </NavLink>
      ))}
    </>
  );
}

export default function Shell() {
  const location = useLocation();
  const toast = useToast();
  const journey = useJourney();
  const sources = useSources();
  const loadSample = useLoadSample();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme());
  const current = findNavItem(location.pathname);

  // Close the mobile menu whenever the page changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    document.title = `${current.label} · PatchGraph`;
  }, [current.label]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'ink' ? 'silver' : 'ink';
    applyTheme(next);
    setTheme(next);
  }, []);

  const onPaletteAction = useCallback(
    (id: string) => {
      if (id === 'theme') toggleTheme();
      if (id === 'sample')
        loadSample.mutate(undefined, {
          onSuccess: () => toast.success('Sample data loaded. Head to Risks to see what matters most.'),
          onError: (e) => toast.error(errorMessage(e)),
        });
    },
    [loadSample, toast, toggleTheme],
  );

  const freshness = sources.data?.data_freshness;
  const stale = freshness === 'stale';

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar" data-open={menuOpen} aria-label="Primary">
        <NavLink to="/" className="brand" aria-label="PatchGraph home">
          <span className="brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 64 64">
              <circle cx="20" cy="42" r="8" fill="#E6E9EE" />
              <circle cx="44" cy="22" r="10" fill="#1A1220" />
              <path d="M26 37l11-9" stroke="#E6E9EE" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-name">PatchGraph</span>
        </NavLink>

        <nav className="nav" aria-label="Main">
          <NavGroup items={NAV_ITEMS.filter((i) => i.group === 'home')} journey={journey} />
          <NavGroup title="Your workflow" items={NAV_ITEMS.filter((i) => i.group === 'workflow')} journey={journey} />
          <NavGroup title="Explore" items={NAV_ITEMS.filter((i) => i.group === 'explore')} journey={journey} />
          <NavGroup title="System" items={NAV_ITEMS.filter((i) => i.group === 'system')} journey={journey} />
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-note">
            <strong>People decide</strong>
            PatchGraph recommends fixes. It never changes your code, and every approval is written to the audit log.
          </div>
        </div>
      </aside>
      {menuOpen ? <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-quiet btn-icon menu-button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="topbar-title">{current.label}</span>
          <span className="topbar-spacer" />
          {freshness ? (
            <Badge tone={stale ? 'alert' : 'neutral'} title={`Evidence snapshot ${sources.data?.snapshot_id ?? ''}`}>
              <span data-testid="data-freshness-badge">
                {stale ? 'Some data is out of date' : 'Data is up to date'}
              </span>
            </Badge>
          ) : null}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setPaletteOpen(true)}
            aria-label="Ctrl K, open quick jump"
          >
            <Command size={14} aria-hidden="true" /> <span className="kbd">Ctrl K</span>
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'ink' ? 'Switch to light theme' : 'Switch to dark theme'}
            data-testid="theme-toggle"
          >
            {theme === 'ink' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </header>

        <main id="main" className="content" tabIndex={-1}>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette onClose={() => setPaletteOpen(false)} onAction={onPaletteAction} />
        </Suspense>
      ) : null}
    </div>
  );
}
