import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { calendarApi } from '@/lib/api';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, startOfWeek, endOfWeek, isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react-native';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: entries = [] } = useQuery({
    queryKey: ['calendar', startDate, endDate],
    queryFn: () => calendarApi.getEntries(startDate, endDate).then((r) => r.data),
  });

  const calStart = startOfWeek(startOfMonth(currentMonth));
  const calEnd = endOfWeek(endOfMonth(currentMonth));
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    (entries as any[]).filter((e) => isSameDay(new Date(e.startAt), day));

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <ChevronLeft size={20} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <ChevronRight size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {DAYS.map((d) => (
          <Text key={d} style={styles.dayHeader}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const today = isToday(day);

          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[styles.dayCell, !isCurrentMonth && styles.dayCellOtherMonth]}
              onPress={() => setSelectedDay(selectedDay && isSameDay(day, selectedDay) ? null : day)}
            >
              <View style={[
                styles.dayNum,
                today && styles.dayNumToday,
                isSelected && !today && styles.dayNumSelected,
              ]}>
                <Text style={[
                  styles.dayNumText,
                  today && styles.dayNumTextToday,
                  isSelected && !today && styles.dayNumTextSelected,
                ]}>
                  {format(day, 'd')}
                </Text>
              </View>
              {dayEvents.length > 0 && (
                <View style={styles.dot} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day events */}
      {selectedDay && (
        <View style={styles.eventList}>
          <Text style={styles.eventListTitle}>{format(selectedDay, 'EEEE, MMMM d')}</Text>
          {selectedEvents.length === 0 ? (
            <Text style={styles.noEvents}>No events on this day</Text>
          ) : (
            selectedEvents.map((e: any) => (
              <View key={e.id} style={styles.eventCard}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                {e.description && <Text style={styles.eventDesc} numberOfLines={2}>{e.description}</Text>}
                <View style={styles.eventMeta}>
                  <Text style={styles.eventTime}>
                    {format(new Date(e.startAt), 'h:mm a')}
                    {e.endAt && ` – ${format(new Date(e.endAt), 'h:mm a')}`}
                  </Text>
                  {e.location && (
                    <View style={styles.locationRow}>
                      <MapPin size={11} color="#9ca3af" />
                      <Text style={styles.locationText}>{e.location}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { padding: 8, backgroundColor: '#f3f4f6', borderRadius: 10 },
  monthLabel: { fontSize: 17, fontWeight: '700', color: '#111827' },
  dayHeaders: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9ca3af', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  dayCellOtherMonth: { opacity: 0.35 },
  dayNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayNumToday: { backgroundColor: '#2563eb' },
  dayNumSelected: { backgroundColor: '#dbeafe' },
  dayNumText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dayNumTextToday: { color: '#fff' },
  dayNumTextSelected: { color: '#1d4ed8' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2563eb', marginTop: 2 },
  eventList: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  eventListTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  noEvents: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  eventCard: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#2563eb',
  },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a8a' },
  eventDesc: { fontSize: 12, color: '#3b82f6', marginTop: 2 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  eventTime: { fontSize: 12, color: '#6b7280' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 12, color: '#9ca3af' },
});
