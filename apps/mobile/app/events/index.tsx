import { EventsView } from "@/features/calendar/EventsView";
import { Screen } from "@/components/screen";

export default function EventsScreen() {
  return (
    <Screen title="Events">
      <EventsView />
    </Screen>
  );
}
