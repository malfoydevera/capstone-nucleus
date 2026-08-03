import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, User, X } from 'lucide-react';
import { formatFullName, getInitials } from '../../utils/names';

const ROLE_LABELS = {
  dean: 'Dean',
  program_chair: 'Program Chair',
  faculty: 'Faculty',
  staff: 'Staff',
  admin: 'Admin',
  student: 'Student',
};

/**
 * Accessible searchable combobox for picking a user from a local list.
 * Filters by name, email, role, and department as the user types.
 */
const SearchableUserSelect = ({
  id,
  options = [],
  value = '',
  onChange,
  placeholder = 'Search by name or email...',
  emptyMessage = 'No matching accounts found.',
  disabled = false,
  required = false,
  accentClass = 'emerald',
  getSecondaryText,
  'aria-label': ariaLabel = 'Search and select a user',
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = useMemo(
    () => options.find((option) => option.id === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;

    return options.filter((option) => {
      const name = formatFullName(option).toLowerCase();
      const email = (option.email || '').toLowerCase();
      const role = (ROLE_LABELS[option.role] || option.role || '').toLowerCase();
      const department = (option.department || '').toLowerCase();
      return (
        name.includes(needle) ||
        email.includes(needle) ||
        role.includes(needle) ||
        department.includes(needle)
      );
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const focusRing =
    accentClass === 'blue'
      ? 'focus:ring-blue-500 focus:border-blue-500'
      : 'focus:ring-emerald-500 focus:border-emerald-500';

  const activeBg =
    accentClass === 'blue' ? 'bg-blue-50 text-blue-900' : 'bg-emerald-50 text-emerald-900';

  const selectedRing =
    accentClass === 'blue'
      ? 'border-blue-200 bg-blue-50/70'
      : 'border-emerald-200 bg-emerald-50/70';

  const avatarBg =
    accentClass === 'blue'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-emerald-100 text-emerald-700';

  const resolveSecondary = (option) => {
    if (typeof getSecondaryText === 'function') {
      return getSecondaryText(option);
    }
    const roleLabel = ROLE_LABELS[option.role] || option.role;
    const parts = [roleLabel, option.department, option.email].filter(Boolean);
    return parts.join(' · ');
  };

  const selectOption = (option) => {
    onChange?.(option?.id || '', option || null);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const clearSelection = (event) => {
    event.stopPropagation();
    onChange?.('', null);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleInputChange = (event) => {
    setQuery(event.target.value);
    if (!open) setOpen(true);
    if (value) onChange?.('', null);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (!open || filtered.length === 0) return;
      event.preventDefault();
      selectOption(filtered[highlightIndex]);
      return;
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery('');
      }
    }
  };

  const displayValue = open ? query : selected ? formatFullName(selected) : query;

  return (
    <div ref={rootRef} className="relative">
      {selected && !open ? (
        <div
          className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${selectedRing} ${
            disabled ? 'opacity-60' : ''
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarBg}`}
            aria-hidden="true"
          >
            {getInitials(selected)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{formatFullName(selected)}</p>
            <p className="truncate text-xs text-slate-500">{resolveSecondary(selected)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/80 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400"
              aria-label={`Clear selected user ${formatFullName(selected)}`}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && filtered[highlightIndex] ? `${inputId}-option-${filtered[highlightIndex].id}` : undefined
            }
            aria-label={ariaLabel}
            aria-required={required || undefined}
            disabled={disabled}
            value={displayValue}
            placeholder={placeholder}
            onChange={handleInputChange}
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            className={`w-full rounded-xl border-2 border-slate-200 bg-white py-3 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          />
          <ChevronDown
            size={18}
            className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </div>
      )}

      {open && !disabled && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">{emptyMessage}</li>
          ) : (
            filtered.map((option, index) => {
              const isHighlighted = index === highlightIndex;
              const isSelected = option.id === value;
              const secondary = resolveSecondary(option);

              return (
                <li key={option.id} role="presentation">
                  <button
                    type="button"
                    id={`${inputId}-option-${option.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={index}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectOption(option)}
                    className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 ${
                      isHighlighted ? activeBg : 'hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarBg}`}
                      aria-hidden="true"
                    >
                      {getInitials(option) || <User size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{formatFullName(option)}</p>
                      {secondary && <p className="truncate text-xs text-slate-500">{secondary}</p>}
                    </div>
                    {isSelected && (
                      <Check size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableUserSelect;
