'use client';

import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  FileText,
  LogOut,
  Menu,
  RefreshCw,
  User,
} from 'lucide-react';
import { UserProfile } from '../lib/supabase';

interface HeaderProps {
  user: UserProfile | null;
  unreadCount: number;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenReport: () => void;
  onSignOut: () => void;
  onToggleMobileMenu?: () => void;
}

export function Header({
  user,
  unreadCount,
  refreshing,
  onRefresh,
  onOpenNotifications,
  onOpenAuth,
  onOpenProfile,
  onOpenReport,
  onSignOut,
  onToggleMobileMenu,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="mobile-menu-button"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="topbar-title">SoyBuy Procurement Engine</div>
        <span className="badge badge-green">
          <span className="pulse-dot" />
          Live Postgres Telemetry
        </span>
      </div>

      <div className="topbar-right">
        {/* Refresh Data */}
        <button
          type="button"
          className="topbar-pill"
          onClick={onRefresh}
          disabled={refreshing}
          title="Synchronize state from Supabase database"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Syncing…' : 'Sync'}</span>
        </button>

        {/* Executive Report / Export */}
        <button
          type="button"
          className="topbar-pill"
          onClick={onOpenReport}
          title="Generate executive PDF report from database state"
        >
          <FileText size={13} />
          <span>Executive Report</span>
        </button>

        {/* Notifications Bell */}
        <button
          type="button"
          className="icon-button"
          style={{ position: 'relative' }}
          onClick={onOpenNotifications}
          aria-label="View notifications"
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                background: '#a54c39',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 700,
                borderRadius: '10px',
                minWidth: '15px',
                height: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <span className="topbar-divider" />

        {/* User Auth / Profile Dropdown */}
        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="topbar-pill"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#344528',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                {getInitials(user.full_name || user.email)}
              </span>
              <span style={{ fontWeight: 600, fontSize: '11px' }}>
                {user.full_name || user.email.split('@')[0]}
              </span>
              <ChevronDown size={13} />
            </button>

            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    width: '240px',
                    background: '#fff',
                    border: '1px solid #d4d7c7',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    padding: '8px 0',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid #e7e9df' }}>
                    <div style={{ fontWeight: 600, color: '#1f241a' }}>{user.full_name || 'Buyer'}</div>
                    <div style={{ fontSize: '11px', color: '#555d4e' }}>{user.email}</div>
                    <div style={{ fontSize: '10px', color: '#727a6c', marginTop: '2px' }}>
                      Org: {user.organization || 'ABT-CPD'} · Role: {user.role || 'Authorized Buyer'}
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#2a3123',
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenProfile();
                    }}
                  >
                    <User size={14} />
                    <span>Edit Profile & Password</span>
                  </button>

                  <div style={{ borderTop: '1px solid #e7e9df', margin: '4px 0' }} />

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#a54c39',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="button button-primary"
            style={{ height: '32px', fontSize: '11px', padding: '0 12px' }}
            onClick={onOpenAuth}
          >
            <User size={13} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
