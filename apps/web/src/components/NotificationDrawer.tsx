'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { AppNotification, clearNotifications, markAllAsRead } from '../lib/notifications';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
}

export function NotificationDrawer({ isOpen, onClose, notifications }: NotificationDrawerProps) {
  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} style={{ color: '#4f6b3e' }} />;
      case 'warning':
        return <AlertTriangle size={16} style={{ color: '#df6624' }} />;
      case 'error':
        return <AlertCircle size={16} style={{ color: '#a8423f' }} />;
      default:
        return <Info size={16} style={{ color: '#2d6a9f' }} />;
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 120 }}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '380px',
          maxWidth: '90vw',
          background: '#fff',
          boxShadow: '-8px 0 28px rgba(0,0,0,0.16)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 130,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #d4d7c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1f241a' }}>
              System Notifications
            </h3>
            <span style={{ fontSize: '11px', color: '#555d4e' }}>
              Real-time audit log & pipeline events
            </span>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Action bar */}
        <div
          style={{
            padding: '8px 20px',
            background: '#f8f9f5',
            borderBottom: '1px solid #e7e9df',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
          }}
        >
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#344528', fontWeight: 600, cursor: 'pointer' }}
            onClick={markAllAsRead}
          >
            Mark all read
          </button>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#a8423f', cursor: 'pointer' }}
            onClick={clearNotifications}
          >
            Clear history
          </button>
        </div>

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#727a6c', fontSize: '12px' }}>
              No notifications. All background processes running normally.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: n.read ? '#fff' : '#f5f7f1',
                  border: '1px solid #e7e9df',
                  marginBottom: '8px',
                  display: 'flex',
                  gap: '10px',
                }}
              >
                <div style={{ paddingTop: '2px' }}>{getIcon(n.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: '#1f241a' }}>{n.title}</div>
                  <div style={{ fontSize: '11px', color: '#555d4e', marginTop: '3px', lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '10px', color: '#889182', marginTop: '5px' }}>
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
