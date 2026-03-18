import type { Salary } from '../../types';
import { Card } from '../ui/card';

export function SalaryCard({ record }: { record: Salary }) {
  return (
    <Card className="max-w-md">
      <p className="text-sm text-gray-500">Current Salary</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">
        {record.currency} {Number(record.salary).toLocaleString()}
      </p>
      <p className="mt-1 text-sm text-gray-500">Effective: {record.effective_date}</p>
    </Card>
  );
}
