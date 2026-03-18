import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none ring-indigo-600 focus:ring-2',
        className,
      )}
      {...props}
    />
  );
}
