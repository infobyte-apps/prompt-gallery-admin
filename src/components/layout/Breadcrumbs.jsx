import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeNames = {
  prompts: 'Prompts',
  new: 'New Prompt',
  categories: 'Categories',
  tags: 'Tags',
  collections: 'Collections',
  team: 'Team & Access',
  settings: 'Settings',
  mobile: 'Mobile App',
  monetization: 'Monetization',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav className="flex items-center text-xs font-medium text-slate-500" aria-label="Breadcrumb">
      <Link to="/" className="hover:text-indigo-600 inline-flex items-center gap-1">
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>

      {pathnames.map((segment, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const displayName = routeNames[segment] || (segment.length > 15 ? `${segment.slice(0, 12)}...` : segment);

        return (
          <React.Fragment key={routeTo}>
            <ChevronRight className="w-3 h-3 text-slate-400 mx-1.5 shrink-0" />
            {isLast ? (
              <span className="text-slate-900 font-semibold">{displayName}</span>
            ) : (
              <Link to={routeTo} className="hover:text-indigo-600">
                {displayName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

