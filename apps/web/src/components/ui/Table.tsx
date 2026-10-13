'use client';

import React, { ReactNode } from 'react';
import { SkeletonTable } from './Loader';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  keyExtractor: (row: T, index: number) => string | number;
}

export function Table<T>({
  columns,
  data,
  loading = false,
  emptyTitle = 'No Records Found',
  emptyDescription = 'There are currently no rows to display.',
  keyExtractor,
}: TableProps<T>) {
  if (loading) {
    return <SkeletonTable rows={5} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="table-scroll">
      <table className="schedule-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ textAlign: col.align || 'left' }}
                className={col.className}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={keyExtractor(row, idx)}>
              {columns.map((col) => {
                const cellContent = col.render
                  ? col.render(row)
                  : (row as any)[col.key] != null
                  ? String((row as any)[col.key])
                  : '—';
                return (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || 'left' }}
                    className={col.className}
                  >
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
