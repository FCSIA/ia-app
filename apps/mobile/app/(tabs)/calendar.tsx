import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { calendarApi } from '@/lib/api';
import { Card, Pill, Screen, TopBar } from '@/components/ui';
import type { CalendarEntry } from '@/types/api';
import { theme } from '@/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarScreen() {
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const startDate = format(startOfMonth(month), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(month), 'yyyy-MM-dd');

  const { data: entries = [] } = useQuery<CalendarEntry[]>({
    queryKey: ['calendar', startDate, endDate],
    queryFn: () => calendarApi.getEntries(startDate, endDate).then((response) => response.data),
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedEntries = selectedDay
    ? entries.filter((entry) => isSameDay(new Date(entry.startAt), selectedDay))
    : [];

  return (
    <Screen scroll>
      <TopBar title="Calendar" subtitle="School events and scheduled entries." />

      <Card style={styles.calendarCard}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth((current) => subMonths(current, 1))} style={styles.monthButton}>
            <ChevronLeft size={18} color={theme.colors.textSoft} />
          </Pressable>
          <Text style={styles.monthLabel}>{format(month, 'MMMM yyyy')}</Text>
          <Pressable onPress={() => setMonth((current) => addMonths(current, 1))} style={styles.monthButton}>
            <ChevronRight size={18} color={theme.colors.textSoft} />
          </Pressable>
        </View>

        <View style={styles.dayHeaderRow}>
          {DAY_LABELS.map((label) => (
            <Text key={label} style={styles.dayHeaderLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {days.map((day) => {
            const dayEntries = entries.filter((entry) => isSameDay(new Date(entry.startAt), day));
            const active = selectedDay ? isSameDay(day, selectedDay) : false;
            const currentMonth = day.getMonth() === month.getMonth();

            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => setSelectedDay(active ? null : day)}
                style={[
                  styles.dayCell,
                  !currentMonth && styles.dayCellMuted,
                  active && styles.dayCellActive,
                ]}
              >
                <View style={[styles.dayCircle, isToday(day) && styles.todayCircle]}>
                  <Text style={[styles.dayText, isToday(day) && styles.todayText]}>{format(day, 'd')}</Text>
                </View>
                {dayEntries.length > 0 ? (
                  <View style={styles.dotRow}>
                    <View style={styles.dot} />
                    {dayEntries.length > 1 ? <View style={styles.dot} /> : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {selectedDay ? (
        <Card style={styles.eventsCard}>
          <Text style={styles.eventsTitle}>{format(selectedDay, 'EEEE, MMMM d')}</Text>
          <View style={styles.stack}>
            {selectedEntries.length === 0 ? (
              <Text style={styles.emptyText}>No events on this day.</Text>
            ) : (
              selectedEntries.map((entry) => (
                <Card key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Pill label={(entry.tags?.[0] || 'event').replace(/_/g, ' ')} tone="accent" />
                  </View>
                  <Text style={styles.entryMeta}>{format(new Date(entry.startAt), 'h:mm a')}</Text>
                  {entry.location ? <Text style={styles.entryMeta}>{entry.location}</Text> : null}
                  {entry.description ? <Text style={styles.entryDescription}>{entry.description}</Text> : null}
                </Card>
              ))
            )}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    gap: 16,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  dayHeaderRow: {
    flexDirection: 'row',
  },
  dayHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 16,
  },
  dayCellMuted: {
    opacity: 0.32,
  },
  dayCellActive: {
    backgroundColor: theme.colors.accentSoft,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: theme.colors.accent,
  },
  dayText: {
    color: theme.colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  todayText: {
    color: '#ffffff',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
  },
  eventsCard: {
    gap: 12,
  },
  eventsTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stack: {
    gap: 10,
  },
  entryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    gap: 8,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  entryTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  entryMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  entryDescription: {
    color: theme.colors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
});
