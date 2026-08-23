import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var username = ""
    @State private var password = ""
    @State private var submitting = false
    @State private var errorMessage: String?
    @FocusState private var passwordFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section("Innovation Academy") {
                    TextField("Student ID", text: self.$username)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .textContentType(.username)
                    SecureField("Password", text: self.$password)
                        .textContentType(.password)
                        .focused(self.$passwordFocused)
                        .submitLabel(.go)
                        .onSubmit { Task { await self.submit() } }
                }
                Section {
                    Button {
                        Task { await self.submit() }
                    } label: {
                        if self.submitting {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(self.submitting || self.username.isEmpty || self.password.isEmpty)
                }
            }
            .navigationTitle("Sign In")
            .alert(
                "Sign-in failed",
                isPresented: Binding(
                    get: { self.errorMessage != nil },
                    set: {
                        if !$0 {
                            self.errorMessage = nil
                        }
                    }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(self.errorMessage ?? "")
            }
        }
    }

    private func submit() async {
        guard !self.submitting else { return }
        self.submitting = true
        self.errorMessage = nil
        defer { submitting = false }
        do {
            try await self.appState.signIn(username: self.username.trimmingCharacters(in: .whitespaces), password: self.password)
        } catch {
            self.errorMessage = error.localizedDescription
            self.passwordFocused = true
        }
    }
}
