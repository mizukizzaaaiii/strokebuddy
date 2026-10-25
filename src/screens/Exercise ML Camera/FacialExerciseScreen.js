import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  AppState,
} from 'react-native';

import {
  Camera,
  useFrameProcessor,
  useCameraDevice,
  VisionCameraProxy,
  runAtTargetFps,
} from 'react-native-vision-camera';

import { Worklets } from 'react-native-worklets-core';
import { useIsFocused } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const EXERCISE_DATA_PREFIX = 'strokebuddy_exercise_data_';
const NOTIFICATION_SETTINGS_PREFIX = 'strokebuddy_notification_settings_';
const NOTIFICATION_MILESTONES_PREFIX = 'strokebuddy_recovery_milestones_';

const EXERCISES = [
  {
    id: 'smile',
    title: 'Gentle Smile',
    description: 'Gently lift both corners of your mouth.',
    duration: 3,
    icon: 'happy-outline',
  },
  {
    id: 'lip_round',
    title: 'Lip Rounding',
    description: 'Gently round your lips.',
    duration: 3,
    icon: 'ellipse-outline',
  },
  {
    id: 'lip_close',
    title: 'Lip Closure',
    description: 'Gently bring your lips together.',
    duration: 3,
    icon: 'remove-outline',
  },
  {
    id: 'cheek',
    title: 'Cheek Activation',
    description: 'Gently puff your cheeks if comfortable.',
    duration: 3,
    icon: 'radio-button-on-outline',
  },
  {
    id: 'relax',
    title: 'Facial Relaxation',
    description: 'Relax your face completely.',
    duration: 3,
    icon: 'leaf-outline',
  },
];

const FACIAL_EXERCISE_COUNT = EXERCISES.length;

const NOTIFICATION_DEFAULTS = {
  medReminders: true,
  caregiverMessages: true,
  exerciseReminders: true,
  recoveryMilestones: true,
};

const RECOVERY_MILESTONES = [3, 7, 14, 30];

// How long (ms) without a fresh face reading before we treat the signal as lost
const SIGNAL_STALE_MS = 1500;
// Number of relaxed-face samples used for the one-time baseline
const CALIBRATION_SAMPLE_COUNT = 8;
// Frame processor rate sent to JS
const FACE_FPS = 8;

// Show notifications while app is in foreground (set once, not per mount)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function getStorageKey(accountId) {
  return `${EXERCISE_DATA_PREFIX}${accountId || 'default_patient'}`;
}

function getNotificationSettingsKey(accountId) {
  return `${NOTIFICATION_SETTINGS_PREFIX}${accountId || 'default_patient'}`;
}

function getMilestoneStorageKey(accountId) {
  return `${NOTIFICATION_MILESTONES_PREFIX}${accountId || 'default_patient'}`;
}

// Local-time dates (toISOString is UTC and breaks streaks around midnight)
function toLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getToday() {
  return toLocalDateString(new Date());
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
}

function createDefaultData() {
  return {
    version: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    totalCompletedSessions: 0,
    exercises: {
      facial: { sessions: [], todayCount: 0, completedToday: false },
      breathing: { sessions: [], todayCount: 0, completedToday: false },
      pt: { sessions: [], todayCount: 0, completedToday: false },
    },
    sessions: [],
  };
}

async function loadExerciseData(accountId) {
  const key = getStorageKey(accountId);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return createDefaultData();
    }

    const parsed = JSON.parse(raw);
    const defaults = createDefaultData();

    return {
      ...defaults,
      ...parsed,
      exercises: {
        ...defaults.exercises,
        ...(parsed?.exercises || {}),
        facial: {
          ...defaults.exercises.facial,
          ...(parsed?.exercises?.facial || {}),
        },
        breathing: {
          ...defaults.exercises.breathing,
          ...(parsed?.exercises?.breathing || {}),
        },
        pt: {
          ...defaults.exercises.pt,
          ...(parsed?.exercises?.pt || {}),
        },
      },
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
    };
  } catch (error) {
    console.log('Facial exercise data load error:', error);
    return createDefaultData();
  }
}

