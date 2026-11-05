'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { pickNavigationLoadingFact } from '@ia/fun-facts';
import { authClient } from '@/lib/auth-client';
import { clearAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { InputControl, InputControlInput } from '@/components/ui/input-control-group';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LoadingFact } from '@/components/ui/loading-fact';

const SCHOOL_FRONT_PHOTO = '/images/login-campus-columns.webp';

type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

const TIMES_OF_DAY: TimeOfDay[] = ['morning', 'day', 'evening', 'night'];

/** Colour schemes the page can preview with `?scheme=`; ink is the default. */
const SCHEMES = ['original', 'light', 'high-contrast'];

function timeOfDayFor(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'evening';
  return 'night';
}

/** Stagger index for the desktop entrance animation. */
function rise(index: number): CSSProperties {
  return { '--rise': index } as CSSProperties;
}

export default function LoginPage() {
  const router = useRouter();
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingFact, setLoadingFact] = useState(pickNavigationLoadingFact);
  const [shake, setShake] = useState(false);
  // Time of day depends on the visitor's clock, so it resolves after
  // hydration; the backdrop fades in once it is known. `?tod=night` etc.
  // previews a specific grade.
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | null>(null);
  const [scheme, setScheme] = useState<string | undefined>(undefined);
  const [tint, setTint] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preview = params.get('tod');
    const schemePreview = params.get('scheme');
    if (schemePreview && SCHEMES.includes(schemePreview)) setScheme(schemePreview);
    if (params.get('tint') === 'orange') setTint('orange');
    setTimeOfDay(
      TIMES_OF_DAY.includes(preview as TimeOfDay) ? (preview as TimeOfDay) : timeOfDayFor(new Date().getHours()),
    );
  }, []);

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
      router.replace('/');
    } catch (err: unknown) {
      clearAuth();
      setShake(true);
      toast({
        title: err instanceof Error ? err.message : 'Login failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      data-scheme={scheme}
      className="login-ink relative flex min-h-dvh flex-col bg-background text-foreground lg:block lg:overflow-hidden"
    >
      {/* The school's front, graded by time of day: a header strip on phones,
          and on desktop framed on the right, blending into the ink on the left. */}
      <div
        data-tod={timeOfDay ?? undefined}
        data-tint={tint}
        className="login-backdrop pointer-events-none relative h-[36dvh] min-h-56 shrink-0 overflow-hidden lg:absolute lg:inset-y-0 lg:left-[24%] lg:right-0 lg:h-auto"
      >
        <Image
          src={SCHOOL_FRONT_PHOTO}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 76vw, 100vw"
          className="login-backdrop-photo object-cover object-[30%_50%] lg:object-[0%_55%]"
        />
        <div className="login-tone-hi absolute inset-0" />
        <div className="login-tone-lo absolute inset-0" />
        <div className="absolute inset-y-0 -left-1 hidden w-3/5 bg-gradient-to-r from-background from-[2%] via-background/80 to-transparent lg:block" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-background/60 to-transparent" />
        <div className="absolute left-5 top-[max(env(safe-area-inset-top),1.25rem)] flex items-center gap-2.5 lg:hidden">
          <Image src="/icons/ia-orbit-dark.png" alt="" width={32} height={32} priority className="rounded-lg" />
          <span className="text-[15px] font-semibold text-white">IA App</span>
        </div>
      </div>

      {/* Sign-in: a bottom sheet on phones; on desktop the headline and a glass
          card sit in the ink, reaching into the photo. */}
      <section className="relative -mt-7 flex flex-1 flex-col rounded-t-[1.75rem] bg-background px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-3 lg:mt-0 lg:min-h-dvh lg:rounded-none lg:bg-transparent lg:px-[6vw] lg:py-10">
        <div aria-hidden="true" className="mx-auto mb-7 h-1 w-9 rounded-full bg-muted-foreground/30 lg:hidden" />

        <div className="login-rise hidden items-center gap-3 lg:flex" style={rise(0)}>
          <Image src="/icons/ia-orbit-dark.png" alt="" width={40} height={40} priority className="rounded-md" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">IA App</p>
            <p className="text-[13px] text-muted-foreground">Innovation Academy</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col lg:justify-center lg:py-8">
          <h1
            className="login-rise mb-6 pb-1 text-[2.25rem] font-semibold italic leading-[1.05] tracking-[-0.02em] lg:mb-8 lg:text-[3.25rem] xl:text-[3.75rem]"
            style={{ ...rise(1), fontFamily: 'var(--font-login-display)' }}
          >
            Your day at <span className="text-primary">IA</span>,
            <br />
            in one place.
          </h1>

          <div className="login-card login-card-in flex flex-1 flex-col lg:w-full lg:max-w-[28rem] lg:flex-none lg:rounded-lg lg:border lg:border-[hsl(var(--foreground)/0.1)] lg:bg-[hsl(var(--card)/0.6)] lg:p-10 lg:shadow-[0_40px_90px_-30px_rgba(2,4,10,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] lg:backdrop-blur-2xl lg:[animation-delay:220ms]">
            <div className="login-rise mb-7" style={rise(2)}>
              <h2 className="text-xl font-semibold tracking-tight lg:text-2xl">Sign in</h2>
              <p className="mt-1.5 text-[15px] text-muted-foreground">Use your school ID and password.</p>
            </div>

            <div className="login-rise" style={rise(3)}>
              <form
                onSubmit={handleLogin}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget) setShake(false);
                }}
                className={`space-y-5 ${shake ? 'login-shake' : ''}`}
              >
                <div className="space-y-2">
                  <Label htmlFor="uniqueId">School ID</Label>
                  <InputControl>
                    <InputControlInput
                      id="uniqueId"
                      name="username"
                      type="text"
                      placeholder="STU001"
                      value={uniqueId}
                      onChange={(event) => setUniqueId(event.target.value)}
                      required
                      autoFocus
                      autoCapitalize="characters"
                      autoComplete="username"
                      spellCheck={false}
                    />
                  </InputControl>
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

                {/* The primary button paints with foreground/background; point
                  them at the ember accent for the brand CTA. */}
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  className="mt-2 h-11 w-full rounded-full text-[15px] font-semibold active:scale-[0.98] lg:mt-3 lg:h-12 lg:rounded-md lg:text-base [--background:var(--primary-foreground)] [--foreground:var(--primary)]"
                >
                  Sign in
                </Button>

                {loading ? (
                  <LoadingFact
                    fact={loadingFact}
                    compact
                    className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5 lg:rounded-md"
                  />
                ) : null}
              </form>
            </div>

            <p
              className="login-rise mt-8 text-xs text-muted-foreground lg:border-t lg:border-[hsl(var(--foreground)/0.08)] lg:pt-6 lg:text-[13px]"
              style={rise(4)}
            >
              Trouble signing in? Ask your school administrator.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
