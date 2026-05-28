import type { LucideIcon } from 'lucide-react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';

export type WrappedSummary = NonNullable<FunctionReturnType<typeof api.wrapped.snapshots.getMine>>;

export type SlideKind = 'intro' | 'stat' | 'name' | 'outro' | 'pathway' | 'word' | 'emoji';
export type GraphicKind = 'orbs' | 'grid' | 'rings' | 'blobs' | 'confetti' | 'stars' | 'waves';

export type Slide = {
  key: string;
  kind: SlideKind;
  eyebrow: string;
  value: string;
  /** If set, `value` is a number; enables count-up animation. */
  numericValue?: number;
  caption?: string;
  icon: LucideIcon;
  gradient: string;
  /** Swappable decorative background per slide. */
  graphic: GraphicKind;
  /** Lucide icons scattered across the background. */
  scatterIcons: LucideIcon[];
  /** Optional tag chips shown under the caption (e.g. pathway badges). */
  chips?: string[];
};
