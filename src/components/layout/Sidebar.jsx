import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Layers, Tag, BookmarkCheck, Users, Sparkles, ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Sidebar({ collapsed, onToggleCollapse, isMobile = false, onCloseMobile }) {
  const { isSuperAdmin } = useAuth();

  const contentNavItems = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'Prompts', to: '/prompts', icon: FileText },
    { label: 'Categories', to: '/categories', icon: Layers },
    { label: 'Tags', to: '/tags', icon: Tag },
    { label: 'Collections', to: '/collections', icon: BookmarkCheck },
  ];

  const settingsNavItems = [
    { label: 'Mobile App', to: '/settings/mobile', icon: Smartphone },
  ];

  const adminNavItems = [
    { label: 'Team & Access', to: '/team', icon: Users, requiredSuperAdmin: true },
  ];

  const handleLinkClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside
      className={`h-full bg-slate-900 text-slate-300 flex flex-col justify-between transition-all duration-300 select-none ${
        collapsed && !isMobile ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            {(!collapsed || isMobile) && (
              <div className="truncate">
                <span className="font-bold text-white tracking-tight text-sm">PROMPT GALLERY</span>
                <span className="block text-[10px] text-slate-400 font-medium">Curator Admin v1.1</span>
              </div>
            )}
          </div>

          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="p-3 space-y-6 overflow-y-auto">
          {/* Content Group */}
          <div>
            {(!collapsed || isMobile) && (
              <h4 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Content
              </h4>
            )}
            <div className="space-y-1">
              {contentNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      } ${collapsed && !isMobile ? 'justify-center px-2' : ''}`
                    }
                    title={collapsed && !isMobile ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {(!collapsed || isMobile) && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Settings Group */}
          <div>
            {(!collapsed || isMobile) && (
              <h4 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Settings
              </h4>
            )}
            <div className="space-y-1">
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleLinkClick}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      } ${collapsed && !isMobile ? 'justify-center px-2' : ''}`
                    }
                    title={collapsed && !isMobile ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {(!collapsed || isMobile) && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Administration Group (Super Admin only) */}
          {isSuperAdmin && (
            <div>
              {(!collapsed || isMobile) && (
                <h4 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Administration
                </h4>
              )}
              <div className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={handleLinkClick}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                        } ${collapsed && !isMobile ? 'justify-center px-2' : ''}`
                      }
                      title={collapsed && !isMobile ? item.label : undefined}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {(!collapsed || isMobile) && <span>{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Footer Info */}
      {(!collapsed || isMobile) && (
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          <p>Production Catalog v1.1</p>
          <p className="text-[10px] text-slate-600">Mobile catalog sync enabled</p>
        </div>
      )}
    </aside>
  );
}

