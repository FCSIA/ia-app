'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(uniqueId, password);
      setAuth(res.data.token, res.data.user);
      toast({ title: 'Logged in successfully' });
      router.replace('/dashboard');
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Login failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-background/70 backdrop-blur-xl">
        <CardHeader className="text-center space-y-2 pb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2"
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              boxShadow: '0 8px 30px rgba(249,115,22,0.35)',
            }}
          >
            <span className="text-2xl font-bold text-white">IA</span>
          </div>
          <CardTitle className="text-2xl font-bold">IA School App</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uniqueId">Student / Staff ID</Label>
              <Input
                id="uniqueId"
                type="text"
                placeholder="e.g. STU001"
                value={uniqueId}
                onChange={(e) => setUniqueId(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                First login: use your Student/Staff ID as password
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Contact your admin if you cannot log in
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
