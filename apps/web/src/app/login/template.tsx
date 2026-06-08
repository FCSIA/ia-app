import { PageTransition } from '@/components/layout/page-transition';

export default function LoginTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
