'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';
import { CircleCheck, CircleX, TerminalSquare } from 'lucide-react';
import { displayName } from '~/apps/shared/user-name';
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { authClient } from '@/lib/auth-client';
import { useCurrentUser } from '@/lib/auth';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';

// Approves a sign-in started with `fcsia login` (RFC 8628). Opening the code
// claims it for the signed-in person; only they can then approve or deny it.

const CODE_LENGTH = 8;

type Step =
  | { kind: 'enter' }
  | { kind: 'confirm'; code: string }
  | { kind: 'approved' }
  | { kind: 'denied' };

type Problem = { title: string; description?: string };

function normalize(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, CODE_LENGTH);
}

function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// Better Auth returns RFC 8628 error bodies: { error, error_description }.
function problemFrom(error: { status?: number; error?: unknown; error_description?: unknown } | null): Problem {
  const code = typeof error?.error === 'string' ? error.error : '';
  const description = typeof error?.error_description === 'string' ? error.error_description : undefined;
  if (code === 'expired_token') {
    return { title: 'This code has expired.', description: 'Run fcsia login again for a new code.' };
  }
  if (code === 'slow_down' || error?.status === 429) {
    return { title: 'Too many attempts.', description: description ?? 'Wait a few minutes, then try again.' };
  }
  if (code === 'access_denied') {
    return { title: 'This code was opened by another account.', description: 'Run fcsia login again for a new code.' };
  }
  if (code === 'invalid_request') {
    return { title: "That code isn't valid.", description: 'Check it against your terminal, or run fcsia login again.' };
  }
  return { title: "Couldn't check the code.", description: 'Try again in a moment.' };
}

export function DeviceApproval({ initialCode }: { initialCode: string }) {
  const user = useCurrentUser();
  const [code, setCode] = useState(() => normalize(initialCode));
  const [step, setStep] = useState<Step>({ kind: 'enter' });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<'check' | 'approve' | 'deny' | null>(null);
  const autoChecked = useRef(false);

  async function check(candidate: string) {
    setProblem(null);
    setBusy('check');
    try {
      const { data, error } = await authClient.device({ query: { user_code: candidate } });
      if (error || !data) {
        setProblem(problemFrom(error));
        return;
      }
      if (data.status === 'approved') setStep({ kind: 'approved' });
      else if (data.status === 'denied') setStep({ kind: 'denied' });
      else setStep({ kind: 'confirm', code: candidate });
    } catch {
      setProblem(problemFrom(null));
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: 'approve' | 'deny', candidate: string) {
    setProblem(null);
    setBusy(decision);
    try {
      const request = decision === 'approve' ? authClient.device.approve : authClient.device.deny;
      const { error } = await request({ userCode: candidate });
      if (error) {
        setProblem(problemFrom(error));
        return;
      }
      setStep({ kind: decision === 'approve' ? 'approved' : 'denied' });
    } catch {
      setProblem(problemFrom(null));
    } finally {
      setBusy(null);
    }
  }

  // The link the CLI opens carries the code, so check it straight away; the
  // person still has to approve it on the next step.
  useEffect(() => {
    if (autoChecked.current || code.length !== CODE_LENGTH) return;
    autoChecked.current = true;
    void check(code);
    // Runs once, for the code from the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length === CODE_LENGTH) void check(code);
  }

  const name = user ? displayName(user) : 'you';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div
        className={`flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm ${CARD_SURFACE_FOREGROUND}`}
      >
        <header className="flex flex-col gap-2">
          <TerminalSquare className="size-5 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold text-foreground">Sign in to the command-line client</h1>
          {step.kind === 'enter' ? (
            <p className="text-sm text-muted-foreground">Enter the code shown in your terminal.</p>
          ) : null}
        </header>

        {step.kind === 'enter' ? (
          <form className="flex flex-col gap-6" onSubmit={submit}>
            <InputOTP
              maxLength={CODE_LENGTH}
              pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
              value={code}
              onChange={(value) => {
                setCode(normalize(value));
                setProblem(null);
              }}
              autoFocus={!initialCode}
              aria-label="Sign-in code"
              containerClassName="justify-center"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3].map((index) => (
                  <InputOTPSlot key={index} index={index} className="size-10 font-mono text-base uppercase" />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator className="text-muted-foreground" />
              <InputOTPGroup>
                {[4, 5, 6, 7].map((index) => (
                  <InputOTPSlot key={index} index={index} className="size-10 font-mono text-base uppercase" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {problem ? (
              <Banner status="error">
                <BannerTitle>{problem.title}</BannerTitle>
                {problem.description ? <BannerDescription>{problem.description}</BannerDescription> : null}
              </Banner>
            ) : null}
            <Button type="submit" loading={busy === 'check'} disabled={code.length !== CODE_LENGTH || busy !== null}>
              Continue
            </Button>
          </form>
        ) : null}

        {step.kind === 'confirm' ? (
          <div className="flex flex-col gap-6">
            <p className="text-center font-mono text-2xl font-semibold tracking-widest text-foreground">
              {formatCode(step.code)}
            </p>
            <Banner status="warning">
              <BannerTitle>Approving signs a terminal in as {name}.</BannerTitle>
              <BannerDescription>
                Only approve a code you started yourself. If someone sent you this link, deny it.
              </BannerDescription>
            </Banner>
            {problem ? (
              <Banner status="error">
                <BannerTitle>{problem.title}</BannerTitle>
                {problem.description ? <BannerDescription>{problem.description}</BannerDescription> : null}
              </Banner>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                loading={busy === 'approve'}
                disabled={busy !== null}
                onClick={() => void decide('approve', step.code)}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                loading={busy === 'deny'}
                disabled={busy !== null}
                onClick={() => void decide('deny', step.code)}
              >
                Deny
              </Button>
            </div>
          </div>
        ) : null}

        {step.kind === 'approved' ? (
          <Banner status="success" icon={CircleCheck}>
            <BannerTitle>The command-line client is signed in.</BannerTitle>
            <BannerDescription>
              You can close this tab and go back to your terminal. To sign it out later, use Profile.
            </BannerDescription>
          </Banner>
        ) : null}

        {step.kind === 'denied' ? (
          <Banner status="default" icon={CircleX}>
            <BannerTitle>Sign-in denied.</BannerTitle>
            <BannerDescription>Nothing was signed in. You can close this tab.</BannerDescription>
          </Banner>
        ) : null}
      </div>
    </main>
  );
}
