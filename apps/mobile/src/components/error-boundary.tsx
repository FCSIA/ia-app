import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import { Button, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

type State = { error: Error | null };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep student data out of logs/crash payloads. Add sanitized Sentry here when configured.
    if (__DEV__) {
      console.error("[AppErrorBoundary]", error.message, info.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback onRetry={() => this.setState({ error: null })} />;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.xl,
        backgroundColor: color("background"),
      }}
    >
      <Txt variant="title" style={{ textAlign: "center" }}>Something went wrong</Txt>
      <Txt tone="muted" style={{ maxWidth: 360, textAlign: "center" }}>
        Try again. If the problem continues, close and reopen the app.
      </Txt>
      <Button title="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}