async function getPatientNotificationSettings(accountId) {
  try {
    const raw = await AsyncStorage.getItem(
      getNotificationSettingsKey(accountId)
    );
    if (!raw) {
      return NOTIFICATION_DEFAULTS;
    }
    const parsed = JSON.parse(raw);
    return { ...NOTIFICATION_DEFAULTS, ...(parsed || {}) };
  } catch (error) {
    console.log('Notification settings load error:', error);
    return NOTIFICATION_DEFAULTS;
  }
}

async function hasNotificationPermission() {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return (
      permissions?.granted === true ||
      permissions?.ios?.status ===
        Notifications.IosAuthorizationStatus.AUTHORIZED ||
      permissions?.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.log('Notification permission check error:', error);
    return false;
  }
}

async function sendFacialCompletionNotification(accountId) {
  try {
    const settings = await getPatientNotificationSettings(accountId);
    if (!settings.exerciseReminders) return;
    if (!(await hasNotificationPermission())) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Facial Practice Complete',
        body: 'Nice work completing your facial movement practice.',
        sound: false,
        badge: 0,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch (error) {
    console.log('Facial completion notification error:', error);
  }
}

async function sendRecoveryMilestoneNotification(accountId, streak) {
  try {
    const settings = await getPatientNotificationSettings(accountId);
    if (!settings.recoveryMilestones) return;
    if (!RECOVERY_MILESTONES.includes(streak)) return;
    if (!(await hasNotificationPermission())) return;

    const milestoneKey = getMilestoneStorageKey(accountId);
    const raw = await AsyncStorage.getItem(milestoneKey);

    let sentMilestones = [];
    if (raw) {
      try {
        sentMilestones = JSON.parse(raw);
        if (!Array.isArray(sentMilestones)) sentMilestones = [];
      } catch {
        sentMilestones = [];
      }
    }

    if (sentMilestones.includes(streak)) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${streak}-Day Recovery Streak`,
        body: `You have completed your exercise routine for ${streak} days.`,
        sound: false,
        badge: 0,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });

    await AsyncStorage.setItem(
      milestoneKey,
      JSON.stringify([...sentMilestones, streak])
    );
  } catch (error) {
    console.log('Recovery milestone notification error:', error);
  }
}

function calculateNextStreak(data) {
  const today = getToday();
  const yesterday = getYesterday();
  const previousStreak = Number(data.currentStreak) || 0;

  let nextStreak;
  if (data.lastCompletedDate === today) {
    nextStreak = previousStreak;
  } else if (data.lastCompletedDate === yesterday) {
    nextStreak = previousStreak + 1;
  } else {
    nextStreak = 1;
  }

  return {
    streak: nextStreak,
    longestStreak: Math.max(Number(data.longestStreak) || 0, nextStreak),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

const EMPTY_BASELINE = {
  mouthWidthRatio: null,
  mouthOpeningRatio: null,
  smileScore: null,
  cheekWidthRatio: null,
};

export default function FacialExerciseScreen({ navigation, route }) {
  const name = route?.params?.name || '';
  const accountId = route?.params?.accountId || null;

  const device = useCameraDevice('front');
  const isFocused = useIsFocused();

  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active'
  );
  const [cameraPermission, setCameraPermission] = useState(null);

  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);

  const [holding, setHolding] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const [faceDetected, setFaceDetected] = useState(false);
  const [guidanceText, setGuidanceText] = useState(
    'Center your face in the camera.'
  );
  const [faceSignal, setFaceSignal] = useState(null);
  const [calibrated, setCalibrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // True while the routine should keep running on its own
  const [routineActive, setRoutineActive] = useState(false);

  // When false, the timer runs without needing face detection
  const [detectionEnabled, setDetectionEnabled] = useState(true);

  const exercise = EXERCISES[exerciseIndex];
  const progressText = `${exerciseIndex + 1} of ${FACIAL_EXERCISE_COUNT}`;

  // ---- refs (keep the face callback identity stable) ----
  const mountedRef = useRef(true);
  const lastFaceUpdateRef = useRef(0);
  const lastSignalAtRef = useRef(0);
  const baselineRef = useRef({ ...EMPTY_BASELINE });
  const calibrationSamplesRef = useRef([]);

  const startedRef = useRef(false);
  const calibratedRef = useRef(false);
  const exerciseIdRef = useRef(EXERCISES[0].id);
  const exerciseIndexRef = useRef(0);
  const signalOkRef = useRef(false);
  const finishedRef = useRef(false);
  const savingRef = useRef(false);
  const detectionEnabledRef = useRef(true);
  const finishCurrentExerciseRef = useRef(null);

  startedRef.current = started;
  calibratedRef.current = calibrated;
  exerciseIdRef.current = exercise.id;
  exerciseIndexRef.current = exerciseIndex;
  detectionEnabledRef.current = detectionEnabled;

  // ---- native plugin ----
  const faceLandmarkPlugin = useMemo(() => {
    try {
      return VisionCameraProxy.initFrameProcessorPlugin(
        'detectFaceLandmarks',
        {}
      );
    } catch (error) {
      console.log('Face plugin init error:', error);
      return null;
    }
  }, []);

  const pluginMissing = !faceLandmarkPlugin;

  useEffect(() => {
    if (pluginMissing) {
      console.warn('detectFaceLandmarks plugin not found');
      setDetectionEnabled(false);
      setGuidanceText('Camera detection is unavailable. Timer-only mode.');
    }
  }, [pluginMissing]);

  // ---- lifecycle ----
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  // Pause the hold if the screen loses focus or the app is backgrounded
  useEffect(() => {
    if (!isFocused || !appActive) {
      setHolding(false);
      setSeconds(0);
    }
  }, [isFocused, appActive]);

  // Check existing camera permission on mount
  useEffect(() => {
    try {
      const status = Camera.getCameraPermissionStatus();
      setCameraPermission(status);
    } catch (error) {
      console.log('Camera permission status error:', error);
    }
  }, []);

  // ---- face handler (stable identity, reads refs only) ----
  const handleFacesDetected = useCallback((faces) => {
    if (!mountedRef.current) return;

    try {
      const now = Date.now();
      if (now - lastFaceUpdateRef.current < 80) return;
      lastFaceUpdateRef.current = now;

      const face = Array.isArray(faces) ? faces[0] : faces;

      if (!face || typeof face !== 'object') {
        signalOkRef.current = false;
        setFaceDetected(false);
        setFaceSignal(false);
        if (startedRef.current) {
          setGuidanceText(
            'No face detected. Move closer and center your face.'
          );
        }
        return;
      }

      setFaceDetected(true);
      lastSignalAtRef.current = now;

      if (!startedRef.current || !detectionEnabledRef.current) return;

      const m = {
        mouthWidthRatio: Number(face.mouthWidthRatio),
        mouthOpeningRatio: Number(face.mouthOpeningRatio),
        smileScore: Number(face.smileScore),
        cheekWidthRatio: Number(face.cheekWidthRatio),
      };

      const valid =
        Object.values(m).every(Number.isFinite) &&
        m.mouthWidthRatio > 0 &&
        m.cheekWidthRatio > 0;

      if (!valid) {
        signalOkRef.current = false;
        setGuidanceText('Keep your face centered and visible.');
        return;
      }

      // Calibrate ONCE with a relaxed face
      if (!calibratedRef.current) {
        calibrationSamplesRef.current.push(m);
        setGuidanceText('Keep your face relaxed while we calibrate.');

        if (calibrationSamplesRef.current.length < CALIBRATION_SAMPLE_COUNT) {
          return;
        }

        const s = calibrationSamplesRef.current;
        baselineRef.current = {
          mouthWidthRatio: median(s.map((x) => x.mouthWidthRatio)),
          mouthOpeningRatio: median(s.map((x) => x.mouthOpeningRatio)),
          smileScore: median(s.map((x) => x.smileScore)),
          cheekWidthRatio: median(s.map((x) => x.cheekWidthRatio)),
        };
        calibrationSamplesRef.current = [];
        calibratedRef.current = true;
        setCalibrated(true);
        setGuidanceText('Calibration complete. Follow the activity instructions.');
        return;
      }

      const b = baselineRef.current;
      const id = exerciseIdRef.current;
      let signal = false;
      let message = '';

      if (id === 'smile') {
        signal = m.smileScore > b.smileScore + 0.04;
        message = signal
          ? 'Nice — hold the gentle smile.'
          : 'Gently lift both corners of your mouth.';
      } else if (id === 'lip_round') {
        signal = m.mouthWidthRatio < b.mouthWidthRatio * 0.82;
        message = signal
          ? 'Good — hold the rounded lip position.'
          : 'Gently round your lips.';
      } else if (id === 'lip_close') {
        signal =
          m.mouthOpeningRatio <= Math.max(0.02, b.mouthOpeningRatio * 0.65);
        message = signal
          ? 'Good — keep your lips gently together.'
          : 'Gently bring your lips together.';
      } else if (id === 'cheek') {
        signal = m.cheekWidthRatio > b.cheekWidthRatio * 1.025;
        message = signal
          ? 'Good — hold the gentle cheek activation.'
          : 'Gently puff your cheeks if comfortable.';
      } else if (id === 'relax') {
        signal = Math.abs(m.smileScore - b.smileScore) <= 0.035;
        message = signal
          ? 'Good — keep your face relaxed.'
          : 'Relax your face completely.';
      }

      signalOkRef.current = signal;
      setFaceSignal(signal);
      setGuidanceText(message);
    } catch (error) {
      console.log('Face handler error:', error);
    }
  }, []);

  const reportFaceLandmarks = useMemo(
    () => Worklets.createRunOnJS(handleFacesDetected),
    [handleFacesDetected]
  );

  // Frame processor capped at FACE_FPS so JS isn't flooded
  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      runAtTargetFps(FACE_FPS, () => {
        'worklet';
        if (faceLandmarkPlugin == null) return;
        const faces = faceLandmarkPlugin.call(frame);
        reportFaceLandmarks(faces ?? null);
      });
    },
    [faceLandmarkPlugin, reportFaceLandmarks]
  );

  // ---- hold timer: only counts while the movement is detected ----
  useEffect(() => {
    if (!holding) return undefined;

    finishedRef.current = false;
    let heldMs = 0;
    const targetMs = EXERCISES[exerciseIndex].duration * 1000;

    const id = setInterval(() => {
      if (detectionEnabledRef.current) {
        const fresh = Date.now() - lastSignalAtRef.current < SIGNAL_STALE_MS;
        // Pause (don't reset) if face lost or movement not detected
        if (!fresh || !signalOkRef.current) return;
      }

      heldMs += 250;
      setSeconds(Math.floor(heldMs / 1000));

      if (heldMs >= targetMs && !finishedRef.current) {
        finishedRef.current = true;
        clearInterval(id);
        finishCurrentExerciseRef.current?.();
      }
    }, 250);

    return () => clearInterval(id);
  }, [holding, exerciseIndex]);

  // ---- auto-run: begin each activity automatically ----
  useEffect(() => {
    if (!started || !routineActive || holding || completed) return undefined;
    if (!isFocused || !appActive) return undefined;
    if (detectionEnabled && !(faceDetected && calibrated)) return undefined;

    // short pause so people can get ready between activities
    const delay = exerciseIndex === 0 ? 600 : 1500;

    const timeout = setTimeout(() => {
      if (!mountedRef.current || savingRef.current) return;
      signalOkRef.current = !detectionEnabled;
      setSeconds(0);
      setHolding(true);
    }, delay);

    return () => clearTimeout(timeout);
  }, [
    started,
    routineActive,
    holding,
    completed,
    isFocused,
    appActive,
    detectionEnabled,
    faceDetected,
    calibrated,
    exerciseIndex,
  ]);

  // ---- actions ----
  async function requestCameraAccess() {
    try {
      const permission = await Camera.requestCameraPermission();
      if (!mountedRef.current) return permission;

      setCameraPermission(permission);

      if (permission !== 'granted') {
        Alert.alert(
          'Camera Permission Needed',
          'Please allow camera access in Settings so StrokeBuddy can provide facial movement guidance.'
        );
      }
      return permission;
    } catch (error) {
      console.log('Camera permission request error:', error);
      Alert.alert(
        'Camera Permission',
        'StrokeBuddy could not access the camera. Please check camera permissions in Settings.'
      );
      return 'denied';
    }
  }

  function resetCalibration() {
    baselineRef.current = { ...EMPTY_BASELINE };
    calibrationSamplesRef.current = [];
    calibratedRef.current = false;
    signalOkRef.current = false;
    setCalibrated(false);
    setFaceSignal(null);
  }

  async function startExercise() {
    if (!device) {
      Alert.alert(
        'Camera Unavailable',
        'The front camera is not currently available on this device.'
      );
      return;
    }

    let permission = cameraPermission;
    if (permission !== 'granted') {
      permission = await requestCameraAccess();
    }
    if (permission !== 'granted') return;

    resetCalibration();
    finishedRef.current = false;
    savingRef.current = false;

    setExerciseIndex(0);
    setSeconds(0);
    setHolding(false);
    setFaceDetected(false);
    setGuidanceText(
      detectionEnabled
        ? 'Center your face in the camera.'
        : 'Timer-only mode. Follow the activity instructions.'
    );
    setCompleted(false);
    setRoutineActive(true);
    setStarted(true);
  }

  function resumeRoutine() {
    if (!started || completed) return;
    setRoutineActive(true);
  }

  function pauseRoutine() {
    setRoutineActive(false);
    setHolding(false);
    setSeconds(0);
    setGuidanceText('Paused. Tap Resume when you are ready.');
  }

  function toggleDetection() {
    if (pluginMissing) {
      Alert.alert(
        'Detection Unavailable',
        'Face detection is not available in this build, so practice runs in timer-only mode.'
      );
      return;
    }

    const next = !detectionEnabled;
    setHolding(false);
    setSeconds(0);
    setDetectionEnabled(next);
    detectionEnabledRef.current = next;

    if (next) {
      resetCalibration();
      setGuidanceText('Keep your face relaxed while we calibrate.');
    } else {
      signalOkRef.current = true;
      setGuidanceText('Timer-only mode. Follow the activity instructions.');
    }
  }

  function advanceToNextExercise() {
    const index = exerciseIndexRef.current;

    setHolding(false);
    setSeconds(0);
    signalOkRef.current = false;
    setFaceSignal(null);

    if (index >= FACIAL_EXERCISE_COUNT - 1) {
      finishExercise();
      return;
    }

    setExerciseIndex(index + 1);
    setGuidanceText('Get ready for the next activity.');
    // Baseline is kept: no recalibration between exercises
  }

  function finishCurrentExercise() {
    if (!mountedRef.current) return;
    advanceToNextExercise();
  }
  finishCurrentExerciseRef.current = finishCurrentExercise;

  function skipCurrentExercise() {
    if (!started || saving) return;
    advanceToNextExercise();
  }

  async function finishExercise() {
    if (savingRef.current) return;
    savingRef.current = true;

    setSaving(true);
    setHolding(false);
    setRoutineActive(false);

    try {
      await saveSession();

      if (!mountedRef.current) return;

      setCompleted(true);
      setStarted(false);
    } catch (error) {
      console.log('Facial exercise completion error:', error);
      savingRef.current = false;

      Alert.alert(
        'Could Not Save',
        'Your facial practice could not be saved. Please try again.'
      );
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }

  async function saveSession() {
    const key = getStorageKey(accountId);
    const data = await loadExerciseData(accountId);
    const today = getToday();

    const session = {
      id: `${Date.now()}_facial`,
      exerciseId: 'facial',
      category: 'facial',
      patientId: accountId || 'default_patient',
      patientName: name || '',
      date: today,
      completedAt: new Date().toISOString(),
      exerciseCount: FACIAL_EXERCISE_COUNT,
      exercisesCompleted: EXERCISES.map((item) => item.id),
      status: 'completed',
      cameraGuidance: detectionEnabled,
      faceDetectionUsed: detectionEnabled,
    };

    const previousStreak = Number(data.currentStreak) || 0;
    const nextStreakData = calculateNextStreak(data);
    const previousLastDate = data.lastCompletedDate;

    const previousTodayCount =
      previousLastDate === today
        ? Number(data.exercises?.facial?.todayCount) || 0
        : 0;

    const updatedData = {
      ...data,
      currentStreak: nextStreakData.streak,
      longestStreak: nextStreakData.longestStreak,
      lastCompletedDate: today,
      totalCompletedSessions: (Number(data.totalCompletedSessions) || 0) + 1,
      sessions: [
        ...(Array.isArray(data.sessions) ? data.sessions : []),
        session,
      ],
      exercises: {
        ...data.exercises,
        facial: {
          ...(data.exercises?.facial || {}),
          sessions: [
            ...(Array.isArray(data.exercises?.facial?.sessions)
              ? data.exercises.facial.sessions
              : []),
            session,
          ],
          todayCount: previousTodayCount + 1,
          completedToday: true,
        },
      },
    };

    await AsyncStorage.setItem(key, JSON.stringify(updatedData));

    await sendFacialCompletionNotification(accountId);

    if (nextStreakData.streak > previousStreak && previousLastDate !== today) {
      await sendRecoveryMilestoneNotification(accountId, nextStreakData.streak);
    }
  }

  function goBackToExercises() {
    if (navigation?.goBack) {
      navigation.goBack();
    }
  }

  // ---- derived UI state ----
  const cameraActive = isFocused && appActive;

  // ---- completed screen ----
  if (completed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.completedContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={44} color="#22A06B" />
          </View>

          <Text style={styles.completedTitle}>Facial Practice Complete!</Text>

          <Text style={styles.completedSubtitle}>
            {FACIAL_EXERCISE_COUNT} guided activities completed
          </Text>

          <View style={styles.completedCard}>
            <View style={styles.completedRow}>
              <View style={styles.completedRowIcon}>
                <Ionicons name="happy-outline" size={23} color="#5B6CFF" />
              </View>

              <View style={styles.completedRowText}>
                <Text style={styles.completedRowTitle}>
                  Facial Movement Practice
                </Text>
                <Text style={styles.completedRowSubtitle}>
                  Your session was saved to your recovery activity.
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={goBackToExercises}
            activeOpacity={0.85}
          >
            <Text style={styles.doneButtonText}>Back to Exercises</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- main screen ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBackToExercises}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to exercises"
          >
            <Ionicons name="chevron-back" size={26} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Facial Movement Practice</Text>
            <Text style={styles.headerSubtitle}>
              Gentle facial and oral-motor practice
            </Text>
          </View>
        </View>

        <View style={styles.cameraFrame}>
          {cameraPermission === 'granted' && device ? (
            <>
              <Camera
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={cameraActive}
                pixelFormat="yuv"
                frameProcessor={detectionEnabled ? frameProcessor : undefined}
                onError={(error) => console.log('Camera error:', error)}
              />

              <View style={styles.cameraTopBadge}>
                <View
                  style={[
                    styles.cameraStatusDot,
                    detectionEnabled &&
                      faceDetected &&
                      styles.cameraStatusDotActive,
                  ]}
                />
                <Text style={styles.cameraTopBadgeText}>
                  {!detectionEnabled
                    ? 'TIMER ONLY'
                    : faceDetected
                    ? 'FACE DETECTED'
                    : 'CAMERA READY'}
                </Text>
              </View>

              {!started && (
                <View style={styles.cameraOverlay}>
                  <View style={styles.cameraOverlayIcon}>
                    <Ionicons name="person-outline" size={30} color="#FFFFFF" />
                  </View>

                  <Text style={styles.cameraOverlayTitle}>
                    Center your face
                  </Text>

                  <Text style={styles.cameraOverlaySubtitle}>
                    Sit comfortably and position your face inside the camera.
                  </Text>
                </View>
              )}

              {started && (
                <View style={styles.liveGuidance}>
                  <Text style={styles.liveGuidanceTitle}>
                    {exercise.title}
                  </Text>

                  <Text style={styles.liveGuidanceText}>{guidanceText}</Text>

                  {holding && (
                    <View style={styles.holdIndicator}>
                      <Text style={styles.holdIndicatorText}>
                        {Math.max(exercise.duration - seconds, 0)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {started && detectionEnabled && !faceDetected && (
                <View style={styles.faceWarning}>
                  <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.faceWarningText}>
                    Center your face in the camera
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.permissionContainer}>
              <View style={styles.permissionIcon}>
                <Ionicons name="camera-outline" size={34} color="#5B6CFF" />
              </View>

              <Text style={styles.permissionTitle}>
                Camera Permission Needed
              </Text>

              <Text style={styles.permissionDescription}>
                Camera access is used for visual facial exercise guidance.
              </Text>

              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestCameraAccess}
                activeOpacity={0.85}
              >
                <Text style={styles.permissionButtonText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Activity</Text>
            <Text style={styles.progressCount}>{progressText}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((exerciseIndex + 1) / FACIAL_EXERCISE_COUNT) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name={exercise.icon} size={25} color="#5B6CFF" />
          </View>

          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>{exercise.title}</Text>
            <Text style={styles.infoDescription}>{exercise.description}</Text>
          </View>
        </View>

        <View style={styles.safetyCard}>
          <View style={styles.safetyIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color="#5B6CFF"
            />
          </View>

          <View style={styles.safetyTextContainer}>
            <Text style={styles.safetyTitle}>Keep it gentle</Text>
            <Text style={styles.safetyText}>
              Do not force facial movements. Stop if an activity causes pain,
              dizziness, unusual shortness of breath, or worsening symptoms.
              Follow individualized guidance from your healthcare team for
              swallowing or speech concerns.
            </Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons
              name={
                detectionEnabled && faceDetected
                  ? 'scan-outline'
                  : 'information-circle-outline'
              }
              size={21}
              color={detectionEnabled && faceDetected ? '#22A06B' : '#818CF8'}
            />
          </View>

          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>
              {!detectionEnabled
                ? 'Timer-only mode'
                : faceDetected
                ? 'Facial guidance active'
                : 'Camera guidance'}
            </Text>

            <Text style={styles.statusText}>
              {!detectionEnabled
                ? 'The timer counts down without checking your movement. Follow the on-screen instructions at your own pace.'
                : faceDetected
                ? 'StrokeBuddy is detecting your face to provide activity-specific visual guidance.'
                : 'Center your face in the camera so StrokeBuddy can provide activity-specific visual guidance.'}
            </Text>
          </View>
        </View>

        {!started ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={startExercise}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Facial Practice</Text>
          </TouchableOpacity>
        ) : routineActive ? (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={pauseRoutine}
            activeOpacity={0.85}
          >
            <Ionicons name="pause" size={20} color="#5B6CFF" />
            <Text style={styles.stopButtonText}>Pause Routine</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.startButton}
            onPress={resumeRoutine}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Resume Routine</Text>
          </TouchableOpacity>
        )}

        {started && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={skipCurrentExercise}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Ionicons name="play-skip-forward-outline" size={18} color="#5B6CFF" />
            <Text style={styles.secondaryButtonText}>
              {exerciseIndex >= FACIAL_EXERCISE_COUNT - 1
                ? 'Finish Practice'
                : 'Skip This Activity'}
            </Text>
          </TouchableOpacity>
        )}

        {!pluginMissing && (
          <TouchableOpacity
            style={styles.linkButton}
            onPress={toggleDetection}
            activeOpacity={0.7}
          >
            <Text style={styles.linkButtonText}>
              {detectionEnabled
                ? 'Practice without camera detection'
                : 'Turn camera detection back on'}
            </Text>
          </TouchableOpacity>
        )}

        {saving && (
          <View style={styles.savingContainer}>
            <Ionicons name="sync-outline" size={18} color="#777777" />
            <Text style={styles.savingText}>Saving your practice...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  completedContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.4,
  },

  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
    marginTop: 5,
  },

  cameraFrame: {
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EDEBF0',
    marginBottom: 15,
    position: 'relative',
  },

  cameraTopBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.75)',
  },

  cameraStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#9CA3AF',
    marginRight: 7,
  },

  cameraStatusDotActive: {
    backgroundColor: '#4ADE80',
  },

  cameraTopBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 45,
    backgroundColor: 'rgba(17,24,39,0.34)',
  },

  cameraOverlayIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },

  cameraOverlayTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  cameraOverlaySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 6,
  },

  liveGuidance: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(17,24,39,0.82)',
  },

  liveGuidanceTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  liveGuidanceText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#E5E7EB',
    marginTop: 3,
  },

  holdIndicator: {
    position: 'absolute',
    right: 13,
    top: 11,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  holdIndicatorText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  faceWarning: {
    position: 'absolute',
    top: 57,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.78)',
  },

  faceWarningText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 7,
  },

  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: 21,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  permissionTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  permissionDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 7,
    marginBottom: 15,
  },

  permissionButton: {
    backgroundColor: '#5B6CFF',
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  progressLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  progressCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#777777',
  },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#EDEFF7',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#818CF8',
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  infoText: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: '#111827',
  },

  infoDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 4,
  },

  safetyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  safetyIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  safetyTextContainer: {
    flex: 1,
  },

  safetyTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 3,
  },

  safetyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#F1F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  statusTextContainer: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 3,
  },

  statusText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },

  startButton: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#5B6CFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  startButtonDisabled: {
    backgroundColor: '#AEB5D9',
  },

  startButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 8,
  },

  stopButton: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#EEF0FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  stopButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5B6CFF',
    marginLeft: 8,
  },

  secondaryButton: {
    height: 46,
    borderRadius: 15,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5B6CFF',
    marginLeft: 8,
  },

  linkButton: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },

  linkButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textDecorationLine: 'underline',
  },

  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },

  savingText: {
    fontSize: 12,
    color: '#777777',
    marginLeft: 6,
  },

  successIcon: {
    width: 86,
    height: 86,
    borderRadius: 30,
    backgroundColor: '#E8F6EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  completedTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  completedSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
    marginTop: 7,
    textAlign: 'center',
    marginBottom: 25,
  },

  completedCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
    marginBottom: 22,
  },

  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  completedRowIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  completedRowText: {
    flex: 1,
  },

  completedRowTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#111827',
  },

  completedRowSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    marginTop: 3,
  },

  doneButton: {
    width: '100%',
    height: 54,
    borderRadius: 17,
    backgroundColor: '#5B6CFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  doneButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});