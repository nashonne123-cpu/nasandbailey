import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  addDoc 
} from 'firebase/firestore';

// ==========================================
// 1. FIREBASE INITIALIZATION & CONFIG
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "demo-key",
      authDomain: "demo.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:demo"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = typeof __app_id !== 'undefined' ? __app_id : 'nas-bailey-accountability-hub';

const SCHEDULE_COLLECTION = 'schedules';
const GOALS_COLLECTION = 'goals';
const HISTORY_COLLECTION = 'history';
const NOTIFICATIONS_COLLECTION = 'notifications';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EMOJI_LIST = ['❤️', '🔥', '👏', '💪', '🎉', '👀'];

export default function App() {
  const [user, setUser] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState('Nas');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [themeMode, setThemeMode] = useState('dark');

  const [scheduleItems, setScheduleItems] = useState([]);
  const [goalsItems, setGoalsItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [activeCommentItem, setActiveCommentItem] = useState(null);
  const [commentText, setCommentText] = useState('');

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  
  const [taskForm, setTaskForm] = useState({
    id: null,
    user: 'Nas',
    day: 'Monday',
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    reminder: '30 mins before',
    energy: 10,
    status: 'In Progress',
    notes: ''
  });

  const [goalForm, setGoalForm] = useState({
    id: null,
    user: 'Nas',
    title: '',
    type: 'Short-Term',
    priority: 'Medium',
    progress: 0,
    expectedDate: '',
    reminder: '1 day before',
    notes: '',
    status: 'Active'
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setTaskForm(prev => ({ ...prev, user: currentUserProfile }));
    setGoalForm(prev => ({ ...prev, user: currentUserProfile }));
  }, [currentUserProfile]);

  useEffect(() => {
    if (!user) return;

    const scheduleRef = collection(db, 'artifacts', appId, 'public', 'data', SCHEDULE_COLLECTION);
    const unsubSchedule = onSnapshot(scheduleRef, (snapshot) => {
      setScheduleItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const goalsRef = collection(db, 'artifacts', appId, 'public', 'data', GOALS_COLLECTION);
    const unsubGoals = onSnapshot(goalsRef, (snapshot) => {
      setGoalsItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const historyRef = collection(db, 'artifacts', appId, 'public', 'data', HISTORY_COLLECTION);
    const unsubHistory = onSnapshot(historyRef, (snapshot) => {
      setHistoryItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const notifRef = collection(db, 'artifacts', appId, 'public', 'data', NOTIFICATIONS_COLLECTION);
    const unsubNotif = onSnapshot(notifRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });

    return () => {
      unsubSchedule();
      unsubGoals();
      unsubHistory();
      unsubNotif();
    };
  }, [user]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => n.targetUser === currentUserProfile && !n.read).length;
  }, [notifications, currentUserProfile]);

  const generateGoogleCalendarUrl = (item, isGoal = false) => {
    const title = encodeURIComponent(item.title);
    const details = encodeURIComponent(`${item.notes ? item.notes + '\n\n' : ''}Assigned to: ${item.user}`);
    let startIso = '';
    let endIso = '';

    if (isGoal) {
      const dateStr = item.expectedDate ? item.expectedDate.replace(/-/g, '') : new Date().toISOString().replace(/-|:|\.\d+/g, '').substring(0, 8);
      startIso = `${dateStr}T090000Z`;
      endIso = `${dateStr}T100000Z`;
    } else {
      const today = new Date();
      const currentDayIdx = today.getDay();
      const targetDayIdx = DAYS_OF_WEEK.indexOf(item.day) + 1;
      let diffDays = targetDayIdx - currentDayIdx;
      if (diffDays < 0) diffDays += 7;

      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diffDays);

      const [startHour, startMin] = (item.startTime || '09:00').split(':');
      const [endHour, endMin] = (item.endTime || '10:00').split(':');

      targetDate.setHours(parseInt(startHour, 10), parseInt(startMin, 10), 0);
      startIso = targetDate.toISOString().replace(/-|:|\.\d+/g, '');

      const endDate = new Date(targetDate);
      endDate.setHours(parseInt(endHour, 10), parseInt(endMin, 10), 0);
      endIso = endDate.toISOString().replace(/-|:|\.\d+/g, '');
    }

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startIso}/${endIso}`;
  };

  const createNotification = async (targetUser, title, body) => {
    try {
      const notifRef = collection(db, 'artifacts', appId, 'public', 'data', NOTIFICATIONS_COLLECTION);
      await addDoc(notifRef, {
        sender: currentUserProfile,
        targetUser,
        title,
        body,
        read: false,
        timestamp: Date.now(),
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleNudgePartner = async (item, isGoal = false) => {
    const partner = currentUserProfile === 'Nas' ? 'Bailey' : 'Nas';
    await createNotification(
      partner,
      `👋 ${currentUserProfile} nudged you!`,
      `Reminder to check on "${item.title}" (${isGoal ? 'Goal' : 'Task'})`
    );
  };

  const handleToggleReaction = async (item, emoji, isGoal = false) => {
    const collectionName = isGoal ? GOALS_COLLECTION : SCHEDULE_COLLECTION;
    const itemRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, item.id);
    const existingReactions = item.reactions || {};
    const currentUsers = existingReactions[emoji] || [];

    let updatedUsers = currentUsers.includes(currentUserProfile)
      ? currentUsers.filter(u => u !== currentUserProfile)
      : [...currentUsers, currentUserProfile];

    await updateDoc(itemRef, { [`reactions.${emoji}`]: updatedUsers });
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    const taskData = {
      user: taskForm.user,
      day: taskForm.day,
      title: taskForm.title.trim(),
      startTime: taskForm.startTime,
      endTime: taskForm.endTime,
      reminder: taskForm.reminder,
      energy: Number(taskForm.energy),
      status: taskForm.status,
      notes: taskForm.notes || '',
      updatedAt: new Date().toISOString()
    };

    if (taskForm.id) {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', SCHEDULE_COLLECTION, taskForm.id);
      await updateDoc(docRef, taskData);
    } else {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', SCHEDULE_COLLECTION);
      await addDoc(colRef, { ...taskData, reactions: {}, comments: [], createdAt: new Date().toISOString() });
    }

    setIsTaskModalOpen(false);
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.title.trim()) return;

    const goalData = {
      user: goalForm.user,
      title: goalForm.title.trim(),
      type: goalForm.type,
      priority: goalForm.priority,
      progress: Number(goalForm.progress),
      expectedDate: goalForm.expectedDate || '',
      reminder: goalForm.reminder,
      notes: goalForm.notes || '',
      status: Number(goalForm.progress) === 100 ? 'Completed' : 'Active',
      updatedAt: new Date().toISOString()
    };

    if (goalForm.id) {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', GOALS_COLLECTION, goalForm.id);
      await updateDoc(docRef, goalData);
    } else {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', GOALS_COLLECTION);
      await addDoc(colRef, { ...goalData, reactions: {}, comments: [], createdAt: new Date().toISOString() });
    }

    setIsGoalModalOpen(false);
  };

  const isNas = currentUserProfile === 'Nas';
  const themeBg = themeMode === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardBg = themeMode === 'dark' ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className={`min-h-screen ${themeBg} font-sans transition-colors duration-300`}>
      {/* HEADER */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${themeMode === 'dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'} px-4 py-3`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-rose-500 text-white shadow-lg">
              ❤️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-300 to-rose-400 bg-clip-text text-transparent">
                  Nas & Beautiful Bailey
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  ✓ Saved to Cloud
                </span>
              </div>
              <p className="text-xs text-slate-400">Shared Accountability Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-full border ${themeMode === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'} flex items-center gap-1`}>
              <button
                onClick={() => setCurrentUserProfile('Nas')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold ${isNas ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                Nas
              </button>
              <button
                onClick={() => setCurrentUserProfile('Bailey')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold ${!isNas ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
              >
                Beautiful Bailey
              </button>
            </div>

            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  !
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'schedule', label: 'Weekly Schedule' },
            { id: 'goals', label: 'Goals Tracker' },
            { id: 'notifications', label: 'Notifications', badge: unreadCount }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? isNas ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' : 'border-rose-500 text-rose-400 bg-rose-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label} {tab.badge > 0 && <span className="ml-1 text-rose-500 font-bold">(!)</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-3xl border ${cardBg}`}>
              <h2 className="text-2xl font-bold">
                Welcome back, <span className={isNas ? 'text-indigo-400' : 'text-rose-400'}>{currentUserProfile === 'Bailey' ? 'Beautiful Bailey' : 'Nas'}</span>!
              </h2>
              <p className="text-xs text-slate-400 mt-1">Cross-post tasks, share comments, and keep calendars synchronized.</p>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Weekly Schedule</h2>
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${isNas ? 'bg-indigo-600' : 'bg-rose-500'}`}
              >
                + Add Task
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {DAYS_OF_WEEK.map(day => {
                const dayTasks = scheduleItems.filter(t => t.day === day);
                return (
                  <div key={day} className={`rounded-2xl border ${cardBg} p-4 space-y-4`}>
                    <h3 className="font-bold border-b border-slate-800 pb-2">{day}</h3>
                    <div className="space-y-3">
                      {dayTasks.map(task => (
                        <div key={task.id} className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                          <div className="flex justify-between">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${task.user === 'Nas' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {task.user}
                            </span>
                            <div className="flex gap-2">
                              <button onClick={() => handleNudgePartner(task)} className="text-amber-400 text-xs">👋</button>
                              <a href={generateGoogleCalendarUrl(task)} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-xs">📅</a>
                            </div>
                          </div>
                          <h4 className="text-xs font-bold text-slate-200">{task.title}</h4>
                          <div className="text-[10px] text-slate-400">🕒 {task.startTime} - {task.endTime}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Goals Tracker</h2>
              <button
                onClick={() => setIsGoalModalOpen(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${isNas ? 'bg-indigo-600' : 'bg-rose-500'}`}
              >
                + Add Goal
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['Nas', 'Bailey'].map(u => (
                <div key={u} className={`p-6 rounded-3xl border ${cardBg} space-y-4`}>
                  <h3 className="font-bold text-lg">{u}'s Goals</h3>
                  {goalsItems.filter(g => g.user === u).map(goal => (
                    <div key={goal.id} className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
                      <div className="flex justify-between">
                        <h4 className="text-sm font-bold">{goal.title}</h4>
                        <a href={generateGoogleCalendarUrl(goal, true)} target="_blank" rel="noopener noreferrer" className="text-emerald-400 text-xs">📅</a>
                      </div>
                      <div className="text-xs text-emerald-400 font-bold">{goal.progress}%</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className={`w-full max-w-md p-6 rounded-3xl border ${cardBg} space-y-4`}>
            <h3 className="text-lg font-bold">Add Task</h3>
            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Task Title"
                value={taskForm.title}
                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100"
              />
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                <button type="submit" className="px-5 py-2 font-bold text-white bg-indigo-600 rounded-xl">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GOAL */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className={`w-full max-w-md p-6 rounded-3xl border ${cardBg} space-y-4`}>
            <h3 className="text-lg font-bold">Add Goal</h3>
            <form onSubmit={handleSaveGoal} className="space-y-3 text-xs">
              <input
                type="text"
                required
                placeholder="Goal Title"
                value={goalForm.title}
                onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-100"
              />
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsGoalModalOpen(false)} className="px-4 py-2 text-slate-400">Cancel</button>
                <button type="submit" className="px-5 py-2 font-bold text-white bg-purple-600 rounded-xl">Save Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}