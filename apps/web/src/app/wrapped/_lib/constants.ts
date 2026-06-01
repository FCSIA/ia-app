import {
  Heart,
  Stethoscope,
  Beaker,
  Sparkles,
  Laptop,
  Cpu,
  Hash,
  Zap,
  Wrench,
  Flame,
  type LucideIcon,
} from 'lucide-react';

export const PATHWAY_THEME: Record<
  'HEALTH_SCIENCE' | 'INFORMATION_TECHNOLOGY' | 'ENGINEERING',
  { gradient: string; icon: LucideIcon; scatter: LucideIcon[]; label: string }
> = {
  HEALTH_SCIENCE: {
    gradient: 'from-emerald-500 via-green-600 to-teal-700',
    icon: Stethoscope,
    scatter: [Heart, Stethoscope, Beaker, Sparkles],
    label: 'Health Science',
  },
  INFORMATION_TECHNOLOGY: {
    gradient: 'from-sky-500 via-blue-600 to-indigo-700',
    icon: Laptop,
    scatter: [Laptop, Cpu, Hash, Zap],
    label: 'Information Technology',
  },
  ENGINEERING: {
    gradient: 'from-amber-500 via-yellow-500 to-orange-600',
    icon: Wrench,
    scatter: [Wrench, Cpu, Sparkles, Flame],
    label: 'Engineering',
  },
};
