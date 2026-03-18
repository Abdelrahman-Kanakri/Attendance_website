import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useLeaveBalance, useSubmitLeaveRequest, type LeaveBalance } from '../../hooks/useLeave';
import { Card } from '../ui/card';
import { Select } from '../ui/select';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { getErrorMessage } from '../../lib/errors';

const leaveSchema = z.object({
  leave_type: z.enum(['Annual Leave', 'Sick Leave', 'Unpaid']),
  date: z.string().min(1, 'Date is required'),
  duration_days: z.number().int().min(1, 'Minimum duration is 1 day'),
  reason: z.string().min(3, 'Reason is required'),
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

function remainingForType(balance: LeaveBalance, leaveType: LeaveFormValues['leave_type']) {
  if (leaveType === 'Annual Leave') {
    return balance.annualRemaining;
  }
  if (leaveType === 'Sick Leave') {
    return balance.sickRemaining;
  }
  return Number.POSITIVE_INFINITY;
}

export function LeaveRequestForm() {
  const leaveBalance = useLeaveBalance();
  const submitLeave = useSubmitLeaveRequest();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leave_type: 'Annual Leave',
      date: new Date().toISOString().slice(0, 10),
      duration_days: 1,
      reason: '',
    },
  });

  const leaveType = watch('leave_type');
  const currentBalance = leaveBalance.data;

  const allowedRemaining = useMemo(() => {
    if (!currentBalance) {
      return 0;
    }
    return remainingForType(currentBalance, leaveType);
  }, [currentBalance, leaveType]);

  const onSubmit = handleSubmit(async (values) => {
    if (currentBalance && values.leave_type !== 'Unpaid' && values.duration_days > allowedRemaining) {
      setError('duration_days', {
        type: 'validate',
        message: `Requested duration exceeds remaining balance (${allowedRemaining}).`,
      });
      return;
    }

    try {
      await submitLeave.mutateAsync(values);
      toast.success('Leave request submitted.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to submit request.'));
    }
  });

  return (
    <Card>
      <h2 className="mb-4 text-base font-semibold text-gray-900">Submit Leave Request</h2>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div>
          <label className="text-sm font-medium text-gray-700">Leave Type</label>
          <Select {...register('leave_type')}>
            <option value="Annual Leave">Annual Leave</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Unpaid">Unpaid</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Start Date</label>
          <Input type="date" {...register('date')} />
          {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Duration (days)</label>
          <Input type="number" min={1} {...register('duration_days', { valueAsNumber: true })} />
          {errors.duration_days && <p className="text-xs text-red-600">{errors.duration_days.message}</p>}
        </div>

        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          Remaining balance for this type: {Number.isFinite(allowedRemaining) ? allowedRemaining : 'Unlimited'}
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Reason</label>
          <Textarea {...register('reason')} />
          {errors.reason && <p className="text-xs text-red-600">{errors.reason.message}</p>}
        </div>

        <div className="md:col-span-2">
          <Button type="submit" disabled={isSubmitting || submitLeave.isPending}>
            {isSubmitting || submitLeave.isPending ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
