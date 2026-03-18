import React from 'react';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'ok', label: 'OK' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function Slicers({ filters, onChange, onApply, options }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  const clearAll = () => onChange({
    departureDateFrom: '',
    departureDateTo: '',
    returnDateFrom: '',
    returnDateTo: '',
    transportType: '',
    status: '',
  });

  const hasActive =
    filters.departureDateFrom ||
    filters.departureDateTo ||
    filters.returnDateFrom ||
    filters.returnDateTo ||
    (filters.transportType && filters.transportType !== '') ||
    (filters.status && filters.status !== '');

  return (
    <div className="slicers-inner">
      <div className="slicers-grid">
        <div className="slicer-group">
          <div className="slicer-group-label">Departure Date</div>
          <div className="slicer-row">
            <label className="slicer-field">
              <span>From</span>
              <input
                type="date"
                value={filters.departureDateFrom || ''}
                onChange={(e) => update('departureDateFrom', e.target.value)}
              />
            </label>
            <label className="slicer-field">
              <span>To</span>
              <input
                type="date"
                value={filters.departureDateTo || ''}
                onChange={(e) => update('departureDateTo', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="slicer-group">
          <div className="slicer-group-label">Return Date</div>
          <div className="slicer-row">
            <label className="slicer-field">
              <span>From</span>
              <input
                type="date"
                value={filters.returnDateFrom || ''}
                onChange={(e) => update('returnDateFrom', e.target.value)}
              />
            </label>
            <label className="slicer-field">
              <span>To</span>
              <input
                type="date"
                value={filters.returnDateTo || ''}
                onChange={(e) => update('returnDateTo', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="slicer-group">
          <div className="slicer-group-label">Transport Type</div>
          <div className="slicer-row">
            <label className="slicer-field">
              <span>Type</span>
              <select
                value={filters.transportType || ''}
                onChange={(e) => update('transportType', e.target.value)}
              >
                <option value="">All</option>
                {(options.transportTypes || []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="slicer-group">
          <div className="slicer-group-label">Status</div>
          <div className="status-toggle">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`status-btn ${(filters.status || '') === s.value ? 'active' : ''} ${s.value === 'ok' ? 'ok' : s.value === 'cancelled' ? 'cancelled' : ''}`}
                onClick={() => update('status', s.value)}
              >
                {s.value === 'ok' && <span className="status-dot green" />}
                {s.value === 'cancelled' && <span className="status-dot red" />}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="slicers-actions">
        {hasActive && (
          <button type="button" className="btn-clear" onClick={clearAll}>
            Clear all
          </button>
        )}
        <button type="button" className="btn-apply" onClick={onApply}>
          Apply filters
        </button>
      </div>
    </div>
  );
}
