import { GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAnnouncementAudience, type AnnouncementAudienceInput } from './announcement-audience';

/** Product metadata shared by the feed, dashboard, club previews, and detail. */
export function AnnouncementAudience({ announcement }: { announcement: AnnouncementAudienceInput }) {
  const audience = getAnnouncementAudience(announcement);
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="sr-only">{audience.accessibleLabel}</span>
      <span aria-hidden="true" className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {audience.parts.map((part, index) => (
          <span key={part.kind} className="inline-flex min-w-0 items-center gap-2">
            {index > 0 ? <span aria-hidden="true" className="text-muted-foreground">·</span> : null}
            {part.kind === 'grades' ? (
              <Badge color="gray" size="md">
                <GraduationCap aria-hidden="true" strokeWidth={1.5} />{part.shortLabel}
              </Badge>
            ) : <span className="min-w-0 break-words">{part.label}</span>}
          </span>
        ))}
      </span>
    </span>
  );
}
