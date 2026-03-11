import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = signupSchema;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  totalDuration: z.number().int().min(1).max(1440),
  priority: z.number().int().min(1).max(5).default(3),
  deadline: z.string().datetime().nullable().optional(),
  energyIntensity: z.enum(['deep', 'moderate', 'light']).default('moderate'),
  schedulingMode: z.enum(['flexible', 'anchor', 'fixed']).default('flexible'),
  executionStyle: z.enum(['single', 'split', 'auto_chunk']).default('single'),
  windowStart: z.string().regex(timeRegex).nullable().optional(),
  windowEnd: z.string().regex(timeRegex).nullable().optional(),
  startDatetime: z.string().datetime().nullable().optional(),
  endDatetime: z.string().datetime().nullable().optional(),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.enum(['daily', 'weekdays', 'weekly', 'custom']).nullable().optional(),
  recurrenceInterval: z.number().int().min(1).default(1),
  recurrenceEnd: z.string().datetime().nullable().optional(),
}).refine(data => {
  if (data.schedulingMode === 'fixed') {
    return data.startDatetime && data.endDatetime;
  }
  return true;
}, { message: 'Fixed tasks require startDatetime and endDatetime' })
.refine(data => {
  if (data.schedulingMode === 'anchor') {
    return data.windowStart && data.windowEnd;
  }
  return true;
}, { message: 'Anchor tasks require windowStart and windowEnd' })
.refine(data => {
  if (data.startDatetime && data.endDatetime) {
    return new Date(data.startDatetime) < new Date(data.endDatetime);
  }
  return true;
}, { message: 'Start datetime must be before end datetime' });

export const updateTaskSchema = createTaskSchema.partial();

export const createBlockSchema = z.object({
  taskId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  locked: z.boolean().default(false),
  blockType: z.enum(['focus', 'break']).default('focus'),
  instanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(data => new Date(data.startTime) < new Date(data.endTime), {
  message: 'Start time must be before end time',
});

export const updateBlockSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  locked: z.boolean().optional(),
});

export const createAnchorSchema = z.object({
  title: z.string().trim().min(1).max(200),
  windowStart: z.string().regex(timeRegex),
  windowEnd: z.string().regex(timeRegex),
  recurrencePattern: z.enum(['daily', 'weekdays', 'weekly', 'custom']),
  recurrenceInterval: z.number().int().min(1).default(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(1).max(5).default(3),
});

export const updateAnchorSchema = createAnchorSchema.partial();

export const updateSettingsSchema = z.object({
  workingHoursStart: z.string().regex(timeRegex).optional(),
  workingHoursEnd: z.string().regex(timeRegex).optional(),
  deepWindowStart: z.string().regex(timeRegex).optional(),
  deepWindowEnd: z.string().regex(timeRegex).optional(),
  bufferTime: z.number().int().min(0).max(60).optional(),
  maxDeepHoursPerDay: z.number().min(0).max(24).optional(),
  maxTotalHoursPerDay: z.number().min(0).max(24).optional(),
  minChunkSize: z.number().int().min(5).max(120).optional(),
  maxChunkSize: z.number().int().min(15).max(480).optional(),
});
