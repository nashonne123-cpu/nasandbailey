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
    urgency: 'Medium',
    reminder: '30 mins before',
    energy: 50,
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
      urgency: taskForm.urgency,
      reminder: taskForm.reminder,
      energy: Number(taskForm.energy),
      status: taskForm.status,
      notes: taskForm.notes || '',
      updatedAt: new Date().toISOString()
    };

    if (taskForm.id) {
      const docRef = doc(db, 'artifacts', appId
      )}
    </div>
  );
}
