import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "react-native";

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
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: "900", textAlign: "center" }}>
          Something went wrong.
        </Text>
        <Text style={{ marginTop: 8, textAlign: "center" }}>
          Close and reopen the app. No student data was sent from this error screen.
        </Text>
      </View>
    );
  }
}
