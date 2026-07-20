import { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePickerNative, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react-native";
import { Button, TextField, Txt } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

type DateTimePickerProps = {
  value?: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "time" | "datetime";
  placeholder?: string;
  minimumDate?: Date;
};

export function DateTimePicker({
  value,
  onChange,
  mode = "date",
  placeholder = "Select date",
  minimumDate,
}: DateTimePickerProps) {
  const [show, setShow] = useState(false);
  const { color } = useTheme();

  const onChangeNative = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setShow(false);
    if (selectedDate) onChange(selectedDate);
  };

  const isTimeOnly = mode === "time";
  const formattedValue = value
    ? format(value, isTimeOnly ? "h:mm a" : mode === "datetime" ? "MMM d, yyyy h:mm a" : "MMM d, yyyy")
    : "";

  if (Platform.OS === "ios") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, gap: spacing.sm }}>
        {value === undefined && (
          <Button
            title={placeholder}
            variant="tertiary"
            icon={isTimeOnly ? Clock : CalendarIcon}
            onPress={() => onChange(new Date())}
            style={{ alignSelf: "flex-start" }}
          />
        )}
        {(value !== undefined || show) && (
          <DateTimePickerNative
            value={value || new Date()}
            mode={mode}
            display="compact"
            minimumDate={minimumDate}
            onChange={onChangeNative}
            style={{ flex: 1 }}
          />
        )}
      </View>
    );
  }

  // Android
  return (
    <View>
      <Button
        title={formattedValue || placeholder}
        variant="tertiary"
        icon={isTimeOnly ? Clock : CalendarIcon}
        onPress={() => setShow(true)}
        style={{ justifyContent: "flex-start", minHeight: 48 }}
      />
      {show && (
        <DateTimePickerNative
          value={value || new Date()}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          onChange={onChangeNative}
        />
      )}
    </View>
  );
}
