'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Users, Plus, Check, X } from 'lucide-react';

export default function ClubsPage() {
  const user = getUser();
  const qc = useQueryClient();
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
      toast.success('Club created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const respondMutation = useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) =>
      clubsApi.respondToInvite(inviteId, accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['club-invites', 'my-clubs'] });
      toast.success('Response sent');
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
            <h1 className="text-2xl font-bold text-white">Clubs</h1>
            <p className="text-white/45 text-sm">Invite-only school clubs</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> New Club
            </button>
          )}
        </div>

        {/* Pending invites */}
        {invites?.length > 0 && (
          <div
            className="card mb-6"
            style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}
          >
            <h2 className="font-semibold text-white mb-3">Pending Invites</h2>
            <div className="space-y-3">
              {invites.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}
                >
                  <div>
                    <p className="font-medium text-white/90">{inv.club.name}</p>
                    <p className="text-xs text-white/40">
                      Invited by {inv.sender.firstName} {inv.sender.lastName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondMutation.mutate({ inviteId: inv.id, accept: true })}
                      className="btn-primary py-1 px-3 text-sm flex items-center gap-1"
                    >
                      <Check size={14} /> Accept
                    </button>
                    <button
                      onClick={() => respondMutation.mutate({ inviteId: inv.id, accept: false })}
                      className="btn-secondary py-1 px-3 text-sm flex items-center gap-1"
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New club form */}
        {showNew && canCreate && (
          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">Create New Club</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ ...form, sponsorIds: [] });
              }}
              className="space-y-3"
            >
              <input
                className="input"
                placeholder="Club name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <textarea
                className="input"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  Create Club
                </button>
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My clubs */}
        {myData?.memberOf?.length > 0 && (
          <div className="mb-6">
            <h2 className="font-semibold text-white/70 mb-3 text-sm uppercase tracking-wider">My Clubs</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {myData.memberOf.map((club: any) => (
                <Link key={club.id} href={`/clubs/${club.id}`} className="card hover:scale-[1.01] transition-transform">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white/90">{club.name}</h3>
                      <p className="text-sm text-white/40 mt-0.5 line-clamp-2">{club.description}</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-white/40">
                        <Users size={12} /> {club._count?.members} members
                        <span className="badge-green ml-2">{club.role}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All clubs (for admins) */}
        {hasRole(user, 'ADMIN', 'SUPER_ADMIN') && (
          <div>
            <h2 className="font-semibold text-white/70 mb-3 text-sm uppercase tracking-wider">All Clubs</h2>
            {isLoading ? (
              <p className="text-white/35 text-sm">Loading…</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {allClubs?.map((club: any) => (
                  <Link
                    key={club.id}
                    href={`/clubs/${club.id}`}
                    className={`card hover:scale-[1.01] transition-transform ${myClubIds.has(club.id) ? 'border-accent-500/20' : ''}`}
                  >
                    <h3 className="font-semibold text-white/90">{club.name}</h3>
                    <p className="text-sm text-white/40 mt-0.5 line-clamp-2">{club.description}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-white/40">
                      <Users size={12} /> {club._count?.members} members
                    </div>
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
