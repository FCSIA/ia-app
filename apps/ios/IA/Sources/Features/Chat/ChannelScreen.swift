import SwiftUI

// MARK: - Channel screen

struct ChannelScreen: View {
    let clubId: String
    let channelId: String
    let channelNameFallback: String

    @Environment(AppState.self) private var appState
    @State private var viewModel: ChatViewModel?
    @State private var composerText = ""
    @State private var lastFollowedMessageID: String?
    @FocusState private var composerFocused: Bool

    var body: some View {
        Group {
            if let viewModel {
                self.content(viewModel)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .navigationTitle(self.viewModel?.channelTitle ?? self.channelNameFallback)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if self.viewModel == nil {
                let model = ChatViewModel(
                    clubId: clubId,
                    channelId: channelId,
                    channelNameFallback: channelNameFallback
                )
                self.viewModel = model
                if let client = appState.syncClient() {
                    model.start(client: client)
                }
            }
        }
        .onDisappear {
            self.viewModel?.stop()
        }
    }

    private func content(_ model: ChatViewModel) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    if model.canLoadOlder {
                        HStack {
                            Spacer()
                            if model.isLoadingOlder {
                                ProgressView()
                            } else {
                                Button("Load earlier messages") {
                                    if let client = appState.syncClient() {
                                        model.loadOlderIfNeeded(client: client)
                                    }
                                }
                                .buttonStyle(.borderless)
                                .font(.footnote)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 8)
                    }
                    ForEach(model.messages) { message in
                        MessageRowView(message: message) { token in
                            self.react(token, on: message.id, model: model)
                        } onPollVote: { optionId in
                            self.vote(optionId, messageId: message.id, model: model)
                        }
                        .id(message.id)
                    }
                    ForEach(model.optimisticEntries) { entry in
                        OptimisticRowView(entry: entry)
                            .id(entry.id)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
            }
            .defaultScrollAnchor(.bottom)
            .onChange(of: model.messages.last?.id) { _, newLastID in
                // Only follow the live edge; loading older history must not
                // yank the viewport to the newest message.
                guard let newLastID else { return }
                if newLastID != self.lastFollowedMessageID || self.lastFollowedMessageID == nil {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
                self.lastFollowedMessageID = newLastID
            }
            .onChange(of: model.optimisticEntries.count) { _, newCount in
                if newCount > 0 {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            ComposerBar(text: self.$composerText, focused: self.$composerFocused) {
                Task {
                    guard let client = appState.syncClient(), let model = viewModel else { return }
                    let outgoing = self.composerText
                    self.composerText = ""
                    await model.send(outgoing, client: client)
                }
            }
        }
        .safeAreaInset(edge: .top) { self.connectionBanner(model) }
        .alert(
            "Action failed",
            isPresented: Binding(
                get: { model.actionFailure != nil },
                set: {
                    if !$0 {
                        model.clearActionFailure()
                    }
                }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.actionFailure ?? "")
        }
    }

    private func connectionBanner(_ model: ChatViewModel) -> some View {
        // Surfaces live-connection health and read-only context; a dead
        // socket must never look like a quiet channel.
        VStack(spacing: 0) {
            if case .connected = self.appState.connectionStatus {} else {
                Label("Connection offline — messages will not update.", systemImage: "wifi.slash")
                    .font(.caption)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(.bar)
            }
            if let context = model.context, !context.viewerCanPost, model.messages.isEmpty == false {
                Text("You can read but not post in this channel.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(.bar)
            }
        }
    }

    private func react(_ token: QuickReaction, on messageId: String, model: ChatViewModel) {
        Task {
            guard let client = appState.syncClient() else { return }
            await model.toggleReaction(token, messageId: messageId, client: client)
        }
    }

    private func vote(_ optionId: String, messageId: String, model: ChatViewModel) {
        Task {
            guard let client = appState.syncClient() else { return }
            await model.votePoll(optionId: optionId, messageId: messageId, client: client)
        }
    }
}

// MARK: - Message row

struct MessageRowView: View {
    let message: MessageSummary
    var onReaction: (QuickReaction) -> Void
    var onPollVote: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            self.header
            self.bodyText
            self.attachments
            self.poll
            self.reactionsRow
            self.threadLine
        }
        .padding(.vertical, 5)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Text(self.message.author.displayName)
                .font(.callout.weight(.semibold))
            if self.message.isPinned {
                Image(systemName: "pin.fill")
                    .font(.caption2)
                    .foregroundStyle(.tint)
            }
            Text(self.message.createdAt ?? Date.distantPast, style: .time)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    @ViewBuilder
    private var bodyText: some View {
        if self.message.isDeleted {
            Text("Message deleted")
                .italic()
                .font(.callout)
                .foregroundStyle(.secondary)
        } else if !self.message.body.isEmpty {
            Group {
                if let markdown = message.bodyMarkdown,
                   let attributed = try? AttributedString(
                       markdown: markdown,
                       options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
                   )
                {
                    Text(attributed)
                } else {
                    Text(self.message.body)
                }
            }
            .font(.callout)
            .textSelection(.enabled)
        }
    }

    @ViewBuilder
    private var attachments: some View {
        if !self.message.attachments.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(self.message.attachments) { attachment in
                    if attachment.isImage, let url = URL(string: attachment.fileUrl) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFit()
                            case .empty:
                                RoundedRectangle(cornerRadius: 8).fill(.quaternary).frame(height: 120)
                            default:
                                RoundedRectangle(cornerRadius: 8).fill(.quaternary).frame(height: 60)
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        Label(attachment.fileName, systemImage: "paperclip")
                            .font(.caption)
                    }
                }
                if self.message.attachmentsTruncated {
                    Text("More attachments not shown")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    @ViewBuilder
    private var poll: some View {
        if let poll = message.poll {
            VStack(alignment: .leading, spacing: 4) {
                Text(poll.question).font(.callout.weight(.medium))
                ForEach(poll.options) { option in
                    Button {
                        self.onPollVote(option.id)
                    } label: {
                        HStack {
                            Image(systemName: option.votedByCurrentUser ? "largecircle.fill.circle" : "circle")
                            Text(option.label)
                            Spacer()
                            Text("\(option.count)")
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                        .font(.callout)
                    }
                    .buttonStyle(.borderless)
                }
                Text("\(poll.totalVotes) votes")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(8)
            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private var reactionsRow: some View {
        if !self.message.reactions.isEmpty || !self.message.isDeleted {
            HStack(spacing: 4) {
                ForEach(self.message.reactions) { reaction in
                    if let token = QuickReaction(emojiToken: reaction.emoji) {
                        Button {
                            self.onReaction(token)
                        } label: {
                            HStack(spacing: 2) {
                                Text(token.glyph)
                                Text(reaction.countIsCapped ? "\(reaction.count)+" : "\(reaction.count)")
                                    .monospacedDigit()
                            }
                            .font(.caption)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(
                                reaction.reactedByCurrentUser
                                    ? AnyShapeStyle(.tint.opacity(0.22))
                                    : AnyShapeStyle(.fill.quaternary),
                                in: Capsule()
                            )
                        }
                        .buttonStyle(.borderless)
                    }
                }
                Menu {
                    ForEach(QuickReaction.allCases) { token in
                        Button("\(token.glyph) \(token.rawValue)") {
                            self.onReaction(token)
                        }
                    }
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.caption)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(.fill.quaternary, in: Capsule())
                }
                .buttonStyle(.borderless)
            }
        }
    }

    @ViewBuilder
    private var threadLine: some View {
        if self.message.hasReplies, self.message.replyCount > 0 {
            HStack(spacing: 4) {
                Image(systemName: "text.bubble")
                    .font(.caption2)
                if self.message.replyCountIsExact {
                    Text("\(self.message.replyCount) replies")
                } else {
                    Text("\(self.message.replyCount)+ replies")
                }
                if let preview = message.latestReplyPreview, !preview.isDeleted {
                    Text(preview.body)
                        .lineLimit(1)
                        .foregroundStyle(.secondary)
                }
            }
            .font(.caption)
            .foregroundStyle(.tint)
            .padding(.top, 1)
        }
    }
}

struct OptimisticRowView: View {
    let entry: ChatViewModel.OptimisticEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(self.entry.failed ? "Failed to send" : "Sending…")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if !self.entry.failed {
                    Image(systemName: "clock")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Text(self.entry.body)
                .font(.callout)
                .opacity(self.entry.failed ? 1 : 0.65)
        }
        .padding(.vertical, 5)
    }
}

// MARK: - Composer

/// The slice's single custom Liquid Glass surface: a floating composer bar.
/// One element, so no GlassEffectContainer is required.
struct ComposerBar: View {
    @Binding var text: String
    var focused: FocusState<Bool>.Binding
    let onSend: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            TextField("Message", text: self.$text, axis: .vertical)
                .lineLimit(1 ... 5)
                .focused(self.focused)
                .submitLabel(.send)
                .onSubmit(self.onSend)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            Button(action: self.onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.tint)
            }
            .disabled(self.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .padding(.trailing, 6)
        }
        .glassEffect(.regular, in: .rect(cornerRadius: 20))
        .padding(.horizontal, 12)
        .padding(.bottom, 4)
    }
}
