import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { type AttendanceFormInput, useUpsertAttendance } from '../../hooks/useAttendance';
import { getErrorMessage } from '../../lib/errors';

const attendanceSchema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    check_in: z.string().min(1, 'Check in time is required'),
    check_out: z.string().optional(),
    work_location: z.enum(['Office', 'Remote', 'Field']),
    job_description: z.string().optional(),
    add_details: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.check_out && values.check_out <= values.check_in) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['check_out'],
        message: 'Check out must be after check in',
      });
    }
  });

type AttendanceSchemaValues = z.infer<typeof attendanceSchema>;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceForm() {
  const upsertAttendance = useUpsertAttendance();
  const today = todayDate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AttendanceSchemaValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      date: today,
      check_in: '',
      check_out: '',
      work_location: 'Office',
      job_description: '',
      add_details: false,
    },
  });

  const selectedDate = watch('date');
  const checkIn = watch('check_in');
  const checkOut = watch('check_out');
  const addDetails = watch('add_details');
  const [checkInHour = '', checkInMinute = ''] = checkIn?.split(':') ?? [];
  const [checkOutHour = '', checkOutMinute = ''] = checkOut?.split(':') ?? [];
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const setCheckInParts = (nextHour: string, nextMinute: string) => {
    if (nextHour && nextMinute) {
      setValue('check_in', `${nextHour}:${nextMinute}`, { shouldDirty: true, shouldValidate: true });
      return;
    }

    setValue('check_in', '', { shouldDirty: true, shouldValidate: true });
  };

  const setCheckOutParts = (nextHour: string, nextMinute: string) => {
    if (nextHour && nextMinute) {
      setValue('check_out', `${nextHour}:${nextMinute}`, { shouldDirty: true, shouldValidate: true });
      return;
    }

    setValue('check_out', '', { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await upsertAttendance.mutateAsync({
        ...values,
        check_out: values.add_details ? values.check_out : undefined,
        job_description: values.add_details ? values.job_description : undefined,
      } as AttendanceFormInput);
      toast.success(values.check_out ? 'Check-out saved successfully.' : 'Morning check-in saved successfully.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save attendance.'));
    }
  });

  return (
    <Card>
      <h2 className="mb-2 text-base font-semibold text-gray-900">My Attendance</h2>
      <p className="mb-4 text-sm text-gray-500">
        Select a date, then save check-in and optionally add check-out with job description.
      </p>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div>
          <label className="text-sm font-medium text-gray-700">Date</label>
          <Input type="date" {...register('date')} />
          {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Work Location</label>
          <Select {...register('work_location')}>
            <option value="Office">Office</option>
            <option value="Remote">Remote</option>
            <option value="Field">Field</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Check In</label>
          <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 7v6l4 2"></path>
              </svg>
              Time Picker
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Select
                value={checkInHour}
                onChange={(event) => setCheckInParts(event.target.value, checkInMinute)}
                aria-label="Check in hour"
              >
                <option value="">Hour</option>
                {hourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </Select>
              <span className="text-center text-sm font-semibold text-gray-500">:</span>
              <Select
                value={checkInMinute}
                onChange={(event) => setCheckInParts(checkInHour, event.target.value)}
                aria-label="Check in minute"
              >
                <option value="">Minute</option>
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </Select>
            </div>
            <p className="mt-2 text-xs text-gray-500">Selected: {checkIn || '--:--'}</p>
          </div>
          {errors.check_in && <p className="text-xs text-red-600">{errors.check_in.message}</p>}
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <Input type="checkbox" className="h-4 w-4" {...register('add_details')} />
          <span className="text-sm text-gray-700">Add check-out and job description</span>
        </div>

        {addDetails && (
          <>
            <div>
              <label className="text-sm font-medium text-gray-700">Check Out</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9"></circle>
                    <path d="M12 7v6l4 2"></path>
                  </svg>
                  Time Picker
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Select
                    value={checkOutHour}
                    onChange={(event) => setCheckOutParts(event.target.value, checkOutMinute)}
                    aria-label="Check out hour"
                  >
                    <option value="">Hour</option>
                    {hourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </Select>
                  <span className="text-center text-sm font-semibold text-gray-500">:</span>
                  <Select
                    value={checkOutMinute}
                    onChange={(event) => setCheckOutParts(checkOutHour, event.target.value)}
                    aria-label="Check out minute"
                  >
                    <option value="">Minute</option>
                    {minuteOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="mt-2 text-xs text-gray-500">Selected: {checkOut || '--:--'}</p>
              </div>
              {errors.check_out && <p className="text-xs text-red-600">{errors.check_out.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Job Description</label>
              <Textarea {...register('job_description')} />
            </div>
          </>
        )}

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Worked hours are calculated after check-out is submitted.
        </div>

        <div className="md:col-span-2">
          <Button type="submit" disabled={isSubmitting || upsertAttendance.isPending}>
            {isSubmitting || upsertAttendance.isPending
              ? 'Saving...'
              : selectedDate === today
                ? 'Save today'
                : 'Save for selected date'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
