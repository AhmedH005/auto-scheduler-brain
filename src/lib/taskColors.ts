export interface TaskColor {
  id: string;
  label: string;
  border: string;
  bg: string;
}

export const TASK_COLORS: TaskColor[] = [
  { id: 'teal',   label: 'Teal',   border: 'hsl(175 70% 45%)', bg: 'hsl(175 70% 45% / 0.14)' },
  { id: 'purple', label: 'Purple', border: 'hsl(260 60% 65%)', bg: 'hsl(260 60% 65% / 0.14)' },
  { id: 'blue',   label: 'Blue',   border: 'hsl(210 80% 60%)', bg: 'hsl(210 80% 60% / 0.14)' },
  { id: 'green',  label: 'Green',  border: 'hsl(145 55% 48%)', bg: 'hsl(145 55% 48% / 0.14)' },
  { id: 'amber',  label: 'Amber',  border: 'hsl(38 85% 58%)',  bg: 'hsl(38 85% 58% / 0.14)'  },
  { id: 'red',    label: 'Red',    border: 'hsl(0 68% 60%)',   bg: 'hsl(0 68% 60% / 0.14)'   },
  { id: 'pink',   label: 'Pink',   border: 'hsl(330 65% 65%)', bg: 'hsl(330 65% 65% / 0.14)' },
  { id: 'orange', label: 'Orange', border: 'hsl(22 90% 58%)',  bg: 'hsl(22 90% 58% / 0.14)'  },
  { id: 'indigo', label: 'Indigo', border: 'hsl(240 60% 65%)', bg: 'hsl(240 60% 65% / 0.14)' },
  { id: 'slate',  label: 'Slate',  border: 'hsl(215 20% 58%)', bg: 'hsl(215 20% 58% / 0.14)' },
];

export const DEFAULT_COLOR_ID = 'teal';

export function getTaskColor(colorId?: string): TaskColor {
  return TASK_COLORS.find(c => c.id === colorId) ?? TASK_COLORS[0];
}
