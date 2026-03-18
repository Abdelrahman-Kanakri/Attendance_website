import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { calculateWorkedHours, type AttendanceFormInput, useUpsertAttendance } from '../../hooks/useAttendance';
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

  const projectedWorkedHours = useMemo(() => {
    if (!checkIn) {
      return 0;
    }

    if (checkOut && checkOut > checkIn) {
      return calculateWorkedHours(checkIn, checkOut);
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (currentTime <= checkIn) {
      return 0;
    }

    return calculateWorkedHours(checkIn, currentTime);
  }, [checkIn, checkOut]);

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
        Select a date, then save check-in / check-out and job description. You can also edit existing records below.
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
          <Input type="time" {...register('check_in')} />
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
              <Input type="time" {...register('check_out')} />
              {errors.check_out && <p className="text-xs text-red-600">{errors.check_out.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Job Description</label>
              <Textarea {...register('job_description')} />
            </div>
          </>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700">Current Worked Hours (live)</label>
          <Input value={projectedWorkedHours.toFixed(2)} readOnly />
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
