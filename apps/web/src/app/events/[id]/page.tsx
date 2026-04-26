'use client';

import { use, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Flag,
  MapPin,
  Share2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { eventsApi, moderationApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getOne(id).then((response) => response.data),
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      moderationApi.submitReport({
        contentType: 'EVENT',
        contentId: id,
        reason: reportReason,
      }),
    onSuccess: () => {
      setShowReport(false);
      setReportReason('');
      toast({ title: 'Report submitted' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to submit report',
        variant: 'destructive',
      }),
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-pulse">
           <div className="h-9 w-24 bg-muted rounded-full" />
           <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl text-center py-20">
          <h2 className="text-xl font-bold">Event not found</h2>
          <Button asChild className="mt-4">
            <Link href="/events">Back to events</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="rounded-full">
            <Link href="/events">
              <ArrowLeft className="mr-2 size-4" />
              Back to Events
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            onClick={() => setShowReport(true)}
          >
            <Flag className="size-4" />
          </Button>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="bg-muted/20 pb-6 border-b">
            <div className="flex items-center gap-2 mb-4">
              <Badge 
                variant={event.status === 'PUBLISHED' ? 'default' : 'secondary'}
                className={event.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-500' : ''}
              >
                {event.status.replace(/_/g, ' ')}
              </Badge>
              {event.club && (
                <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                  {event.club.name}
                </Badge>
              )}
            </div>
            
            <CardTitle className="text-3xl font-bold tracking-tight mb-4">
              {event.title}
            </CardTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="font-medium text-foreground">{format(new Date(event.startAt), 'EEEE, MMMM d, yyyy')}</p>
                  <p>Date</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {format(new Date(event.startAt), 'h:mm a')}
                    {event.endAt && ` – ${format(new Date(event.endAt), 'h:mm a')}`}
                  </p>
                  <p>Time</p>
                </div>
              </div>

              {event.location && (
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{event.location}</p>
                    <p>Location</p>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">About this Event</h3>
                <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed text-[15px]">
                  {event.description || 'No description provided for this event.'}
                </div>
              </div>

              <div className="pt-6 border-t flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2">
                  <Calendar size={16} /> Add to Calendar
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: 'Link copied to clipboard' });
                }}>
                  <Share2 size={16} /> Share Event
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showReport} onOpenChange={setShowReport}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report event</DialogTitle>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reportReason.trim()) return;
                reportMutation.mutate();
              }}
            >
              <Textarea
                placeholder="Describe the issue with this event"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={4}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setShowReport(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!reportReason.trim() || reportMutation.isPending}
                >
                  {reportMutation.isPending ? 'Submitting…' : 'Submit report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
