'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { pickNavigationLoadingFact } from '@ia/fun-facts';
import { authClient } from '@/lib/auth-client';
import { clearAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LoadingFact } from '@/components/ui/loading-fact';
import { IaOrbitMark } from '@/components/ui/ia-orbit-mark';

export default function LoginPage() {
  const router = useRouter();
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFact, setLoadingFact] = useState(pickNavigationLoadingFact);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingFact(pickNavigationLoadingFact());
    setLoading(true);
    try {
      const result = await authClient.signIn.username({
        username: uniqueId.trim().toUpperCase(),
        password,
      });

      if (result.error) {
        throw new Error(result.error.message ?? 'Login failed');
      }

      toast({ title: 'Logged in successfully' });
      router.replace('/dashboard');
    } catch (err: unknown) {
      clearAuth();
      toast({
        title: err instanceof Error ? err.message : 'Login failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(28rem,0.86fr)_minmax(0,1.14fr)]">
      <section className="flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <Card className="w-full max-w-md border-border/70 bg-card shadow-xl shadow-black/5">
          <CardHeader className="space-y-3 pb-6">
            <div className="mb-1 flex flex-col items-center gap-2 self-center">
              <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <IaOrbitMark
                  alt="IA Orbit"
                  width={56}
                  height={56}
                  priority
                  className="size-full object-contain"
                />
              </div>
              <p className="text-sm font-medium text-primary">Innovation Academy</p>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold tracking-tight">Sign in</CardTitle>
              <CardDescription>Use your school ID and password.</CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="uniqueId">School ID</Label>
                <Input
                  id="uniqueId"
                  name="username"
                  type="text"
                  placeholder="School ID"
                  value={uniqueId}
                  onChange={(event) => setUniqueId(event.target.value)}
                  required
                  autoFocus
                  autoCapitalize="characters"
                  autoComplete="username"
                  spellCheck={false}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" size="lg" loading={loading} className="w-full">
                Sign in
              </Button>

              {loading ? (
                <LoadingFact
                  fact={loadingFact}
                  compact
                  className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5"
                />
              ) : null}
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Contact your school administrator if you cannot sign in.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-primary lg:block" aria-hidden="true">
        <Image
          src="/images/login-campus-dithered.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 58vw, 0px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-primary/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <div className="max-w-lg rounded-2xl border border-white/20 bg-black/25 p-5 backdrop-blur-sm">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/75">Innovation Academy</p>
            <p className="mt-2 text-xl font-medium leading-snug">
              Classes, clubs, events, and school updates in one place.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
