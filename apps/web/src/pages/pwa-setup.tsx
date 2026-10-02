import Head from "next/head";
import { Button } from "@/components/ui/button";
import {
  AccordionContent,
  AccordionGroup,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IaOrbitMark } from "@/components/ui/ia-orbit-mark";
import { Separator } from "@/components/ui/separator";

const platforms = [
  {
    value: "iphone-ipad",
    title: "iPhone or iPad — Safari",
    steps: [
      <>
        Open <strong>Safari</strong> and go to <strong>app.fcsia.com</strong>.
      </>,
      <>
        Tap the page menu, then <strong>Share</strong>.
      </>,
      <>
        Tap <strong>Add to Home Screen</strong>. If you do not see it, scroll
        down and tap <strong>Edit Actions</strong> to add it.
      </>,
      <>
        Turn on <strong>Open as Web App</strong> if it appears, then tap{" "}
        <strong>Add</strong>.
      </>,
    ],
  },
  {
    value: "android",
    title: "Android — Chrome",
    steps: [
      <>
        Open <strong>Chrome</strong> and go to <strong>app.fcsia.com</strong>.
      </>,
      <>
        Tap the <strong>three-dot menu</strong> beside the address bar.
      </>,
      <>
        Tap <strong>Install and create shortcut</strong>, then{" "}
        <strong>Install</strong>.
      </>,
      <>Follow the prompts to place IA App on your Home Screen.</>,
    ],
  },
  {
    value: "mac-safari",
    title: "Mac — Safari",
    steps: [
      <>
        On macOS Sonoma 14 or newer, open <strong>Safari</strong> and go to{" "}
        <strong>app.fcsia.com</strong>.
      </>,
      <>
        Choose <strong>File → Add to Dock</strong>, or choose{" "}
        <strong>Share → Add to Dock</strong>.
      </>,
      <>
        Keep the name IA App, then click <strong>Add</strong>.
      </>,
    ],
  },
  {
    value: "edge",
    title: "Windows — Microsoft Edge",
    steps: [
      <>
        Open <strong>Edge</strong> and go to <strong>app.fcsia.com</strong>.
      </>,
      <>
        Select the install icon in the address bar. If it is not there, open{" "}
        <strong>Settings and more (…)</strong>.
      </>,
      <>
        Choose <strong>More tools → Apps → Install this site as an app</strong>.
      </>,
      <>
        Click <strong>Install</strong>. Edge can also pin IA App to Start or the
        taskbar.
      </>,
    ],
  },
  {
    value: "chrome-desktop",
    title: "Chromebook, Windows, Mac, or Linux — Chrome",
    steps: [
      <>
        Open <strong>Chrome</strong> and go to <strong>app.fcsia.com</strong>.
      </>,
      <>Select the install icon in the address bar, if Chrome shows one.</>,
      <>
        Otherwise open the{" "}
        <strong>
          three-dot menu → Cast, save, and share → Install page as app
        </strong>
        .
      </>,
      <>
        Follow the install prompts. On Chromebook, you can then pin IA App to
        the shelf.
      </>,
    ],
  },
] as const;

export default function PwaInstructionsPage() {
  return (
    <>
      <Head>
        <title>Add IA App to your device</title>
        <meta
          name="description"
          content="Platform-specific steps for adding IA App to your Home Screen, Dock, or desktop."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-2xl">
          <Button asChild variant="ghost" size="sm">
            <a href="https://app.fcsia.com/">Back to IA App</a>
          </Button>

          <header className="mt-8 flex items-start gap-4">
            <IaOrbitMark
              alt="IA App"
              width={48}
              height={48}
              className="size-12 shrink-0"
              priority
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Add IA App to your device
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Pick your device below. Always start from the new address,
                app.fcsia.com.
              </p>
            </div>
          </header>

          <div className="mt-6">
            <Button asChild>
              <a href="https://app.fcsia.com/">Open app.fcsia.com</a>
            </Button>
          </div>

          <section className="mt-10" aria-labelledby="platform-heading">
            <h2
              id="platform-heading"
              className="mb-3 text-sm font-medium text-muted-foreground"
            >
              Choose your device and browser
            </h2>
            <AccordionGroup type="single" collapsible className="w-full">
              {platforms.map((platform, index) => (
                <AccordionItem
                  key={platform.value}
                  value={platform.value}
                  index={index}
                >
                  <AccordionTrigger>{platform.title}</AccordionTrigger>
                  <AccordionContent>
                    <ol className="list-decimal space-y-2 pl-5 leading-relaxed marker:text-muted-foreground">
                      {platform.steps.map((step, stepIndex) => (
                        <li key={stepIndex}>{step}</li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </AccordionGroup>
          </section>

          <Separator className="mt-8" />
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Replacing an old Home Screen icon does not delete your IA App
            account or school information.
          </p>
        </div>
      </main>
    </>
  );
}
