import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

const STORAGE_KEY = 'agenda-flow-storage-v1';
const TABS = ['Agenda', 'Tasks', 'Notes', 'Profile'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORANGE = '#ff8c1a';
const CARD = '#141414';
const SOFT = '#999999';

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const pad = (value) => String(value).padStart(2, '0');

const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatReadableDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getMonthLabel = (date) =>
  date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const getMonthGrid = (focusedMonth) => {
  const year = focusedMonth.getFullYear();
  const month = focusedMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    const date = new Date(year, month - 1, day);
    cells.push({ date, currentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), currentMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const overflowDay = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, overflowDay), currentMonth: false });
  }

  return cells;
};

const initialProfile = {
  fullName: '',
  email: '',
  focusMode: 'Balanced',
  dayStart: '08:00',
};

export default function App() {
  const todayKey = toDateKey(new Date());
  const [loading, setLoading] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState('Agenda');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [profile, setProfile] = useState(initialProfile);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [agendaItems, setAgendaItems] = useState([]);

  const [profileDraft, setProfileDraft] = useState(initialProfile);
  const [taskDraft, setTaskDraft] = useState({ title: '', priority: 'Medium' });
  const [noteDraft, setNoteDraft] = useState({ title: '', content: '' });
  const [agendaDraft, setAgendaDraft] = useState({ title: '', time: '', details: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.profile) {
            setProfile(parsed.profile);
            setProfileDraft(parsed.profile);
          }
          if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
          if (Array.isArray(parsed.notes)) setNotes(parsed.notes);
          if (Array.isArray(parsed.agendaItems)) setAgendaItems(parsed.agendaItems);
        }
      } catch (error) {
        console.log('Storage load failed', error);
      } finally {
        setLoading(false);
        setHasHydrated(true);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ profile, tasks, notes, agendaItems })
    ).catch((error) => console.log('Storage save failed', error));
  }, [profile, tasks, notes, agendaItems, hasHydrated]);

  const monthCells = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth]);

  const itemsForSelectedDay = useMemo(
    () => agendaItems.filter((item) => item.dateKey === selectedDateKey).sort((a, b) => a.time.localeCompare(b.time)),
    [agendaItems, selectedDateKey]
  );

  const tasksForSelectedDay = useMemo(
    () => tasks.filter((task) => task.dateKey === selectedDateKey),
    [tasks, selectedDateKey]
  );

  const notesForSelectedDay = useMemo(
    () => notes.filter((note) => note.dateKey === selectedDateKey),
    [notes, selectedDateKey]
  );

  const completionRate = tasks.length
    ? Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100)
    : 0;

  const createProfile = () => {
    if (!profileDraft.fullName.trim() || !profileDraft.email.trim()) {
      Alert.alert('Profile required', 'Please enter your name and email to continue.');
      return;
    }

    setProfile({
      fullName: profileDraft.fullName.trim(),
      email: profileDraft.email.trim(),
      focusMode: profileDraft.focusMode.trim() || 'Balanced',
      dayStart: profileDraft.dayStart.trim() || '08:00',
    });
  };

  const addAgendaItem = () => {
    if (!agendaDraft.title.trim() || !agendaDraft.time.trim()) {
      Alert.alert('Missing info', 'Add a title and time for your agenda item.');
      return;
    }

    setAgendaItems((current) => [
      {
        id: createId(),
        title: agendaDraft.title.trim(),
        time: agendaDraft.time.trim(),
        details: agendaDraft.details.trim(),
        dateKey: selectedDateKey,
      },
      ...current,
    ]);

    setAgendaDraft({ title: '', time: '', details: '' });
    setActiveTab('Agenda');
  };

  const addTask = () => {
    if (!taskDraft.title.trim()) {
      Alert.alert('Missing task', 'Enter a task title first.');
      return;
    }

    setTasks((current) => [
      {
        id: createId(),
        title: taskDraft.title.trim(),
        priority: taskDraft.priority,
        done: false,
        dateKey: selectedDateKey,
      },
      ...current,
    ]);

    setTaskDraft({ title: '', priority: 'Medium' });
    setActiveTab('Tasks');
  };

  const addNote = () => {
    if (!noteDraft.title.trim() || !noteDraft.content.trim()) {
      Alert.alert('Missing note', 'Add a title and note content.');
      return;
    }

    setNotes((current) => [
      {
        id: createId(),
        title: noteDraft.title.trim(),
        content: noteDraft.content.trim(),
        dateKey: selectedDateKey,
        updatedAt: new Date().toISOString(),
      },
      ...current,
    ]);

    setNoteDraft({ title: '', content: '' });
    setActiveTab('Notes');
  };

  const removeItem = (type, id) => {
    if (type === 'agenda') setAgendaItems((current) => current.filter((item) => item.id !== id));
    if (type === 'task') setTasks((current) => current.filter((item) => item.id !== id));
    if (type === 'note') setNotes((current) => current.filter((item) => item.id !== id));
  };

  const toggleTask = (id) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    );
  };

  const shiftMonth = (direction) => {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1)
    );
  };

  const renderCalendar = () => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Full Calendar</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.monthButton} onPress={() => shiftMonth(-1)}>
            <Text style={styles.monthButtonText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.monthButton} onPress={() => shiftMonth(1)}>
            <Text style={styles.monthButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.monthLabel}>{getMonthLabel(calendarMonth)}</Text>

      <View style={styles.weekdaysRow}>
        {DAYS.map((day) => (
          <Text key={day} style={styles.weekdayText}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {monthCells.map(({ date, currentMonth }) => {
          const dateKey = toDateKey(date);
          const isSelected = dateKey === selectedDateKey;
          const agendaCount = agendaItems.filter((item) => item.dateKey === dateKey).length;
          const taskCount = tasks.filter((item) => item.dateKey === dateKey && !item.done).length;
          const noteCount = notes.filter((item) => item.dateKey === dateKey).length;
          const dotCount = Math.min(agendaCount + taskCount + noteCount, 3);

          return (
            <TouchableOpacity
              key={dateKey}
              style={[
                styles.calendarCell,
                !currentMonth && styles.calendarCellMuted,
                isSelected && styles.calendarCellSelected,
              ]}
              onPress={() => {
                setSelectedDateKey(dateKey);
                setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
              }}
            >
              <Text style={[styles.calendarNumber, !currentMonth && styles.mutedText, isSelected && styles.calendarNumberSelected]}>
                {date.getDate()}
              </Text>
              <View style={styles.dotRow}>
                {Array.from({ length: dotCount }).map((_, index) => (
                  <View key={`${dateKey}-${index}`} style={styles.dot} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderOverview = () => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Daily Overview</Text>
      <Text style={styles.dateHeadline}>{formatReadableDate(selectedDateKey)}</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{itemsForSelectedDay.length}</Text>
          <Text style={styles.statLabel}>Agenda items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{tasksForSelectedDay.filter((task) => !task.done).length}</Text>
          <Text style={styles.statLabel}>Open tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{notesForSelectedDay.length}</Text>
          <Text style={styles.statLabel}>Notes</Text>
        </View>
      </View>
    </View>
  );

  const renderAgendaTab = () => (
    <>
      {renderCalendar()}
      {renderOverview()}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Agenda Item</Text>
        <TextInput
          style={styles.input}
          placeholder="Meeting, workout, deep work..."
          placeholderTextColor={SOFT}
          value={agendaDraft.title}
          onChangeText={(text) => setAgendaDraft((current) => ({ ...current, title: text }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Time (e.g. 09:30)"
          placeholderTextColor={SOFT}
          value={agendaDraft.time}
          onChangeText={(text) => setAgendaDraft((current) => ({ ...current, time: text }))}
        />
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Details or context"
          placeholderTextColor={SOFT}
          multiline
          value={agendaDraft.details}
          onChangeText={(text) => setAgendaDraft((current) => ({ ...current, details: text }))}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={addAgendaItem}>
          <Text style={styles.primaryButtonText}>Save agenda item</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Agenda for the Day</Text>
        {itemsForSelectedDay.length === 0 ? (
          <Text style={styles.emptyText}>No agenda items yet for this date.</Text>
        ) : (
          itemsForSelectedDay.map((item) => (
            <View key={item.id} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <View style={styles.flexOne}>
                  <Text style={styles.listTitle}>{item.title}</Text>
                  <Text style={styles.listMeta}>{item.time}</Text>
                  {!!item.details && <Text style={styles.listBody}>{item.details}</Text>}
                </View>
                <TouchableOpacity onPress={() => removeItem('agenda', item.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderTasksTab = () => (
    <>
      {renderOverview()}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Track Tasks</Text>
        <TextInput
          style={styles.input}
          placeholder="What needs to get done?"
          placeholderTextColor={SOFT}
          value={taskDraft.title}
          onChangeText={(text) => setTaskDraft((current) => ({ ...current, title: text }))}
        />

        <View style={styles.priorityRow}>
          {['Low', 'Medium', 'High'].map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.priorityButton,
                taskDraft.priority === level && styles.priorityButtonActive,
              ]}
              onPress={() => setTaskDraft((current) => ({ ...current, priority: level }))}
            >
              <Text
                style={[
                  styles.priorityButtonText,
                  taskDraft.priority === level && styles.priorityButtonTextActive,
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={addTask}>
          <Text style={styles.primaryButtonText}>Add task for selected day</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Tasks for {selectedDateKey}</Text>
          <Text style={styles.completionText}>{completionRate}% complete overall</Text>
        </View>

        {tasksForSelectedDay.length === 0 ? (
          <Text style={styles.emptyText}>No tasks set for this day.</Text>
        ) : (
          tasksForSelectedDay.map((task) => (
            <View key={task.id} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.taskRow} onPress={() => toggleTask(task.id)}>
                  <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
                    <Text style={styles.checkboxText}>{task.done ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={[styles.listTitle, task.done && styles.doneText]}>{task.title}</Text>
                    <Text style={styles.listMeta}>{task.priority} priority</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeItem('task', task.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderNotesTab = () => (
    <>
      {renderOverview()}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Capture Notes</Text>
        <TextInput
          style={styles.input}
          placeholder="Note title"
          placeholderTextColor={SOFT}
          value={noteDraft.title}
          onChangeText={(text) => setNoteDraft((current) => ({ ...current, title: text }))}
        />
        <TextInput
          style={[styles.input, styles.multilineInputLarge]}
          placeholder="Write your note..."
          placeholderTextColor={SOFT}
          multiline
          value={noteDraft.content}
          onChangeText={(text) => setNoteDraft((current) => ({ ...current, content: text }))}
        />
        <TouchableOpacity style={styles.primaryButton} onPress={addNote}>
          <Text style={styles.primaryButtonText}>Save note to selected day</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Notes for {selectedDateKey}</Text>
        {notesForSelectedDay.length === 0 ? (
          <Text style={styles.emptyText}>No notes for this day yet.</Text>
        ) : (
          notesForSelectedDay.map((note) => (
            <View key={note.id} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <View style={styles.flexOne}>
                  <Text style={styles.listTitle}>{note.title}</Text>
                  <Text style={styles.listMeta}>
                    Updated {new Date(note.updatedAt).toLocaleString('en-US')}
                  </Text>
                  <Text style={styles.listBody}>{note.content}</Text>
                </View>
                <TouchableOpacity onPress={() => removeItem('note', note.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderProfileTab = () => (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Your Profile</Text>
      <View style={styles.profileBadge}>
        <Text style={styles.profileBadgeText}>
          {profile.fullName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join('') || 'AF'}
        </Text>
      </View>

      <Text style={styles.profileValue}>{profile.fullName || 'Create your profile to begin'}</Text>
      <Text style={styles.profileMeta}>{profile.email}</Text>

      <View style={styles.profileGrid}>
        <View style={styles.profileMetric}>
          <Text style={styles.profileMetricNumber}>{agendaItems.length}</Text>
          <Text style={styles.profileMetricLabel}>Agenda items</Text>
        </View>
        <View style={styles.profileMetric}>
          <Text style={styles.profileMetricNumber}>{tasks.length}</Text>
          <Text style={styles.profileMetricLabel}>Tasks tracked</Text>
        </View>
        <View style={styles.profileMetric}>
          <Text style={styles.profileMetricNumber}>{notes.length}</Text>
          <Text style={styles.profileMetricLabel}>Notes saved</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor={SOFT}
        value={profileDraft.fullName}
        onChangeText={(text) => setProfileDraft((current) => ({ ...current, fullName: text }))}
      />

      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor={SOFT}
        value={profileDraft.email}
        onChangeText={(text) => setProfileDraft((current) => ({ ...current, email: text }))}
        autoCapitalize="none"
      />

      <Text style={styles.fieldLabel}>Focus mode</Text>
      <TextInput
        style={styles.input}
        placeholder="Balanced, Productivity, Planning..."
        placeholderTextColor={SOFT}
        value={profileDraft.focusMode}
        onChangeText={(text) => setProfileDraft((current) => ({ ...current, focusMode: text }))}
      />

      <Text style={styles.fieldLabel}>Day starts at</Text>
      <TextInput
        style={styles.input}
        placeholder="08:00"
        placeholderTextColor={SOFT}
        value={profileDraft.dayStart}
        onChangeText={(text) => setProfileDraft((current) => ({ ...current, dayStart: text }))}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={createProfile}>
        <Text style={styles.primaryButtonText}>{profile.fullName ? 'Update profile' : 'Create profile'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          Alert.alert('Clear all data?', 'This will remove your profile, tasks, notes, and agenda items.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: async () => {
                setProfile(initialProfile);
                setProfileDraft(initialProfile);
                setTasks([]);
                setNotes([]);
                setAgendaItems([]);
                await AsyncStorage.removeItem(STORAGE_KEY);
              },
            },
          ]);
        }}
      >
        <Text style={styles.secondaryButtonText}>Reset app data</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <ExpoStatusBar style="light" />
        <View style={styles.centeredFill}>
          <Text style={styles.brandTitle}>Agenda Flow</Text>
          <Text style={styles.emptyText}>Loading your workspace…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const profileCreated = !!profile.fullName && !!profile.email;

  if (!profileCreated) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <ExpoStatusBar style="light" />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Android-ready organizer app</Text>
            <Text style={styles.brandTitle}>Agenda Flow</Text>
            <Text style={styles.heroText}>
              Create your profile first, then manage your agenda, track tasks, and take notes with a full black-and-orange calendar workspace.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create Profile</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={SOFT}
              value={profileDraft.fullName}
              onChangeText={(text) => setProfileDraft((current) => ({ ...current, fullName: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={SOFT}
              value={profileDraft.email}
              onChangeText={(text) => setProfileDraft((current) => ({ ...current, email: text }))}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Focus mode"
              placeholderTextColor={SOFT}
              value={profileDraft.focusMode}
              onChangeText={(text) => setProfileDraft((current) => ({ ...current, focusMode: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Day starts at (08:00)"
              placeholderTextColor={SOFT}
              value={profileDraft.dayStart}
              onChangeText={(text) => setProfileDraft((current) => ({ ...current, dayStart: text }))}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={createProfile}>
              <Text style={styles.primaryButtonText}>Start using the app</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ExpoStatusBar style="light" />
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.heroEyebrow}>Welcome back</Text>
          <Text style={styles.headerTitle}>{profile.fullName}</Text>
        </View>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>{activeTab}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {activeTab === 'Agenda' && renderAgendaTab()}
        {activeTab === 'Tasks' && renderTasksTab()}
        {activeTab === 'Notes' && renderNotesTab()}
        {activeTab === 'Profile' && renderProfileTab()}
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    padding: 16,
    paddingBottom: 120,
  },
  centeredFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#0d0d0d',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#222222',
    marginBottom: 16,
  },
  heroEyebrow: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroText: {
    color: '#d0d0d0',
    fontSize: 15,
    lineHeight: 22,
  },
  appHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  headerPill: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2c2c2c',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerPillText: {
    color: ORANGE,
    fontWeight: '700',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#232323',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  dateHeadline: {
    color: '#f2f2f2',
    fontSize: 15,
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#0c0c0c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  multilineInputLarge: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#363636',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#f3f3f3',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexOne: {
    flex: 1,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  monthButtonText: {
    color: ORANGE,
    fontSize: 20,
    fontWeight: '700',
  },
  monthLabel: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.2%',
    textAlign: 'center',
    color: '#c7c7c7',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calendarCell: {
    width: '14.2%',
    aspectRatio: 0.9,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  calendarCellMuted: {
    opacity: 0.5,
  },
  calendarCellSelected: {
    backgroundColor: '#2a1400',
    borderColor: ORANGE,
  },
  calendarNumber: {
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 6,
  },
  calendarNumberSelected: {
    color: ORANGE,
  },
  mutedText: {
    color: '#7d7d7d',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: ORANGE,
    marginHorizontal: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#242424',
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  statNumber: {
    color: ORANGE,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#d7d7d7',
    fontSize: 12,
  },
  listCard: {
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252525',
    padding: 14,
    marginTop: 10,
  },
  listTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  listMeta: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  listBody: {
    color: '#dadada',
    lineHeight: 20,
    paddingRight: 12,
  },
  emptyText: {
    color: '#bdbdbd',
    lineHeight: 22,
  },
  deleteText: {
    color: '#ff5a5a',
    fontWeight: '700',
    paddingLeft: 16,
  },
  priorityRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  priorityButton: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  priorityButtonActive: {
    backgroundColor: '#2a1400',
    borderColor: ORANGE,
  },
  priorityButtonText: {
    color: '#d2d2d2',
    fontWeight: '700',
  },
  priorityButtonTextActive: {
    color: ORANGE,
  },
  completionText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: ORANGE,
  },
  checkboxText: {
    color: '#000000',
    fontWeight: '900',
  },
  doneText: {
    textDecorationLine: 'line-through',
    color: '#8a8a8a',
  },
  profileBadge: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: '#2a1400',
    borderWidth: 2,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  profileBadgeText: {
    color: ORANGE,
    fontSize: 24,
    fontWeight: '800',
  },
  profileValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  profileMeta: {
    color: '#d0d0d0',
    marginBottom: 16,
  },
  profileGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  profileMetric: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#252525',
    marginRight: 8,
  },
  profileMetricNumber: {
    color: ORANGE,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileMetricLabel: {
    color: '#d9d9d9',
    fontSize: 12,
  },
  fieldLabel: {
    color: '#d9d9d9',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 2,
  },
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: '#101010',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#242424',
    flexDirection: 'row',
    padding: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: '#2a1400',
  },
  tabText: {
    color: '#bdbdbd',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: ORANGE,
  },
});
