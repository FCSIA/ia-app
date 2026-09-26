import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Sheet, TextField, ListRow, Txt } from "@/components/ui";
import { spacing } from "@/lib/tokens";
import {
  searchSchoolGifs,
  type SchoolGif,
} from "~/apps/shared/chat/school-gifs";

export function SchoolGifPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: SchoolGif) => void;
}) {
  const [query, setQuery] = useState("");
  const gifs = searchSchoolGifs(query);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Choose a GIF"
      scrollable
      snapPoints={["75%"]}
    >
      <View style={{ gap: spacing.sm }}>
        <Txt variant="caption" tone="muted">
          Reaction GIFs from Tenor, selected for school. Choose one to add to
          your message.
        </Txt>
        <TextField
          accessibilityLabel="Search school GIFs"
          placeholder="Search GIFs…"
          value={query}
          onChangeText={setQuery}
        />
        {gifs.length === 0 ? (
          <Txt>No GIFs found. Try “study” or “celebrate”.</Txt>
        ) : null}
        {gifs.map((gif) => (
          <ListRow
            key={gif.id}
            title={gif.label}
            subtitle={gif.category}
            leading={
              <Image
                source={{ uri: gif.poster }}
                contentFit="contain"
                style={{ width: 80, height: 60 }}
              />
            }
            onPress={() => onSelect(gif)}
          />
        ))}
      </View>
    </Sheet>
  );
}
