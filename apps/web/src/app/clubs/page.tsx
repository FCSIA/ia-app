'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function ClubsPage() {
  const user = getUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const canCreate = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  const { data: allClubs, isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => clubsApi.getAll().then((r) => r.data),
  });

  const { data: myData } = useQuery({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((r) => r.data),
  });

  const { data: invites } = useQuery({
    queryKey: ['club-invites'],
    queryFn: () => clubsApi.getMyInvites().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => clubsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] });
      setShowNew(false);
      setForm({ name: '', description: '' });
      toast({ title: 'Club created' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed to create club', variant: 'destructive' }),
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      clubsApi.respondToInvite(inviteId, accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-invites', 'my-clubs'] });
      toast({ title: 'Response sent' });
    },
  });

  const myClubIds = new Set([
    ...(myData?.memberOf?.map((c: any) => c.id) || []),
    ...(myData?.sponsoring?.map((c: any) => c.id) || []),
  ]);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clubs</h1>
            <p className="text-muted-foreground text-sm">Invite-only school clubs</p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowNew(true)} className="flex items-center gap-2">
              <Plus size={16} /> New Club
            </Button>
          )}
        </div>

        {/* Pending invites */}
        {invites?.length > 0 && (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-3 border-b border-amber-500/10 mb-4">
              <CardTitle className="text-amber-600 dark:text-amber-500 text-lg">Pending Invites</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invites.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-xl p-4 bg-background border border-amber-500/20 shadow-sm"
                  >
                    <div>
                      <p className="font-semibold text-foreground/90">{inv.club.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Invited by {inv.sender.firstName} {inv.sender.lastName}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => respondMutation.mutate({ inviteId: inv.id, accept: true })}
                        className="flex items-center gap-1"
                      >
                        <Check size={14} /> Accept
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => respondMutation.mutate({ inviteId: inv.id, accept: false })}
                        className="flex items-center gap-1"
                      >
                        <X size={14} /> Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* New club form */}
        {showNew && canCreate && (
          <Card className="mb-6">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg">Create New Club</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMutation.mutate({ ...form, sponsorIds: [] });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Club Name *</label>
                  <Input
                    placeholder="E.g., Chess Club"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Description (optional)</label>
                  <Textarea
                    placeholder="Brief description of the club's activities..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-4 border-t border-border mt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    Create Club
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* My clubs */}
        {myData?.memberOf?.length > 0 && (
          <div className="mb-8">
            <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">My Clubs</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {myData.memberOf.map((club: any) => (
                <Link key={club.id} href={`/clubs/${club.id}`} className="block">
                  <Card className="h-full hover:-translate-y-0.5 transition-all duration-200 hover:border-accent-500/30">
                    <CardContent className="p-5 flex flex-col h-full">
                      <h3 className="font-semibold text-foreground/90">{club.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 flex-grow">{club.description || 'No description provided.'}</p>
                      <div className="flex items-center justify-between mt-4 text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Users size={14} /> {club._count?.members || 0} members
                        </span>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">{club.role?.replace(/_/g, ' ')}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All clubs (for admins) */}
        {hasRole(user, 'ADMIN', 'SUPER_ADMIN') && (
          <div>
            <h2 className="font-semibold text-muted-foreground mb-4 text-sm uppercase tracking-wider">All Clubs</h2>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allClubs?.map((club: any) => (
                  <Link
                    key={club.id}
                    href={`/clubs/${club.id}`}
                    className="block"
                  >
                    <Card className={`h-full hover:-translate-y-0.5 transition-all duration-200 ${myClubIds.has(club.id) ? 'border-accent-500/40 ring-1 ring-accent-500/20' : ''}`}>
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-semibold text-foreground/90 leading-tight">{club.name}</h3>
                          {myClubIds.has(club.id) && (
                            <Badge variant="outline" className="text-[10px] bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-500/30 flex-shrink-0">Member</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 flex-grow">{club.description || 'No description provided.'}</p>
                        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                          <Users size={14} /> {club._count?.members || 0} members
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
