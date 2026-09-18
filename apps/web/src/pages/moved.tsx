import Head from "next/head";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IaOrbitMark } from "@/components/ui/ia-orbit-mark";

export default function MovedPage() {
  return (
    <>
      <Head>
        <title>IA App has moved</title>
        <meta
          name="description"
          content="Continue to the IA App at app.fcsia.com."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://app.fcsia.com/" />
      </Head>
      <main className="flex min-h-dvh bg-background text-foreground">
        <Empty className="min-h-dvh rounded-none border-0">
          <EmptyHeader>
            <EmptyMedia>
              <IaOrbitMark
                alt="IA App"
                width={56}
                height={56}
                className="size-14"
                priority
              />
            </EmptyMedia>
            <EmptyTitle
              role="heading"
              aria-level={1}
              className="text-2xl font-semibold sm:text-3xl"
            >
              IA App has moved
            </EmptyTitle>
            <EmptyDescription className="max-w-sm text-sm sm:text-base">
              The new address is{" "}
              <strong className="text-foreground">app.fcsia.com</strong>. Your
              account and school information are already there.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <a href="https://app.fcsia.com/">Open IA App</a>
              </Button>
              <Button asChild size="lg" variant="tertiary">
                <a href="https://app.fcsia.com/pwa-setup">Home Screen help</a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              If you saved the old IA App to your Home Screen, remove that icon
              and add it again from the new address.
            </p>
          </EmptyContent>
        </Empty>
      </main>
    </>
  );
}
