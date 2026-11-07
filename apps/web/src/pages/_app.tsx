import type { AppProps } from "next/app";
import { Work_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "@/app/globals.css";
import { THEME_PROVIDER_PROPS } from "@/lib/custom-theme";
import { ThemeFavicon } from "@/components/ui/ia-orbit-mark";

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
});

export default function PagesApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider {...THEME_PROVIDER_PROPS}>
      <ThemeFavicon />
      <div className={`${workSans.variable} font-sans`}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}
