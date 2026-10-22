import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ImageOff } from "lucide-react-native";
import { Image } from "expo-image";
import { Sheet, TextField, ListRow, Txt } from "@/components/ui";
import { spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { useStoredGifs } from "./use-stored-gifs";
import {
  searchSchoolGifs,
  SCHOOL_GIFS,
  type SchoolGif,
} from "~/apps/shared/chat/school-gifs";

const gifUrls = SCHOOL_GIFS.map((gif) => gif.url);

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
  const { color } = useTheme();
  const posters = useStoredGifs(gifUrls, open, true);
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
              posters.states.find((item) => item.sourceUrl === gif.url)?.url ? <Image
                source={{ uri: posters.states.find((item) => item.sourceUrl === gif.url)!.url! }}
                contentFit="contain"
                style={{ width: 80, height: 60 }}
              /> : <View style={{ width: 80, height: 60, alignItems: "center", justifyContent: "center" }}>
                {posters.states.find((item) => item.sourceUrl === gif.url)?.status === "error"
                  ? <ImageOff size={20} color={color("mutedForeground")} />
                  : <ActivityIndicator accessibilityLabel="Loading thumbnail" color={color("primary")} />}
              </View>
            }
            onPress={() => onSelect(gif)}
          />
        ))}
      </View>
    </Sheet>
  );
}
