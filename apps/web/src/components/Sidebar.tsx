'use client';

import React from 'react';
import {
  Activity,
  BarChart3,
  ClipboardList,
  Database,
  FlaskConical,
  LayoutDashboard,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const navigationItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'scenarios', label: 'Scenarios', icon: FlaskConical },
  { id: 'decisions', label: 'Decisions', icon: ClipboardList },
  { id: 'data', label: 'Data Workspace', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings2 },
  { id: 'backtest', label: 'Backtest', icon: Activity },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  pendingDecisionsCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  pendingDecisionsCount = 0,
  isOpen = false,
  onClose,
}: SidebarProps) {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            SB
          </div>
          <div>
            <strong>SoyBuy</strong>
            <small>ABT-CPD DESK</small>
          </div>
        </div>

        {/* Workspace Card */}
        <div className="workspace-select">
          <div className="workspace-avatar">CPD</div>
          <div>
            <strong>ABT-CPD Commercial</strong>
            <small>Live Optimization Desk</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACES</div>

        {/* Navigation */}
        <nav className="main-nav" aria-label="Main Navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'nav-active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  if (onClose) onClose();
                }}
              >
                <Icon size={16} />
                <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                {item.id === 'decisions' && pendingDecisionsCount > 0 ? (
                  <span
                    style={{
                      background: '#a54c39',
                      color: '#fff',
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 6px',
                    }}
                  >
                    {pendingDecisionsCount}
                  </span>
                ) : item.id === 'data' ? (
                  <span className="nav-dot" />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="pulse-dot" />
            <span>Database Live · WCAG AA</span>
          </div>
          <div className="sidebar-footer">
            <div className="footer-avatar">SH</div>
            <div>
              <strong>Sakthi Hackathon 2.0</strong>
              <small>PS-035 Dynamic Sourcing</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
