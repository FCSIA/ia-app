import { Bricolage_Grotesque, Familjen_Grotesk } from 'next/font/google';

// Bricolage Grotesque carries the interface; Familjen Grotesk's italic is
// reserved for the headline.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], axes: ['opsz'] });
const familjen = Familjen_Grotesk({ subsets: ['latin'], style: ['italic'], variable: '--font-login-display' });

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${bricolage.className} ${familjen.variable}`}>{children}</div>;
}
