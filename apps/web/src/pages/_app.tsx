import { THEME_NAMES } from "~/packages/design-tokens/src/color";
import type { AppProps } from "next/app";
import { Work_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "@/app/globals.css";
import { ThemeFavicon } from "@/components/ui/ia-orbit-mark";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
});

export default function PagesApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      themes={[...THEME_NAMES, "system"]}
    >
      <ThemeFavicon />
      <div className={`${workSans.variable} font-sans`}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}
