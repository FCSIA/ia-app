'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(uniqueId, password);
      setAuth(res.data.token, res.data.user);
      toast.success('Logged in successfully');
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Glass login card */}
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.08) inset, 0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div className="text-center mb-8">
          {/* Logo mark */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              boxShadow: '0 8px 30px rgba(249,115,22,0.35)',
            }}
          >
            <span className="text-2xl font-bold text-white">IA</span>
          </div>
          <h1 className="text-2xl font-bold text-white">IA School App</h1>
          <p className="text-white/50 mt-1 text-sm">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Student / Staff ID
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. STU001"
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-white/35 mt-1.5">
              First login: use your Student/Staff ID as password
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">
          Contact your admin if you cannot log in
        </p>
      </div>
    </div>
  );
}
