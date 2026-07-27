export type ChatMentionSuggestion = {
  token: string;
  label: string;
  displayText: string;
  detail?: string;
};

export function mentionInsertion(suggestion: ChatMentionSuggestion) {
  return {
    text: suggestion.displayText,
    url: `user://${suggestion.token}`,
  };
}
