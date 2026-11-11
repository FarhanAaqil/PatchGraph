import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../app/nav';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: ReactNode;
  run: () => void;
}

/** Ctrl/Cmd+K jump-to menu. Opens on demand, so its code costs nothing until it is used. */
export default function CommandPalette({ onClose, onAction }: { onClose: () => void; onAction: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = NAV_ITEMS.map((item) => ({
      id: `go-${item.path}`,
      label: item.label,
      hint: item.description,
      icon: <item.icon size={18} aria-hidden="true" />,
      run: () => navigate(item.path),
    }));
    const actions: Command[] = [
      {
        id: 'sample',
        label: 'Load sample data',
        hint: 'Fill the app with a ready-made example project',
        icon: <CornerDownLeft size={18} aria-hidden="true" />,
        run: () => onAction('sample'),
      },
      {
        id: 'theme',
        label: 'Switch light / dark theme',
        hint: 'Toggle between Silver and Ink',
        icon: <CornerDownLeft size={18} aria-hidden="true" />,
        run: () => onAction('theme'),
      },
    ];
    return [...pages, ...actions];
  }, [navigate, onAction]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => setSelected(0), [query]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[selected]);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick jump" onKeyDown={onKeyDown}>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            aria-hidden="true"
            style={{ position: 'absolute', left: 20, top: 20, color: 'var(--text-3)' }}
          />
          <input
            ref={input}
            className="palette-input"
            style={{ paddingLeft: 52 }}
            placeholder="Jump to a page or run an action…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[selected] ? `cmd-${results[selected].id}` : undefined}
            aria-label="Search commands"
          />
        </div>
        <ul id="palette-list" className="palette-list" role="listbox">
          {results.length === 0 ? (
            <li style={{ padding: 16, color: 'var(--text-2)' }}>Nothing matches “{query}”.</li>
          ) : (
            results.map((command, index) => (
              <li key={command.id} role="presentation">
                <button
                  type="button"
                  id={`cmd-${command.id}`}
                  role="option"
                  aria-selected={index === selected}
                  className="palette-item"
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => choose(command)}
                >
                  {command.icon}
                  <span>
                    <strong style={{ display: 'block' }}>{command.label}</strong>
                    <span style={{ color: 'var(--text-2)', fontSize: '0.84rem' }}>{command.hint}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}
