import React from 'react';

export function StatusBadge({ status, size = 'sm' }) {
  const styles = {
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
    archived: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const labels = {
    published: 'Published',
    draft: 'Draft',
    archived: 'Archived',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs font-semibold',
  };

  const normalized = (status || 'draft').toLowerCase();

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${
        styles[normalized] || styles.draft
      } ${sizeClasses[size]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {labels[normalized] || normalized}
    </span>
  );
}

