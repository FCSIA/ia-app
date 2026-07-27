import { EventsView } from "@/features/calendar/EventsView";
import { Screen } from "@/components/screen";

export default function EventsScreen() {
  return (
    <Screen title="Events" contentContainerStyle={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
      <EventsView />
    </Screen>
  );
}
