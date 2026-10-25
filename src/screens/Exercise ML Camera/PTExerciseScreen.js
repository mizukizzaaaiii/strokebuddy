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
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
  VisionCameraProxy,
} from 'react-native-vision-camera';

import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications from 'expo-notifications';

/* -------------------------------------------------------------------------- */
/*                                   STORAGE                                  */
/* -------------------------------------------------------------------------- */

const EXERCISE_STORAGE_KEY = 'strokebuddy_exercise_data_';
const NOTIFICATION_STORAGE_KEY = 'strokebuddy_notification_settings_';

const TOTAL_REPS = 10;

const RECOVERY_MILESTONES = [3, 7, 14, 30];

/* -------------------------------------------------------------------------- */
/*                            POSE LANDMARK PLUGIN                            */
/* -------------------------------------------------------------------------- */

// Shows the small on-camera readout. Set to false once detection is verified.
const PT_DEBUG = true;

const ptLog = (...args) => {
  if (PT_DEBUG) {
    console.log('[PT]', ...args);
  }
};

// Shown in the debug badge so you can confirm this exact file is running.
const PT_BUILD = 'BUILD v4-safe';

const PT_USE_FRAME_PROCESSOR = true;

// Crash guard. Before the native pose plugin loads, this key is set to
// 'pending'. It is cleared ('ok') on a clean exit OR as soon as the plugin
// returns its first real landmarks. If the app crashes, it is still 'pending'
// on the next launch, so detection is switched off (manual counting).
const PT_GUARD_KEY = 'strokebuddy_pt_detection_guard';

// The crash guard permanently switched detection off after any unclean exit.
// Keep it false so detection is always on (it also clears any old stored flag).
const PT_USE_CRASH_GUARD = true;

// The "Count rep manually" button. Reps are counted only from detected movement.
const SHOW_MANUAL_FALLBACK = true;

// 0 = camera only, 1 = plugin created, 2 = frame processor runs but plugin
// is never called, 3 = everything on.
const PT_STAGE = 3;

const PT_WORKLET_LEVEL = 2;
const PT_WORKLET_EMPTY = PT_STAGE === 2 && PT_WORKLET_LEVEL === 0;
const PT_WORKLET_REPORTS = PT_STAGE >= 3 || PT_WORKLET_LEVEL >= 2;

// Registered natively by PoseLandmarkerPlugin.m:
// VISION_EXPORT_SWIFT_FRAME_PROCESSOR(PoseLandmarkerPlugin, poseLandmarker)
const PLUGIN_NAME = 'poseLandmarker';

const createPosePlugin = () => {
  if (!PT_USE_FRAME_PROCESSOR || PT_STAGE < 1) {
    ptLog('pose plugin creation skipped');

    return null;
  }

  try {
    if (
      VisionCameraProxy &&
      typeof VisionCameraProxy.initFrameProcessorPlugin === 'function'
    ) {
      const plugin =
        VisionCameraProxy.initFrameProcessorPlugin(PLUGIN_NAME, {}) || null;

      ptLog(`plugin "${PLUGIN_NAME}" resolved:`, !!plugin);

      return plugin;
    }

    ptLog('VisionCameraProxy.initFrameProcessorPlugin is not available');
  } catch (error) {
    console.warn('Pose Landmarker frame processor plugin failed:', error);
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/*                              EXERCISE LEVELS                               */
/* -------------------------------------------------------------------------- */

const EXERCISE_LEVELS = {
  1: {
    id: 1,
    name: 'Foundation',
    description: 'Build safe movement and control.',
    exercises: [
      {
        id: 'seatedMarching',
        name: 'Seated Marching',
        category: 'Leg movement',
        level: 1,
        purpose: 'Build controlled leg movement while seated.',
        description:
          'Lift one knee at a time while keeping your upper body steady.',
        steps: [
          'Sit tall with both feet on the floor.',
          'Lift one knee slowly.',
          'Lower the knee with control.',
          'Repeat with the other leg.',
        ],
        safety:
          'Stay seated and move slowly. Stop if you feel pain, dizziness, or unsafe.',
        detection: 'seatedMarching',
        type: 'lowerBody',
      },

      {
        id: 'seatedReaching',
        name: 'Seated Reaching',
        category: 'Arm movement',
        level: 1,
        purpose: 'Practice controlled reaching from a seated position.',
        description:
          'Reach forward with your arm and return slowly to the starting position.',
        steps: [
          'Sit tall with your shoulders relaxed.',
          'Reach your arm forward.',
          'Pause briefly at the reach.',
          'Return your arm slowly.',
        ],
        safety: 'Stay seated and keep the movement comfortable and controlled.',
        detection: 'seatedReaching',
        type: 'upperBody',
      },

      {
        id: 'affectedArmElbowExtension',
        name: 'Arm Elbow Extension',
        category: 'Arm movement',
        level: 1,
        purpose: 'Practice controlled bending and straightening of the arm.',
        description: 'Bend your arm and then slowly straighten it.',
        steps: [
          'Keep your upper arm relaxed.',
          'Bend your elbow.',
          'Slowly straighten your arm.',
          'Return to a comfortable position.',
        ],
        safety: 'Do not force your elbow straight. Keep the movement comfortable.',
        detection: 'affectedArmElbowExtension',
        type: 'upperBody',
      },

      {
        id: 'affectedArmForwardReach',
        name: 'Arm Forward Reach',
        category: 'Arm movement',
        level: 1,
        purpose: 'Practice controlled forward arm reaching.',
        description: 'Reach forward and return your arm with steady control.',
        steps: [
          'Sit or stand in a stable position.',
          'Start with your arm near your side.',
          'Reach forward slowly.',
          'Return to the starting position.',
        ],
        safety:
          'Use a stable position and avoid reaching beyond your comfortable range.',
        detection: 'affectedArmForwardReach',
        type: 'upperBody',
      },
    ],
  },

  2: {
    id: 2,
    name: 'Functional',
    description: 'Practice movements used in everyday activities.',
    exercises: [
      {
        id: 'sitToStand',
        name: 'Sit to Stand',
        category: 'Functional movement',
        level: 2,
        purpose: 'Practice controlled standing and sitting.',
        description: 'Stand from a chair and return to sitting with control.',
        steps: [
          'Sit near the front of a stable chair.',
          'Lean forward and stand safely.',
          'Stand tall briefly.',
          'Sit back down with control.',
        ],
        safety:
          'Use a stable chair and caregiver support when needed. Do not perform this without appropriate support.',
        detection: 'sitToStand',
        type: 'functional',
      },

      {
        id: 'supportedHeelRaises',
        name: 'Supported Heel Raises',
        category: 'Leg movement',
        level: 2,
        purpose: 'Practice controlled ankle and lower-leg movement.',
        description: 'Hold stable support and slowly raise and lower your heels.',
        steps: [
          'Stand near a stable support.',
          'Hold the support securely.',
          'Raise your heels slowly.',
          'Lower your heels with control.',
        ],
        safety: 'Always use stable support and caregiver assistance when needed.',
        detection: 'supportedHeelRaises',
        type: 'lowerBody',
      },

      {
        id: 'supportedWeightShifting',
        name: 'Supported Weight Shifting',
        category: 'Balance',
        level: 2,
        purpose: 'Practice controlled weight transfer.',
        description: 'Shift your weight gently from one side to the other.',
        steps: [
          'Stand with stable support nearby.',
          'Shift your weight toward one side.',
          'Return to the center.',
          'Shift toward the other side.',
        ],
        safety:
          'Keep stable support nearby. Do not perform this without appropriate assistance.',
        detection: 'supportedWeightShifting',
        type: 'balance',
      },

      {
        id: 'standingReach',
        name: 'Standing Reach',
        category: 'Functional movement',
        level: 2,
        purpose: 'Practice controlled reaching while standing.',
        description: 'Reach forward from a stable standing position and return.',
        steps: [
          'Stand with stable support nearby.',
          'Start with your arm relaxed.',
          'Reach forward slowly.',
          'Return with control.',
        ],
        safety:
          'Stay near stable support and avoid reaching beyond your comfortable range.',
        detection: 'standingReach',
        type: 'upperBody',
      },

      {
        id: 'repeatedSitToStand',
        name: 'Repeated Sit to Stand',
        category: 'Functional movement',
        level: 2,
        purpose: 'Practice repeated controlled transfers.',
        description: 'Repeat the sit-to-stand movement with steady control.',
        steps: [
          'Sit securely on a stable chair.',
          'Stand with control.',
          'Pause briefly while standing.',
          'Return to sitting safely.',
        ],
        safety: 'Use a stable chair and appropriate caregiver support.',
        detection: 'repeatedSitToStand',
        type: 'functional',
      },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*                               DEFAULT DATA                                 */
/* -------------------------------------------------------------------------- */

const DEFAULT_EXERCISE_DATA = {
  version: 5,
  currentDifficultyLevel: 1,
  difficultyRequestStatus: 'none',

  streak: 0,
  lastExerciseDate: null,

  ptDailyCount: 0,
  ptDailyDate: null,

  totalSessions: 0,
  totalReps: 0,

  sessions: [],
  ptSessions: [],
};

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const safeNum = (v) => (Number.isFinite(v) ? v : 0);

const distance = (a, b) => {
  if (!a || !b) {
    return 0;
  }

  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
};

const angle = (a, b, c) => {
  if (!a || !b || !c) {
    return 0;
  }

  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };

  const dot = ab.x * cb.x + ab.y * cb.y;

  const abLength = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const cbLength = Math.sqrt(cb.x * cb.x + cb.y * cb.y);

  if (!abLength || !cbLength) {
    return 0;
  }

  const cosine = clamp(dot / (abLength * cbLength), -1, 1);

  return (Math.acos(cosine) * 180) / Math.PI;
};

const averageVisibility = (landmarks, indexes) => {
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return 0;
  }

  const values = indexes
    .map((index) => landmarks[index]?.visibility)
    .filter((value) => typeof value === 'number');

  if (!values.length) {
    return 0.5;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

// Local date (toISOString is UTC and can break streaks around midnight).
const getTodayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
};

const getDateDifference = (a, b) => {
  if (!a || !b) {
    return null;
  }

  const first = new Date(`${a}T00:00:00`);
  const second = new Date(`${b}T00:00:00`);

  return Math.round(Math.abs(second - first) / (1000 * 60 * 60 * 24));
};

/* -------------------------------------------------------------------------- */
/*                         POSE EXTRACTION + DETECTION                        */
/* -------------------------------------------------------------------------- */

// iOS front camera: the plugin returns landmarks in landscape orientation.
// Other options: 'none' | 'rotateCW' | 'rotateCCW'
const POSE_ORIENTATION = 'transpose';

const orientPoint = (p) => {
  if (POSE_ORIENTATION === 'transpose') {
    return { ...p, x: p.y, y: p.x };
  }

  if (POSE_ORIENTATION === 'rotateCW') {
    return { ...p, x: 1 - p.y, y: p.x };
  }

  if (POSE_ORIENTATION === 'rotateCCW') {
    return { ...p, x: p.y, y: 1 - p.x };
  }

  return p;
};

const EMPTY_LANDMARK = { x: 0, y: 0, z: 0, visibility: 0 };

const toLandmark = (p) => {
  if (!p) {
    return EMPTY_LANDMARK;
  }

  if (Array.isArray(p)) {
    const x = Number(p[0]);
    const y = Number(p[1]);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return EMPTY_LANDMARK;
    }

    return orientPoint({
      x,
      y,
      z: Number(p[2]) || 0,
      visibility: typeof p[3] === 'number' ? p[3] : 1,
    });
  }

  const x = Number(p.x);
  const y = Number(p.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return EMPTY_LANDMARK;
  }

  return orientPoint({
    x,
    y,
    z: Number(p.z) || 0,
    visibility:
      typeof p.visibility === 'number'
        ? p.visibility
        : typeof p.presence === 'number'
        ? p.presence
        : 1,
  });
};

/*
 * Auto-corrects an upside-down result. Decided once per session from the first
 * frame where the nose and both shoulders are clearly visible: if the nose is
 * BELOW the shoulders, the y axis is flipped.
 */
let uprightFlip = null;

const resetUpright = () => {
  uprightFlip = null;
};

const ensureUpright = (lms) => {
  if (uprightFlip === null) {
    const nose = lms[0];
    const ls = lms[11];
    const rs = lms[12];

    if (
      nose &&
      ls &&
      rs &&
      nose.visibility >= 0.5 &&
      ls.visibility >= 0.5 &&
      rs.visibility >= 0.5
    ) {
      uprightFlip = nose.y > (ls.y + rs.y) / 2;

      ptLog('upright flip decided:', uprightFlip);
    }
  }

  return uprightFlip ? lms.map((p) => ({ ...p, y: 1 - p.y })) : lms;
};

/*
 * The ONLY place that depends on the plugin's result shape.
 */
const extractLandmarks = (result) => {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const candidates = [
    result.pose,
    result.landmarks,
    result.poseLandmarks,
    result.keypoints,
    result,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) {
      continue;
    }

    // Some builds return [[33 landmarks]] (one list per detected person).
    const first = candidate[0];

    const list =
      Array.isArray(first) &&
      first.length >= 33 &&
      first[0] &&
      typeof first[0] === 'object' &&
      !Array.isArray(first[0])
        ? first
        : candidate;

    if (list.length < 33) {
      continue;
    }

    return ensureUpright(list.map(toLandmark));
  }

  return null;
};

const safeStringify = (value, max = 700) => {
  try {
    const text = JSON.stringify(value);

    return text && text.length > max ? `${text.slice(0, max)}…` : text;
  } catch (error) {
    return String(value);
  }
};

// Landmarks below this visibility are treated as "not in frame".
const MIN_VISIBILITY = 0.35;

const MIN_ACTIVE_MS = 150;
const REP_DEBOUNCE_MS = 500;
const CALIBRATION_FRAMES = 8;

// If a movement stays "active" this long, the detector recalibrates.
const MAX_ACTIVE_MS = 8000;

// A rep that takes at least this long in the moving phase counts as controlled.
const MIN_GOOD_REP_MS = 900;

// If no body is tracked for this long, offer a manual rep counter.
const DETECTION_STALL_MS = 8000;

const average = (list) =>
  list.reduce((sum, value) => sum + value, 0) / list.length;

const midpoint = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const allVisible = (landmarks, indexes) =>
  indexes.every((index) => (landmarks[index]?.visibility ?? 0) >= MIN_VISIBILITY);

/* Elbow bend in degrees: 0 = straight, larger = more bent. */
const elbowBend = (landmarks, s, e, w) => {
  const elbowAngle = angle(landmarks[s], landmarks[e], landmarks[w]);

  return elbowAngle ? 180 - elbowAngle : NaN;
};

/* Wrist height above the shoulder, in arm lengths (raw, not baseline-relative). */
const armRaiseRaw = (lm, s, e, w) => {
  const length = distance(lm[s], lm[e]) + distance(lm[e], lm[w]);

  return length ? (lm[s].y - lm[w].y) / length : NaN;
};

/*
 * Every detector has:
 *   rest   - value at the neutral position (rep ends when value falls back here)
 *   active - value that must be reached for the movement to START counting
 *   target - value of a full, comfortable movement (used for accuracy scoring)
 * All values are RELATIVE to the person's own calibrated start pose.
 */
const reachDetector = {
  required: [11, 12],
  visibleMessage: 'Keep your shoulders and arms in view.',
  active: 0.3,
  rest: 0.12,
  target: 0.6,
  baseline: (lm) => ({
    rl: safeNum(armRaiseRaw(lm, 11, 13, 15)),
    rr: safeNum(armRaiseRaw(lm, 12, 14, 16)),
  }),
  measure: (lm, base) => {
    const vals = [];

    if (allVisible(lm, [11, 13, 15])) {
      vals.push(armRaiseRaw(lm, 11, 13, 15) - base.rl);
    }

    if (allVisible(lm, [12, 14, 16])) {
      vals.push(armRaiseRaw(lm, 12, 14, 16) - base.rr);
    }

    const valid = vals.filter(Number.isFinite);

    return valid.length ? { value: Math.max(...valid) } : null;
  },
  cues: {
    rest: 'Reach forward.',
    active: 'Reach forward.',
    hold: 'Hold briefly, then return.',
    done: 'Good. Return slowly.',
  },
};

const sitStandDetector = {
  required: [11, 12, 23, 24],
  visibleMessage: 'Keep your shoulders and hips in view.',
  active: 0.35,
  rest: 0.12,
  target: 0.6,
  baseline: (landmarks) => {
    const shoulders = midpoint(landmarks[11], landmarks[12]);
    const hips = midpoint(landmarks[23], landmarks[24]);

    return {
      shoulderY: shoulders.y,
      torso: Math.abs(hips.y - shoulders.y),
    };
  },
  measure: (landmarks, base) => {
    if (!base.torso) {
      return null;
    }

    const shoulders = midpoint(landmarks[11], landmarks[12]);

    return { value: (base.shoulderY - shoulders.y) / base.torso };
  },
  cues: {
    rest: 'Prepare to stand.',
    active: 'Stand tall.',
    hold: 'Stand tall, then sit with control.',
    done: 'Good. Sit down with control.',
  },
};

const DETECTORS = {
  seatedMarching: {
    required: [11, 12, 23, 24, 25, 26],
    visibleMessage: 'Keep your hips and knees in view.',
    active: 0.2,
    rest: 0.08,
    target: 0.4,
    alternate: true,
    baseline: (landmarks) => ({
      L: landmarks[23].y - landmarks[25].y,
      R: landmarks[24].y - landmarks[26].y,
    }),
    measure: (landmarks, base, scale) => {
      const left = (landmarks[23].y - landmarks[25].y - base.L) / scale;
      const right = (landmarks[24].y - landmarks[26].y - base.R) / scale;

      return left >= right
        ? { value: left, side: 'L' }
        : { value: right, side: 'R' };
    },
    cues: {
      rest: 'Lift one knee.',
      active: 'Lift your knee.',
      hold: 'Hold briefly, then lower.',
      done: 'Good. Lower with control.',
    },
  },

  seatedReaching: reachDetector,
  affectedArmForwardReach: reachDetector,
  standingReach: reachDetector,

  affectedArmElbowExtension: {
    required: [11, 12],
    visibleMessage: 'Keep your shoulders and arms in view.',
    active: 45,
    rest: 18,
    target: 90,
    baseline: (lm) => ({
      bl: safeNum(elbowBend(lm, 11, 13, 15)),
      br: safeNum(elbowBend(lm, 12, 14, 16)),
    }),
    measure: (lm, base) => {
      const vals = [];

      if (allVisible(lm, [11, 13, 15])) {
        vals.push(Math.abs(elbowBend(lm, 11, 13, 15) - base.bl));
      }

      if (allVisible(lm, [12, 14, 16])) {
        vals.push(Math.abs(elbowBend(lm, 12, 14, 16) - base.br));
      }

      const valid = vals.filter(Number.isFinite);

      return valid.length ? { value: Math.max(...valid) } : null;
    },
    cues: {
      rest: 'Bend your arm.',
      active: 'Now straighten your arm.',
      hold: 'Move slowly.',
      done: 'Good. Return slowly.',
    },
  },

  sitToStand: sitStandDetector,
  repeatedSitToStand: sitStandDetector,

  supportedHeelRaises: {
    required: [11, 12, 23, 24, 27, 28],
    visibleMessage: 'Keep your full body in view.',
    active: 0.08,
    rest: 0.03,
    target: 0.14,
    baseline: (landmarks) => ({
      rel:
        midpoint(landmarks[27], landmarks[28]).y -
        midpoint(landmarks[23], landmarks[24]).y,
    }),
    measure: (landmarks, base, scale) => {
      const rel =
        midpoint(landmarks[27], landmarks[28]).y -
        midpoint(landmarks[23], landmarks[24]).y;

      return { value: (base.rel - rel) / scale };
    },
    cues: {
      rest: 'Raise your heels.',
      active: 'Raise your heels.',
      hold: 'Hold briefly, then lower.',
      done: 'Good. Lower slowly.',
    },
  },

  supportedWeightShifting: {
    required: [11, 12, 23, 24, 27, 28],
    visibleMessage: 'Keep your full body in view.',
    active: 0.2,
    rest: 0.08,
    target: 0.35,
    alternate: true,
    baseline: (landmarks) => ({
      offset:
        midpoint(landmarks[23], landmarks[24]).x -
        midpoint(landmarks[27], landmarks[28]).x,
    }),
    measure: (landmarks, base, scale) => {
      const delta =
        (midpoint(landmarks[23], landmarks[24]).x -
          midpoint(landmarks[27], landmarks[28]).x -
          base.offset) /
        scale;

      return { value: Math.abs(delta), side: delta > 0 ? 'R' : 'L' };
    },
    cues: {
      rest: 'Shift your weight.',
      active: 'Shift your weight slowly.',
      hold: 'Return to center.',
      done: 'Good. Now shift to the other side.',
    },
  },
};

const newDetectorState = (lastRepAt = 0) => ({
  calib: [],
  base: null,
  phase: 'calibrating', // calibrating -> rest <-> active
  value: null,
  side: null,
  lastSide: null,
  peak: 0,
  activeSince: 0,
  countedAt: 0,
  lastRepAt,
  lastValidAt: 0,
  calibAnchor: null,
});

/*
 * Pure function. One rep = neutral -> valid movement range -> back to neutral.
 */
const analyzeFrame = (exercise, landmarks, previousState, now) => {
  const state =
    previousState && Array.isArray(previousState.calib)
      ? { ...previousState }
      : newDetectorState(previousState?.lastRepAt || 0);

  const definition = DETECTORS[exercise.detection];

  const invalid = (message, confidence = 0) => ({
    st: state,
    valid: false,
    message,
    confidence,
    step: 0,
    countRep: false,
    rep: null,
    value: state.value,
  });

  if (!definition || !Array.isArray(landmarks) || landmarks.length < 33) {
    return invalid('Move into camera view.');
  }

  const confidence = averageVisibility(landmarks, definition.required);

  if (confidence < MIN_VISIBILITY) {
    return invalid(definition.visibleMessage, confidence);
  }

  // Tracking was lost for a while (person left the frame, sat down, moved
  // the phone): start over so the new position is the neutral pose.
  if (state.base && state.lastValidAt && now - state.lastValidAt > 1500) {
    const fresh = newDetectorState(state.lastRepAt);

    fresh.lastSide = state.lastSide;
    fresh.lastValidAt = now;

    return {
      st: fresh,
      valid: true,
      message: 'Hold still for a moment.',
      confidence,
      step: 0,
      countRep: false,
      rep: null,
      value: null,
    };
  }

  state.lastValidAt = now;

  /* ---- calibration: capture the person's own neutral pose ---- */
  if (!state.base) {
    const scale = distance(landmarks[11], landmarks[12]);

    if (!scale) {
      return invalid('Face the camera.', confidence);
    }

    // The person must be STILL while calibrating. If they are still moving
    // into position (sitting down, adjusting), restart the calibration.
    const sh = midpoint(landmarks[11], landmarks[12]);

    if (
      !state.calibAnchor ||
      Math.abs(sh.x - state.calibAnchor.x) > 0.25 * scale ||
      Math.abs(sh.y - state.calibAnchor.y) > 0.25 * scale ||
      Math.abs(scale - state.calibAnchor.scale) > 0.25 * scale
    ) {
      state.calibAnchor = { x: sh.x, y: sh.y, scale };
      state.calib = [];
    }

    state.calib = [
      ...state.calib,
      { S: scale, ...definition.baseline(landmarks) },
    ];

    if (state.calib.length < CALIBRATION_FRAMES) {
      return {
        st: state,
        valid: true,
        message: 'Hold still for a moment.',
        confidence,
        step: 0,
        countRep: false,
        rep: null,
        value: null,
      };
    }

    const base = {};

    Object.keys(state.calib[0]).forEach((key) => {
      base[key] = safeNum(average(state.calib.map((entry) => entry[key])));
    });

    state.base = base;
    state.calib = [];
    state.calibAnchor = null;
    state.phase = 'rest';
  }

  const measurement = definition.measure(landmarks, state.base, state.base.S);

  if (!measurement || !Number.isFinite(measurement.value)) {
    return invalid(definition.visibleMessage, confidence);
  }

  // Light smoothing to reduce landmark jitter.
  state.value =
    state.value == null
      ? measurement.value
      : state.value * 0.5 + measurement.value * 0.5;

  const value = state.value;

  let countRep = false;
  let rep = null;
  let message = definition.cues.rest;

  if (state.phase === 'start') {
    if (value <= definition.rest) {
      state.phase = 'rest';
      message = definition.cues.rest;
    } else {
      message = 'Return to the starting position.';
    }
  } else if (state.phase === 'rest') {
    if (value >= definition.active) {
      state.phase = 'active';
      state.activeSince = now;
      state.peak = value;
      state.side = measurement.side || null;
      message = definition.cues.active;
    }
  } else if (state.phase === 'active') {
    // Stuck in "active" (e.g. the person was moving during calibration):
    // recalibrate from their current pose.
    if (now - state.activeSince > MAX_ACTIVE_MS) {
      const fresh = newDetectorState(state.lastRepAt);

      fresh.lastSide = state.lastSide;

      return {
        st: fresh,
        valid: true,
        message: 'Relax and hold still for a moment.',
        confidence,
        step: 0,
        countRep: false,
        rep: null,
        value: null,
      };
    }

    if (value > state.peak) {
      state.peak = value;
      state.side = measurement.side || state.side;
    }

    if (value <= definition.rest) {
      state.phase = 'rest';

      if (now - state.activeSince < MIN_ACTIVE_MS) {
        message = definition.cues.rest; // too brief, treat as jitter
      } else if (
        definition.alternate &&
        state.lastSide &&
        state.side === state.lastSide
      ) {
        message = 'Now use the other side.';
      } else if (now - state.lastRepAt < REP_DEBOUNCE_MS) {
        message = definition.cues.rest;
      } else {
        countRep = true;

        rep = {
          peak: state.peak,
          ms: now - state.activeSince,
          side: state.side,
        };

        state.lastSide = state.side;
        state.lastRepAt = now;
        state.countedAt = now;
        message = definition.cues.done;
      }
    } else {
      message = definition.cues.hold;
    }
  }

  let step = 0;

  if (state.phase === 'active') {
    step = now - state.activeSince > 700 ? 2 : 1;
  }

  if (now - state.countedAt < 1200) {
    step = 3;
  }

  return {
    st: state,
    valid: true,
    message,
    confidence,
    step,
    countRep,
    rep,
    value,
  };
};

/* -------------------------------------------------------------------------- */
/*                         ACCURACY SCORING + SUGGESTIONS                     */
/* -------------------------------------------------------------------------- */

const scoreRep = (definition, rep) => {
  const span = definition.target - definition.rest;

  const rom = span ? clamp((rep.peak - definition.rest) / span, 0, 1.2) : 1;

  const rangeScore = clamp(rom / 0.9, 0, 1);
  const tempoScore = clamp(rep.ms / MIN_GOOD_REP_MS, 0, 1);

  const score = Math.round(100 * (0.75 * rangeScore + 0.25 * tempoScore));

  let feedback = 'Great rep. Good range and control.';

  if (rom < 0.6) {
    feedback = 'Try moving a little further, only as far as is comfortable.';
  } else if (rep.ms < MIN_GOOD_REP_MS) {
    feedback = 'Good range. Now try moving more slowly.';
  }

  return { rom, ms: rep.ms, side: rep.side, score, feedback };
};

const summarizeReps = (exercise, results) => {
  if (!results.length) {
    return {
      accuracy: null,
      avgRange: null,
      suggestions: [
        'Your movement was not tracked for this exercise, so no accuracy score was recorded.',
      ],
    };
  }

  const accuracy = Math.round(average(results.map((r) => r.score)));
  const avgRange = average(results.map((r) => r.rom));
  const avgMs = average(results.map((r) => r.ms));

  const spread = Math.sqrt(
    average(results.map((r) => (r.rom - avgRange) * (r.rom - avgRange)))
  );

  const suggestions = [];

  if (avgRange < 0.65) {
    suggestions.push(
      'Try to move a little further on each rep, only as far as is comfortable.'
    );
  }

  if (avgMs < MIN_GOOD_REP_MS) {
    suggestions.push(
      'Slow down. Controlled movement matters more than speed.'
    );
  }

  if (spread > 0.22) {
    suggestions.push('Try to keep each rep a similar size.');
  }

  if (DETECTORS[exercise.detection]?.alternate) {
    const left = results.filter((r) => r.side === 'L').map((r) => r.rom);
    const right = results.filter((r) => r.side === 'R').map((r) => r.rom);

    if (
      left.length >= 2 &&
      right.length >= 2 &&
      Math.abs(average(left) - average(right)) > 0.25
    ) {
      suggestions.push(
        'One side moved less than the other. That is common, so keep it gentle and never force it.'
      );
    }
  }

  if (accuracy < 50 && suggestions.length < 2) {
    suggestions.push(
      'If this felt too hard, rest, and ask your therapist whether an easier level would suit you.'
    );
  }

  if (!suggestions.length) {
    suggestions.push('Excellent form. Keep it up.');
  }

  return {
    accuracy,
    avgRange: Math.round(avgRange * 100) / 100,
    suggestions: suggestions.slice(0, 2),
  };
};

/* -------------------------------------------------------------------------- */
/*                     BODY OVERLAY + POSTURE TIPS (helpers)                  */
/* -------------------------------------------------------------------------- */

const SHOW_POSE_OVERLAY = true;

// If the dots move the OPPOSITE way to you, set this to true.
const OVERLAY_MIRROR_X = false;

const OVERLAY_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const OVERLAY_LINES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

const uprightDims = (frameWidth, frameHeight) => {
  const a = Number(frameWidth);
  const b = Number(frameHeight);

  if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
    const w = Math.min(a, b);
    const h = Math.max(a, b);

    return { w, h, aspect: w / h, known: true };
  }

  return { w: 3, h: 4, aspect: 0.75, known: false };
};

const scaleToIso = (landmarks, aspect) => {
  if (!landmarks || !aspect || aspect === 1) {
    return landmarks;
  }

  return landmarks.map((p) => ({ ...p, x: p.x * aspect }));
};

const mapToCover = (point, boxW, boxH, frameW, frameH, mirror) => {
  const scale = Math.max(boxW / frameW, boxH / frameH);
  const drawnW = frameW * scale;
  const drawnH = frameH * scale;
  const offsetX = (boxW - drawnW) / 2;
  const offsetY = (boxH - drawnH) / 2;
  const nx = mirror ? 1 - point.x : point.x;

  return { x: offsetX + nx * drawnW, y: offsetY + point.y * drawnH };
};

const LEAN_TIP_EXERCISES = new Set([
  'seatedMarching',
  'seatedReaching',
  'affectedArmElbowExtension',
  'affectedArmForwardReach',
  'supportedHeelRaises',
]);

const getPostureTips = (norm, iso, exerciseId) => {
  if (!norm || !iso || !allVisible(norm, [11, 12])) {
    return null;
  }

  const shoulderWidth = Math.abs(norm[11].x - norm[12].x);

  if (shoulderWidth < 0.12) {
    return 'Move a little closer to the camera.';
  }

  if (shoulderWidth > 0.5) {
    return 'Move back a little so more of you is in view.';
  }

  const midX = (norm[11].x + norm[12].x) / 2;

  if (midX < 0.25 || midX > 0.75) {
    return 'Move toward the center of the camera view.';
  }

  const tilt =
    (Math.atan2(
      Math.abs(iso[11].y - iso[12].y),
      Math.abs(iso[11].x - iso[12].x)
    ) *
      180) /
    Math.PI;

  if (tilt > 15) {
    return 'Try to keep your shoulders level.';
  }

  if (LEAN_TIP_EXERCISES.has(exerciseId) && allVisible(norm, [23, 24])) {
    const shoulders = midpoint(iso[11], iso[12]);
    const hips = midpoint(iso[23], iso[24]);

    const lean =
      (Math.atan2(
        Math.abs(shoulders.x - hips.x),
        Math.abs(hips.y - shoulders.y)
      ) *
        180) /
      Math.PI;

    if (lean > 15) {
      return 'Sit up tall and try not to lean to one side.';
    }
  }

  return null;
};

const PoseOverlay = React.memo(function PoseOverlay({ apiRef, mirror }) {
  const [pose, setPose] = useState(null); // { pts, w, h }
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    apiRef.current = { set: setPose };

    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  const onLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;

    setBox({ w: width, h: height });
  };

  const positions = {};

  if (pose && box.w > 0 && box.h > 0) {
    OVERLAY_POINTS.forEach((index, k) => {
      const p = pose.pts[k];

      if (p && p.v >= MIN_VISIBILITY) {
        positions[index] = mapToCover(p, box.w, box.h, pose.w, pose.h, mirror);
      }
    });
  }

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
    >
      {OVERLAY_LINES.map(([a, b]) => {
        const from = positions[a];
        const to = positions[b];

        if (!from || !to) {
          return null;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        return (
          <View
            key={`l${a}-${b}`}
            style={{
              position: 'absolute',
              left: (from.x + to.x) / 2 - length / 2,
              top: (from.y + to.y) / 2 - 1.5,
              width: length,
              height: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(74,222,128,0.85)',
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}

      {OVERLAY_POINTS.map((index) => {
        const point = positions[index];

        if (!point) {
          return null;
        }

        return (
          <View
            key={`p${index}`}
            style={{
              position: 'absolute',
              left: point.x - 5,
              top: point.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: '#FFFFFF',
              borderWidth: 2,
              borderColor: '#22A06B',
            }}
          />
        );
      })}
    </View>
  );
});

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function PTExerciseScreen({ route, navigation }) {
  const accountId = route?.params?.accountId || 'default_patient';

  /* ------------------------------------------------------------------------ */
  /*                                  STATE                                   */
  /* ------------------------------------------------------------------------ */

  const [data, setData] = useState(DEFAULT_EXERCISE_DATA);

  const dataRef = useRef(DEFAULT_EXERCISE_DATA);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reps, setReps] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [poseDetected, setPoseDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [guidance, setGuidance] = useState(
    'Position yourself in front of the camera.'
  );

  const [detectionConfidence, setDetectionConfidence] = useState(0);

  const [liveStep, setLiveStep] = useState(0);

  const [debugWorklet, setDebugWorklet] = useState('');
  const [debugPose, setDebugPose] = useState('');

  const [postureTip, setPostureTip] = useState(null);

  const [repFeedback, setRepFeedback] = useState('');
  const [accuracy, setAccuracy] = useState(null);
  const [sessionSummary, setSessionSummary] = useState([]);
  const [detectionStalled, setDetectionStalled] = useState(false);
  const [detectionOff, setDetectionOff] = useState(false);

  const sessionStartRef = useRef(null);
  const accumulatedSecondsRef = useRef(0);
  const lastTickRef = useRef(null);
  const repDetectorRef = useRef(newDetectorState());
  const completionLockRef = useRef(false);
  const mountedRef = useRef(true);

  const repResultsRef = useRef([]);
  const sessionSummaryRef = useRef([]);
  const feedbackTimerRef = useRef(null);
  const lastLandmarkAtRef = useRef(Date.now());
  const attemptActiveRef = useRef(false);

  /* ------------------------------------------------------------------------ */
  /*                                  CAMERA                                  */
  /* ------------------------------------------------------------------------ */

  const device = useCameraDevice('front');

  const format = useCameraFormat(device, [
    { videoResolution: { width: 640, height: 480 } },
    { fps: 30 },
  ]);

  const cameraFps = format?.maxFps ? Math.min(30, format.maxFps) : undefined;

  const { hasPermission, requestPermission } = useCameraPermission();

  const pluginRef = useRef(null);

  const poseOn = PT_USE_FRAME_PROCESSOR && !detectionOff;

  const poseLandmarkerPlugin = useMemo(() => {
    if (started && poseOn && !pluginRef.current) {
      pluginRef.current = createPosePlugin();
    }

    return poseOn ? pluginRef.current : null;
  }, [started, poseOn]);

  const readDetectionGuard = useCallback(async () => {
    if (!PT_USE_CRASH_GUARD) {
      try {
        await AsyncStorage.removeItem(PT_GUARD_KEY);
      } catch (error) {
        // ignore
      }

      return false;
    }

    try {
      const value = await AsyncStorage.getItem(PT_GUARD_KEY);

      if (value === 'pending' && !attemptActiveRef.current) {
        await AsyncStorage.setItem(PT_GUARD_KEY, 'disabled');

        return true;
      }

      return value === 'disabled';
    } catch (error) {
      return false;
    }
  }, []);

  const markDetectionOk = useCallback(async () => {
    if (!attemptActiveRef.current) {
      return;
    }

    attemptActiveRef.current = false;

    try {
      await AsyncStorage.setItem(PT_GUARD_KEY, 'ok');
    } catch (error) {
      // ignore
    }
  }, []);

  const retryDetection = useCallback(async () => {
    try {
      await AsyncStorage.setItem(PT_GUARD_KEY, 'ok');
    } catch (error) {
      // ignore
    }

    setDetectionOff(false);
  }, []);

  useEffect(() => {
    readDetectionGuard().then((off) => {
      if (mountedRef.current) {
        setDetectionOff(off);
      }
    });
  }, [readDetectionGuard]);

  useEffect(() => {
    if (started) {
      ptLog('session started', {
        hasDevice: !!device,
        hasPermission,
        hasPlugin: !!poseLandmarkerPlugin,
      });
    }
  }, [started, device, hasPermission, poseLandmarkerPlugin]);

  /* ------------------------------------------------------------------------ */
  /*                              DERIVED DATA                                */
  /* ------------------------------------------------------------------------ */

  const exercises = EXERCISE_LEVELS[selectedLevel]?.exercises || [];

  const currentExercise = exercises[exerciseIndex] || exercises[0];

  const currentLevel = EXERCISE_LEVELS[selectedLevel];

  const assignedLevel = Math.max(
    1,
    Math.min(2, Number(data.currentDifficultyLevel || 1))
  );

  /* ------------------------------------------------------------------------ */
  /*                              MOUNT CLEANUP                               */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (attemptActiveRef.current) {
        attemptActiveRef.current = false;

        AsyncStorage.setItem(PT_GUARD_KEY, 'ok').catch(() => {});
      }

      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                                DATA LOAD                                 */
  /* ------------------------------------------------------------------------ */

  const loadData = useCallback(async () => {
    try {
      const key = `${EXERCISE_STORAGE_KEY}${accountId}`;

      const stored = await AsyncStorage.getItem(key);

      if (stored) {
        let parsed = {};

        try {
          parsed = JSON.parse(stored);
        } catch (parseError) {
          console.warn('Exercise data was invalid JSON. Resetting safely.');
        }

        const merged = {
          ...DEFAULT_EXERCISE_DATA,
          ...parsed,
        };

        if (!Array.isArray(merged.sessions)) {
          merged.sessions = [];
        }

        if (!Array.isArray(merged.ptSessions)) {
          merged.ptSessions = [];
        }

        dataRef.current = merged;

        if (mountedRef.current) {
          setData(merged);
        }

        const savedLevel = Number(merged.currentDifficultyLevel || 1);

        if (mountedRef.current) {
          setSelectedLevel(savedLevel >= 2 ? 2 : 1);
        }
      } else {
        dataRef.current = DEFAULT_EXERCISE_DATA;

        if (mountedRef.current) {
          setData(DEFAULT_EXERCISE_DATA);

          setSelectedLevel(1);
        }
      }
    } catch (error) {
      console.warn('Failed to load exercise data:', error);

      if (mountedRef.current) {
        Alert.alert(
          'Exercise data unavailable',
          'Your exercise data could not be loaded. Please try again.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [accountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ------------------------------------------------------------------------ */
  /*                            DATA PERSISTENCE                              */
  /* ------------------------------------------------------------------------ */

  const persistData = useCallback(
    async (nextData) => {
      const key = `${EXERCISE_STORAGE_KEY}${accountId}`;

      dataRef.current = nextData;

      if (mountedRef.current) {
        setData(nextData);
      }

      await AsyncStorage.setItem(key, JSON.stringify(nextData));
    },
    [accountId]
  );

  /* ------------------------------------------------------------------------ */
  /*                             NOTIFICATIONS                               */
  /* ------------------------------------------------------------------------ */

  const sendMilestoneNotification = useCallback(
    async (streak) => {
      try {
        const settingsKey = `${NOTIFICATION_STORAGE_KEY}${accountId}`;

        const settingsRaw = await AsyncStorage.getItem(settingsKey);

        if (!settingsRaw) {
          return;
        }

        let settings;

        try {
          settings = JSON.parse(settingsRaw);
        } catch (error) {
          return;
        }

        if (settings.exerciseReminders === false) {
          return;
        }

        if (!RECOVERY_MILESTONES.includes(streak)) {
          return;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Recovery milestone',
            body: 'You completed another recovery milestone.',
          },
          trigger: null,
        });
      } catch (error) {
        console.warn('Milestone notification failed:', error);
      }
    },
    [accountId]
  );

  /* ------------------------------------------------------------------------ */
  /*                              STREAK UPDATE                               */
  /* ------------------------------------------------------------------------ */

  const updateStreakAfterSession = useCallback(async () => {
    const current = dataRef.current;

    const today = getTodayKey();

    let nextStreak = Number(current.streak || 0);

    if (current.lastExerciseDate === today) {
      return current;
    }

    if (!current.lastExerciseDate) {
      nextStreak = 1;
    } else {
      const difference = getDateDifference(current.lastExerciseDate, today);

      if (difference === 1) {
        nextStreak += 1;
      } else {
        nextStreak = 1;
      }
    }

    const nextData = {
      ...current,
      streak: nextStreak,
      lastExerciseDate: today,
    };

    await persistData(nextData);

    await sendMilestoneNotification(nextStreak);

    return nextData;
  }, [persistData, sendMilestoneNotification]);

  /* ------------------------------------------------------------------------ */
  /*                                TIMER                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!started || paused || completed || !sessionStartRef.current) {
      return undefined;
    }

    const timer = setInterval(() => {
      if (!sessionStartRef.current || !mountedRef.current) {
        return;
      }

      const currentElapsed =
        accumulatedSecondsRef.current +
        Math.floor((Date.now() - sessionStartRef.current) / 1000);

      setElapsedSeconds(Math.max(0, currentElapsed));
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, [started, paused, completed]);

  /* ------------------------------------------------------------------------ */
  /*                     DETECTION STALL WATCHDOG                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!started || paused || completed) {
      setDetectionStalled(false);

      return undefined;
    }

    if (detectionOff || !PT_USE_FRAME_PROCESSOR) {
      setDetectionStalled(true);

      return undefined;
    }

    lastLandmarkAtRef.current = Date.now();

    const watchdog = setInterval(() => {
      const stalled = Date.now() - lastLandmarkAtRef.current > DETECTION_STALL_MS;

      setDetectionStalled((previous) =>
        previous === stalled ? previous : stalled
      );
    }, 1000);

    return () => {
      clearInterval(watchdog);
    };
  }, [started, paused, completed, detectionOff]);

  /* ------------------------------------------------------------------------ */
  /*                         CAMERA PERMISSION                                */
  /* ------------------------------------------------------------------------ */

  const ensureCameraPermission = useCallback(async () => {
    try {
      if (hasPermission) {
        return true;
      }

      const result = await requestPermission();

      return Boolean(result);
    } catch (error) {
      console.warn('Camera permission request failed:', error);

      return false;
    }
  }, [hasPermission, requestPermission]);

  /* ------------------------------------------------------------------------ */
  /*                         SESSION TIMER HELPERS                             */
  /* ------------------------------------------------------------------------ */

  const getCurrentDuration = useCallback(() => {
    let duration = accumulatedSecondsRef.current;

    if (sessionStartRef.current && !paused) {
      duration += Math.floor((Date.now() - sessionStartRef.current) / 1000);
    }

    return Math.max(0, Math.floor(duration));
  }, [paused]);

  const resetSessionClock = useCallback(() => {
    sessionStartRef.current = null;

    accumulatedSecondsRef.current = 0;

    lastTickRef.current = null;

    if (mountedRef.current) {
      setElapsedSeconds(0);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                           FEEDBACK HELPERS                                */
  /* ------------------------------------------------------------------------ */

  const showFeedback = useCallback((text, duration = 3500) => {
    if (!mountedRef.current) {
      return;
    }

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    setRepFeedback(text);

    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null;

      if (mountedRef.current) {
        setRepFeedback('');
      }
    }, duration);
  }, []);

  const resetFeedback = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    repResultsRef.current = [];
    sessionSummaryRef.current = [];
    lastLandmarkAtRef.current = Date.now();

    if (mountedRef.current) {
      setRepFeedback('');
      setAccuracy(null);
      setSessionSummary([]);
      setDetectionStalled(false);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                         SAVE COMPLETED EXERCISE                          */
  /* ------------------------------------------------------------------------ */

  const saveCompletedExercise = useCallback(
    async (exercise, completedReps, duration, summary) => {
      const current = dataRef.current;

      const timestamp = new Date().toISOString();

      const exerciseSession = {
        id: `${timestamp}-${exercise.id}`,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        level: exercise.level,
        reps: completedReps,
        duration,
        accuracy: summary?.accuracy ?? null,
        avgRangeOfMotion: summary?.avgRange ?? null,
        completedAt: timestamp,
      };

      const existingSessions = Array.isArray(current.ptSessions)
        ? current.ptSessions
        : [];

      const existingGeneralSessions = Array.isArray(current.sessions)
        ? current.sessions
        : [];

      const today = getTodayKey();

      const nextDailyCount =
        current.ptDailyDate === today
          ? Number(current.ptDailyCount || 0) + 1
          : 1;

      const nextData = {
        ...current,

        totalReps: Number(current.totalReps || 0) + completedReps,

        ptSessions: [...existingSessions, exerciseSession].slice(-100),

        sessions: [...existingGeneralSessions, exerciseSession].slice(-100),

        ptDailyCount: nextDailyCount,

        ptDailyDate: today,
      };

      await persistData(nextData);

      return nextData;
    },
    [persistData]
  );

  /* ------------------------------------------------------------------------ */
  /*                         COMPLETE CURRENT EXERCISE                        */
  /* ------------------------------------------------------------------------ */

  const completeCurrentExercise = useCallback(async () => {
    if (completionLockRef.current || !currentExercise || !started || paused) {
      return;
    }

    completionLockRef.current = true;

    if (mountedRef.current) {
      setSaving(true);
    }

    try {
      const duration = getCurrentDuration();

      const completedIndex = exerciseIndex;

      const summary = summarizeReps(currentExercise, repResultsRef.current);

      await saveCompletedExercise(
        currentExercise,
        TOTAL_REPS,
        duration,
        summary
      );

      sessionSummaryRef.current = [
        ...sessionSummaryRef.current,
        {
          id: currentExercise.id,
          name: currentExercise.name,
          accuracy: summary.accuracy,
          suggestions: summary.suggestions,
        },
      ];

      const isLastExercise = completedIndex >= exercises.length - 1;

      if (isLastExercise) {
        const current = dataRef.current;

        const nextData = {
          ...current,
          totalSessions: Number(current.totalSessions || 0) + 1,
        };

        await persistData(nextData);

        await updateStreakAfterSession();

        markDetectionOk();

        resetSessionClock();

        if (mountedRef.current) {
          setSessionSummary(sessionSummaryRef.current);
          setStarted(false);
          setPaused(false);
          setCompleted(true);
          setExerciseIndex(0);
          setReps(0);
          setAccuracy(null);
          setRepFeedback('');
          setPoseDetected(false);
          setDetectionConfidence(0);
          setLiveStep(0);
        }

        return;
      }

      const nextIndex = completedIndex + 1;

      resetSessionClock();

      repDetectorRef.current = newDetectorState();

      repResultsRef.current = [];

      lastLandmarkAtRef.current = Date.now();

      if (mountedRef.current) {
        setExerciseIndex(nextIndex);

        setReps(0);

        setAccuracy(null);

        setPoseDetected(false);

        setDetectionConfidence(0);

        setLiveStep(0);

        setGuidance(
          exercises[nextIndex]?.steps?.[0] || 'Follow the movement.'
        );

        const accuracyText =
          summary.accuracy == null ? '' : `${summary.accuracy}% accuracy. `;

        showFeedback(
          `${currentExercise.name} done. ${accuracyText}${
            summary.suggestions[0] || ''
          }`,
          6000
        );
      }

      // Keep the ref in sync right away so detection resumes for the next exercise.
      repsRef.current = 0;

      sessionStartRef.current = Date.now();
    } catch (error) {
      console.warn('Failed to save exercise:', error);

      if (mountedRef.current) {
        Alert.alert('Unable to save exercise', 'Please try again.');
      }
    } finally {
      completionLockRef.current = false;

      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    currentExercise,
    exerciseIndex,
    exercises,
    getCurrentDuration,
    paused,
    persistData,
    resetSessionClock,
    saveCompletedExercise,
    markDetectionOk,
    showFeedback,
    started,
    updateStreakAfterSession,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                         POSE RESULT PROCESSING                           */
  /* ------------------------------------------------------------------------ */

  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const completedRef = useRef(false);
  const exerciseRef = useRef(null);
  const repsRef = useRef(0);
  const completeRef = useRef(null);

  const lastUiRef = useRef({
    detected: null,
    guidance: '',
    step: -1,
    conf: -1,
  });

  const frameCountRef = useRef(0);

  const overlayApiRef = useRef(null);
  const overlayLastRef = useRef(0);
  const tipRef = useRef({ cand: null, since: 0, shown: null, clearSince: 0 });
  const lastLogRef = useRef(0);

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    exerciseRef.current = currentExercise;
  }, [currentExercise]);

  useEffect(() => {
    repsRef.current = reps;
  }, [reps]);

  useEffect(() => {
    completeRef.current = completeCurrentExercise;
  }, [completeCurrentExercise]);

  // New exercise / start / pause: force the UI to re-sync on the next frame.
  useEffect(() => {
    lastUiRef.current = {
      detected: null,
      guidance: '',
      step: -1,
      conf: -1,
    };

    setLiveStep(0);

    tipRef.current = { cand: null, since: 0, shown: null, clearSince: 0 };
    setPostureTip(null);

    // Re-calibrate from the person's current pose after any pause/resume.
    repDetectorRef.current = newDetectorState(repDetectorRef.current?.lastRepAt || 0);

    if (overlayApiRef.current) {
      overlayApiRef.current.set(null);
    }
  }, [exerciseIndex, started, paused]);

  const processPoseResult = useCallback(
    (result, frameWidth, frameHeight) => {
      frameCountRef.current += 1;

      const frameNumber = frameCountRef.current;

      if (PT_DEBUG && frameNumber <= 3) {
        ptLog(`raw result #${frameNumber}:`, typeof result, safeStringify(result));
      }

      const exercise = exerciseRef.current;

      if (
        !startedRef.current ||
        pausedRef.current ||
        completedRef.current ||
        !exercise ||
        completionLockRef.current ||
        repsRef.current >= TOTAL_REPS
      ) {
        return;
      }

      const landmarks = extractLandmarks(result);

      if (!landmarks && PT_DEBUG && frameNumber <= 5) {
        ptLog(
          'no landmarks found. result keys:',
          result && typeof result === 'object'
            ? Object.keys(result)
            : typeof result
        );
      }

      if (landmarks && PT_DEBUG && frameNumber === 2) {
        ptLog('sample landmarks', {
          leftShoulder11: landmarks[11],
          leftHip23: landmarks[23],
          note: 'upright body => shoulder y < hip y',
        });
      }

      const now = Date.now();

      if (landmarks) {
        lastLandmarkAtRef.current = now;

        // The plugin works, so clear the crash guard.
        markDetectionOk();
      }

      const dims = uprightDims(frameWidth, frameHeight);
      const iso = landmarks
        ? scaleToIso(landmarks, dims.known ? dims.aspect : 1)
        : null;

      const analysis = analyzeFrame(
        exercise,
        iso,
        repDetectorRef.current,
        now
      );

      repDetectorRef.current = analysis.st;

      if (PT_DEBUG && now - lastLogRef.current > 1000) {
        lastLogRef.current = now;

        const debugLine = `lm=${
          landmarks ? landmarks.length : 0
        } conf=${analysis.confidence.toFixed(2)} phase=${
          analysis.st.phase
        } val=${
          typeof analysis.value === 'number' ? analysis.value.toFixed(2) : 'n/a'
        } reps=${repsRef.current}`;

        ptLog(`${exercise.detection} ${debugLine} msg="${analysis.message}"`);

        if (mountedRef.current) {
          setDebugPose(debugLine);
        }
      }

      if (!mountedRef.current) {
        return;
      }

      // ---- body overlay (~10 updates per second) ----
      if (
        SHOW_POSE_OVERLAY &&
        overlayApiRef.current &&
        now - overlayLastRef.current > 100
      ) {
        overlayLastRef.current = now;

        overlayApiRef.current.set(
          landmarks
            ? {
                pts: OVERLAY_POINTS.map((index) => ({
                  x: landmarks[index].x,
                  y: landmarks[index].y,
                  v: landmarks[index].visibility,
                })),
                w: dims.w,
                h: dims.h,
              }
            : null
        );
      }

      // ---- posture tip: must persist ~1s to appear, ~0.6s to disappear ----
      const tipNow =
        analysis.valid && analysis.st.base
          ? getPostureTips(landmarks, iso, exercise.detection)
          : null;

      const tipState = tipRef.current;

      if (tipNow) {
        tipState.clearSince = 0;

        if (tipState.cand !== tipNow) {
          tipState.cand = tipNow;
          tipState.since = now;
        }

        if (tipState.shown !== tipNow && now - tipState.since >= 1000) {
          tipState.shown = tipNow;
          setPostureTip(tipNow);
        }
      } else {
        tipState.cand = null;

        if (tipState.shown) {
          if (!tipState.clearSince) {
            tipState.clearSince = now;
          }

          if (now - tipState.clearSince >= 600) {
            tipState.shown = null;
            tipState.clearSince = 0;
            setPostureTip(null);
          }
        }
      }

      // Only touch React state when something actually changed.
      const ui = lastUiRef.current;

      if (ui.detected !== analysis.valid) {
        ui.detected = analysis.valid;
        setPoseDetected(analysis.valid);
      }

      const confidence = Math.round(analysis.confidence * 20) / 20;

      if (ui.conf !== confidence) {
        ui.conf = confidence;
        setDetectionConfidence(confidence);
      }

      if (analysis.message && ui.guidance !== analysis.message) {
        ui.guidance = analysis.message;
        setGuidance(analysis.message);
      }

      if (ui.step !== analysis.step) {
        ui.step = analysis.step;
        setLiveStep(analysis.step);
      }

      if (analysis.countRep && analysis.valid) {
        const nextReps = Math.min(TOTAL_REPS, repsRef.current + 1);

        // Update the ref immediately so a fast second frame cannot double count.
        repsRef.current = nextReps;

        setReps(nextReps);

        const definition = DETECTORS[exercise.detection];

        if (analysis.rep && definition) {
          const scored = scoreRep(definition, analysis.rep);

          repResultsRef.current = [...repResultsRef.current, scored];

          setAccuracy(
            Math.round(average(repResultsRef.current.map((r) => r.score)))
          );

          if (nextReps < TOTAL_REPS) {
            showFeedback(scored.feedback);
          }
        }

        if (nextReps >= TOTAL_REPS) {
          setTimeout(() => {
            if (mountedRef.current && completeRef.current) {
              completeRef.current();
            }
          }, 300);
        }
      }
    },
    [showFeedback, markDetectionOk]
  );

  const processPoseResultJS = useRunOnJS(processPoseResult, [
    processPoseResult,
  ]);

  const debugJS = useRunOnJS((message) => {
    ptLog(message);

    if (mountedRef.current) {
      setDebugWorklet(String(message));
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                            FRAME PROCESSOR                               */
  /* ------------------------------------------------------------------------ */

  const frameCounter = useSharedValue(0);
  const nullCounter = useSharedValue(0);
  const lastProcessed = useSharedValue(0);
  const lastReport = useSharedValue(0);
  const lastErrorReport = useSharedValue(0);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      if (PT_WORKLET_EMPTY) {
        return;
      }

      if (!poseLandmarkerPlugin) {
        return;
      }

      const now = Date.now();

      frameCounter.value = frameCounter.value + 1;

      if (PT_DEBUG && PT_WORKLET_REPORTS && now - lastReport.value > 2000) {
        lastReport.value = now;

        debugJS(
          `frame processor alive: ${frameCounter.value} frames / ~2s, ${nullCounter.value} null results`
        );

        frameCounter.value = 0;
        nullCounter.value = 0;
      }

      // Run pose detection at roughly 15 fps.
      if (now - lastProcessed.value < 66) {
        return;
      }

      lastProcessed.value = now;

      if (PT_STAGE < 3) {
        return;
      }

      try {
        const result = poseLandmarkerPlugin.call(frame);

        if (result == null) {
          nullCounter.value = nullCounter.value + 1;
          return;
        }

        processPoseResultJS(result, frame.width, frame.height);
      } catch (error) {
        if (PT_DEBUG && now - lastErrorReport.value > 3000) {
          lastErrorReport.value = now;

          debugJS(`plugin call error: ${String(error)}`);
        }
      }
    },
    [
      poseLandmarkerPlugin,
      processPoseResultJS,
      debugJS,
      frameCounter,
      nullCounter,
      lastProcessed,
      lastReport,
      lastErrorReport,
    ]
  );

  /* ------------------------------------------------------------------------ */
  /*                             MANUAL REP COUNT                              */
  /* ------------------------------------------------------------------------ */

  const manualCountRep = useCallback(() => {
    if (
      !startedRef.current ||
      pausedRef.current ||
      completionLockRef.current ||
      repsRef.current >= TOTAL_REPS
    ) {
      return;
    }

    const nextReps = repsRef.current + 1;

    repsRef.current = nextReps;

    setReps(nextReps);

    if (nextReps >= TOTAL_REPS) {
      setTimeout(() => {
        if (mountedRef.current && completeRef.current) {
          completeRef.current();
        }
      }, 300);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                             START SESSION                                */
  /* ------------------------------------------------------------------------ */

  const startExercise = useCallback(async () => {
    if (saving) {
      return;
    }

    const allowed = await ensureCameraPermission();

    if (!allowed) {
      Alert.alert(
        'Camera permission needed',
        'Camera access is required to guide and count your movements.'
      );

      return;
    }

    const assigned = Number(dataRef.current.currentDifficultyLevel || 1);

    if (selectedLevel > assigned) {
      Alert.alert('Level unavailable', 'This level has not been assigned yet.');

      return;
    }

    if (!EXERCISE_LEVELS[selectedLevel]?.exercises?.length) {
      Alert.alert(
        'Exercises unavailable',
        'No exercises are available for this level.'
      );

      return;
    }

    const detectionIsOff = await readDetectionGuard();

    setDetectionOff(detectionIsOff);

    if (PT_USE_FRAME_PROCESSOR && PT_USE_CRASH_GUARD && !detectionIsOff) {
      attemptActiveRef.current = true;

      try {
        await AsyncStorage.setItem(PT_GUARD_KEY, 'pending');
      } catch (error) {
        // ignore
      }
    }

    resetUpright();

    setCompleted(false);
    setPaused(false);
    setSaving(false);

    setExerciseIndex(0);
    setReps(0);
    setLiveStep(0);

    setPoseDetected(false);
    setCameraReady(false);
    setDetectionConfidence(0);

    resetSessionClock();
    resetFeedback();

    repDetectorRef.current = newDetectorState();

    repsRef.current = 0;
    frameCountRef.current = 0;

    completionLockRef.current = false;

    const now = Date.now();

    sessionStartRef.current = now;

    accumulatedSecondsRef.current = 0;

    if (mountedRef.current) {
      setElapsedSeconds(0);

      setStarted(true);

      setGuidance(
        EXERCISE_LEVELS[selectedLevel]?.exercises?.[0]?.steps?.[0] ||
          'Position yourself in front of the camera.'
      );
    }
  }, [
    ensureCameraPermission,
    readDetectionGuard,
    resetFeedback,
    resetSessionClock,
    saving,
    selectedLevel,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                              PAUSE / RESUME                              */
  /* ------------------------------------------------------------------------ */

  const togglePause = useCallback(() => {
    setPaused((wasPaused) => {
      const nextPaused = !wasPaused;

      if (nextPaused) {
        if (sessionStartRef.current) {
          accumulatedSecondsRef.current += Math.floor(
            (Date.now() - sessionStartRef.current) / 1000
          );
        }

        sessionStartRef.current = null;

        if (mountedRef.current) {
          setElapsedSeconds(
            Math.max(0, Math.floor(accumulatedSecondsRef.current))
          );

          setGuidance('Resume when you are ready.');
        }
      } else {
        sessionStartRef.current = Date.now();

        if (mountedRef.current) {
          setGuidance(
            currentExercise?.steps?.[0] || 'Continue the movement.'
          );
        }
      }

      return nextPaused;
    });
  }, [currentExercise]);

  /* ------------------------------------------------------------------------ */
  /*                              END SESSION                                 */
  /* ------------------------------------------------------------------------ */

  const stopSession = useCallback(() => {
    Alert.alert(
      'End exercise?',
      'Your current incomplete exercise will not be counted as completed.',
      [
        {
          text: 'Continue',
          style: 'cancel',
        },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            setStarted(false);
            setPaused(false);
            setReps(0);
            setExerciseIndex(0);
            setPoseDetected(false);
            setCameraReady(false);
            setDetectionConfidence(0);
            setLiveStep(0);

            resetSessionClock();
            resetFeedback();
            markDetectionOk();

            completionLockRef.current = false;

            repDetectorRef.current = newDetectorState();

            repsRef.current = 0;

            setGuidance('Position yourself in front of the camera.');
          },
        },
      ]
    );
  }, [markDetectionOk, resetFeedback, resetSessionClock]);

  /* ------------------------------------------------------------------------ */
  /*                                BACK BUTTON                               */
  /* ------------------------------------------------------------------------ */

  const goBack = useCallback(() => {
    if (navigation?.goBack) {
      navigation.goBack();
    }
  }, [navigation]);

  /* ------------------------------------------------------------------------ */
  /*                            LEVEL SELECTION                               */
  /* ------------------------------------------------------------------------ */

  const handleLevelChange = useCallback(
    (level) => {
      if (started || saving) {
        return;
      }

      if (level > assignedLevel) {
        return;
      }

      setSelectedLevel(level);

      setExerciseIndex(0);
      setReps(0);
      setLiveStep(0);
      setCompleted(false);

      setGuidance(
        EXERCISE_LEVELS[level]?.exercises?.[0]?.steps?.[0] ||
          'Position yourself in front of the camera.'
      );

      repDetectorRef.current = newDetectorState();

      repsRef.current = 0;
    },
    [assignedLevel, saving, started]
  );

  /* ------------------------------------------------------------------------ */
  /*                           CAMERA STATUS                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!started) {
      setCameraReady(false);
    }
  }, [started]);

  /* ------------------------------------------------------------------------ */
  /*                            CURRENT STEP                                  */
  /* ------------------------------------------------------------------------ */

  const currentStepIndex = started ? liveStep : 0;

  const currentStep =
    currentExercise?.steps?.[currentStepIndex] || 'Follow the movement.';

  /* ------------------------------------------------------------------------ */
  /*                           COMPLETION SCREEN                              */
  /* ------------------------------------------------------------------------ */

  if (completed) {
    const streak = dataRef.current.streak || 0;

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.completedContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.completedIcon}>
            <Ionicons name="checkmark" size={48} color="#FFFFFF" />
          </View>

          <Text style={styles.completedTitle}>Exercise complete</Text>

          <Text style={styles.completedSubtitle}>
            You completed all exercises in this level.
          </Text>

          <View style={styles.completedCard}>
            <View style={styles.completedStat}>
              <Text style={styles.completedStatNumber}>{exercises.length}</Text>

              <Text style={styles.completedStatLabel}>Exercises</Text>
            </View>

            <View style={styles.completedDivider} />

            <View style={styles.completedStat}>
              <Text style={styles.completedStatNumber}>
                {exercises.length * TOTAL_REPS}
              </Text>

              <Text style={styles.completedStatLabel}>Reps</Text>
            </View>

            <View style={styles.completedDivider} />

            <View style={styles.completedStat}>
              <Text style={styles.completedStatNumber}>{streak}</Text>

              <Text style={styles.completedStatLabel}>Day streak</Text>
            </View>
          </View>

          {sessionSummary.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Movement summary</Text>

              {sessionSummary.map((item) => (
                <View key={item.id} style={styles.summaryRow}>
                  <View style={styles.summaryRowHeader}>
                    <Text style={styles.summaryName}>{item.name}</Text>

                    <Text style={styles.summaryScore}>
                      {item.accuracy == null ? '—' : `${item.accuracy}%`}
                    </Text>
                  </View>

                  {item.suggestions.map((tip, tipIndex) => (
                    <Text key={`${item.id}-${tipIndex}`} style={styles.summaryTip}>
                      {tip}
                    </Text>
                  ))}
                </View>
              ))}

              <Text style={styles.summaryNote}>
                Accuracy shows how close your movements came to a full,
                controlled range. These tips are general guidance, not a
                medical assessment. Follow your therapist's advice.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setCompleted(false);
              setStarted(false);
              setPaused(false);
              setExerciseIndex(0);
              setReps(0);
              setPoseDetected(false);
              setCameraReady(false);
              setDetectionConfidence(0);
              setLiveStep(0);

              resetSessionClock();
              resetFeedback();

              repDetectorRef.current = newDetectorState();

              repsRef.current = 0;

              setGuidance('Position yourself in front of the camera.');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  LOADING                                 */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5B6CFF" />

          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              MAIN SCREEN                                 */
  /* ------------------------------------------------------------------------ */

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {!started ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.startScrollContent}
          >
            {/* HEADER */}

            <View style={styles.header}>
              <TouchableOpacity
                onPress={goBack}
                style={styles.backButton}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Back to exercises"
              >
                <Ionicons name="chevron-back" size={26} color="#111827" />
              </TouchableOpacity>

              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>PT Exercises</Text>

                <Text style={styles.subtitle}>
                  Follow the guided movements at your level.
                </Text>
              </View>
            </View>

            {/* LEVEL SELECTOR */}

            <View style={styles.levelCard}>
              <Text style={styles.sectionTitle}>Your level</Text>

              <View style={styles.levelRow}>
                {[1, 2].map((level) => {
                  const locked = level > assignedLevel;

                  const active = selectedLevel === level;

                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelButton,
                        active && styles.levelButtonActive,
                        locked && styles.levelButtonLocked,
                      ]}
                      onPress={() => handleLevelChange(level)}
                      disabled={locked}
                      activeOpacity={0.85}
                    >
                      <View
                        style={[
                          styles.levelIcon,
                          active && styles.levelIconActive,
                          locked && styles.levelIconLocked,
                        ]}
                      >
                        <Ionicons
                          name={
                            locked
                              ? 'lock-closed'
                              : level === 1
                              ? 'body-outline'
                              : 'walk-outline'
                          }
                          size={23}
                          color={
                            active ? '#FFFFFF' : locked ? '#9CA3AF' : '#5B6CFF'
                          }
                        />
                      </View>

                      <View style={styles.levelTextContainer}>
                        <Text
                          style={[
                            styles.levelName,
                            active && styles.levelNameActive,
                            locked && styles.levelNameLocked,
                          ]}
                        >
                          Level {level}
                        </Text>

                        <Text
                          style={[
                            styles.levelDescription,
                            active && styles.levelDescriptionActive,
                          ]}
                        >
                          {EXERCISE_LEVELS[level].name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {detectionOff && PT_USE_FRAME_PROCESSOR ? (
              <View
                style={[styles.stalledCard, { marginTop: 0, marginBottom: 14 }]}
              >
                <Text style={styles.stalledText}>
                  Camera movement detection is paused because the app closed
                  unexpectedly last time. You can still do the exercises and
                  count reps yourself.
                </Text>

                <TouchableOpacity
                  style={styles.stalledButton}
                  onPress={retryDetection}
                  activeOpacity={0.85}
                >
                  <Text style={styles.stalledButtonText}>
                    Try detection again
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* SESSION CARD */}

            <View style={styles.startCard}>
              <View style={styles.startIcon}>
                <Ionicons name="fitness-outline" size={30} color="#5B6CFF" />
              </View>

              <Text style={styles.startTitle}>Ready to exercise?</Text>

              <Text style={styles.startDescription}>
                Your exercises will guide you one at a time. The camera will
                automatically detect your movements, count your reps, and give
                you tips on how to improve.
              </Text>

              <View style={styles.sessionInfo}>
                <View style={styles.sessionInfoItem}>
                  <Ionicons name="list-outline" size={18} color="#6B7280" />

                  <Text style={styles.sessionInfoText}>
                    {exercises.length} exercises
                  </Text>
                </View>

                <View style={styles.sessionInfoItem}>
                  <Ionicons name="repeat-outline" size={18} color="#6B7280" />

                  <Text style={styles.sessionInfoText}>
                    {TOTAL_REPS} reps each
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={startExercise}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={19} color="#FFFFFF" />

                <Text style={styles.primaryButtonText}>Start Exercise</Text>
              </TouchableOpacity>
            </View>

            {currentLevel?.description ? (
              <View style={styles.levelInfoCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={19}
                  color="#5B6CFF"
                />

                <Text style={styles.levelInfoText}>
                  {currentLevel.description}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.activeScrollContent}
          >
            {/* ACTIVE SESSION HEADER */}

            <View style={styles.activeHeader}>
              <View>
                <Text style={styles.activeLevel}>Level {selectedLevel}</Text>

                <Text style={styles.activeTitle}>
                  Exercise {exerciseIndex + 1} of {exercises.length}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.endButton}
                onPress={stopSession}
                activeOpacity={0.85}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* EXERCISE NAME */}

            <View style={styles.exerciseHeaderCard}>
              <View style={styles.exerciseNumber}>
                <Text style={styles.exerciseNumberText}>
                  {exerciseIndex + 1}
                </Text>
              </View>

              <View style={styles.exerciseHeaderText}>
                <Text style={styles.exerciseName}>{currentExercise?.name}</Text>

                <Text style={styles.exerciseCategory}>
                  {currentExercise?.category}
                </Text>
              </View>
            </View>

            {/* CAMERA */}

            <View style={styles.cameraCard}>
              <View style={styles.cameraContainer}>
                {device && hasPermission ? (
                  <>
                    <Camera
                      style={StyleSheet.absoluteFill}
                      device={device}
                      isActive={started && !paused}
                      format={format}
                      fps={cameraFps}
                      frameProcessor={
                        poseLandmarkerPlugin && poseOn && cameraReady && PT_STAGE >= 2
                          ? frameProcessor
                          : undefined
                      }
                      pixelFormat="rgb"
                      onInitialized={() => {
                        ptLog('camera initialized');
                        setCameraReady(true);
                      }}
                      onError={(error) => {
                        console.warn('Camera error:', error);

                        if (mountedRef.current) {
                          setCameraReady(false);
                        }
                      }}
                    />

                    {SHOW_POSE_OVERLAY ? (
                      <PoseOverlay
                        apiRef={overlayApiRef}
                        mirror={OVERLAY_MIRROR_X}
                      />
                    ) : null}
                  </>
                ) : (
                  <View style={styles.cameraUnavailable}>
                    <Ionicons name="camera-outline" size={42} color="#9CA3AF" />

                    <Text style={styles.cameraUnavailableTitle}>
                      Camera unavailable
                    </Text>

                    <Text style={styles.cameraUnavailableText}>
                      {!hasPermission
                        ? 'Camera access is needed for movement guidance.'
                        : 'No front camera was found on this device.'}
                    </Text>
                  </View>
                )}

                {/* CAMERA STATUS */}

                <View style={styles.cameraStatus}>
                  <View
                    style={[
                      styles.statusDot,
                      poseDetected && styles.statusDotActive,
                    ]}
                  />

                  <Text style={styles.cameraStatusText}>
                    {poseDetected
                      ? 'Movement detected'
                      : paused
                      ? 'Paused'
                      : detectionOff
                      ? 'Detection paused'
                      : !PT_USE_FRAME_PROCESSOR
                      ? 'Detection switched off (test)'
                      : !poseLandmarkerPlugin
                      ? 'Detection module missing'
                      : cameraReady
                      ? 'Looking for you'
                      : 'Starting camera'}
                  </Text>
                </View>

                {PT_DEBUG ? (
                  <View style={styles.debugBadge} pointerEvents="none">
                    <Text style={styles.debugBadgeText}>
                      {`${PT_BUILD} · stage ${PT_STAGE} · `}
                      {debugWorklet || 'waiting for camera frames...'}
                      {'\n'}
                      {debugPose || 'no pose result yet'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* REP COUNTER */}

            <View style={styles.repCard}>
              <View>
                <Text style={styles.repLabel}>Repetitions</Text>

                <Text style={styles.repNumber}>
                  {reps}

                  <Text style={styles.repTotal}> / {TOTAL_REPS}</Text>
                </Text>

                {accuracy != null ? (
                  <Text style={styles.accuracyText}>Accuracy {accuracy}%</Text>
                ) : null}
              </View>

              <View style={styles.repProgressContainer}>
                <View style={styles.repProgressBackground}>
                  <View
                    style={[
                      styles.repProgressFill,
                      { width: `${(reps / TOTAL_REPS) * 100}%` },
                    ]}
                  />
                </View>

                <Text style={styles.repProgressText}>
                  {Math.round((reps / TOTAL_REPS) * 100)} %
                </Text>
              </View>
            </View>

            {/* DETECTION STALLED FALLBACK */}

            {detectionStalled && !paused ? (
              <View style={styles.stalledCard}>
                <Text style={styles.stalledText}>
                  We are not picking up your movement. Sit back so your head,
                  shoulders and arms are in view, with good lighting.
                </Text>

                {SHOW_MANUAL_FALLBACK ? (
                  <TouchableOpacity
                    style={styles.stalledButton}
                    onPress={manualCountRep}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.stalledButtonText}>
                      Count rep manually
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* GUIDANCE */}

            <View style={styles.guidanceCard}>
              <View style={styles.guidanceIcon}>
                <Ionicons name="information-circle" size={23} color="#5B6CFF" />
              </View>

              <View style={styles.guidanceText}>
                <Text style={styles.guidanceTitle}>
                  {paused ? 'Paused' : 'Keep going'}
                </Text>

                <Text style={styles.guidanceMessage}>
                  {paused ? 'Resume when you are ready.' : currentStep}
                </Text>

                {!paused && guidance !== currentStep && (
                  <Text style={styles.liveGuidance}>{guidance}</Text>
                )}

                {!paused && repFeedback ? (
                  <Text style={styles.repFeedback}>{repFeedback}</Text>
                ) : null}

                {!paused && postureTip ? (
                  <Text style={styles.postureTip}>Tip: {postureTip}</Text>
                ) : null}
              </View>
            </View>

            {/* STEP INDICATORS */}

            <View style={styles.stepsCard}>
              {currentExercise?.steps?.map((step, index) => (
                <View
                  key={`${currentExercise.id}-${index}`}
                  style={styles.stepRow}
                >
                  <View
                    style={[
                      styles.stepCircle,
                      index <= currentStepIndex && styles.stepCircleActive,
                    ]}
                  >
                    {index < currentStepIndex ? (
                      <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumber,
                          index === currentStepIndex && styles.stepNumberActive,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.stepText,
                      index === currentStepIndex && styles.stepTextActive,
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            {/* CONTROLS */}

            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={togglePause}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={paused ? 'play' : 'pause'}
                  size={20}
                  color="#5B6CFF"
                />

                <Text style={styles.secondaryButtonText}>
                  {paused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={18} color="#6B7280" />

                <Text style={styles.timeText}>
                  {Math.floor(elapsedSeconds / 60)
                    .toString()
                    .padStart(2, '0')}
                  :{(elapsedSeconds % 60).toString().padStart(2, '0')}
                </Text>
              </View>
            </View>
          </ScrollView>
        )}

        {/* SAVING OVERLAY */}

        {saving && (
          <View style={styles.savingOverlay} pointerEvents="auto">
            <View style={styles.savingCard}>
              <ActivityIndicator size="small" color="#5B6CFF" />

              <Text style={styles.savingText}>Saving...</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   STYLES                                   */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  startScrollContent: {
    paddingBottom: 28,
  },

  activeScrollContent: {
    paddingBottom: 28,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F5',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingBottom: 18,
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

  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#000000',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
  },

  levelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },

  levelRow: {
    gap: 10,
  },

  levelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },

  levelButtonActive: {
    borderColor: '#5B6CFF',
    backgroundColor: '#F5F6FF',
  },

  levelButtonLocked: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },

  levelIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },

  levelIconActive: {
    backgroundColor: '#5B6CFF',
  },

  levelIconLocked: {
    backgroundColor: '#F3F4F6',
  },

  levelTextContainer: {
    flex: 1,
    marginLeft: 12,
  },

  levelName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  levelNameActive: {
    color: '#5B6CFF',
  },

  levelNameLocked: {
    color: '#9CA3AF',
  },

  levelDescription: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },

  levelDescriptionActive: {
    color: '#6366F1',
  },

  startCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginTop: 2,
  },

  startIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  startTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  startDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
  },

  sessionInfo: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 18,
    marginBottom: 18,
  },

  sessionInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  sessionInfoText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },

  levelInfoCard: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },

  levelInfoText: {
    flex: 1,
    marginLeft: 9,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: '#5B6CFF',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 10,
  },

  activeLevel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },

  activeTitle: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
  },

  endButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  exerciseHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 13,
    marginBottom: 10,
  },

  exerciseNumber: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  exerciseNumberText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#5B6CFF',
  },

  exerciseHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  exerciseName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  exerciseCategory: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },

  cameraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 7,
    overflow: 'hidden',
  },

  cameraContainer: {
    height: 230,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },

  cameraUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  cameraUnavailableTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
  },

  cameraUnavailableText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: '#6B7280',
  },

  cameraStatus: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    marginRight: 7,
  },

  statusDotActive: {
    backgroundColor: '#22A06B',
  },

  debugBadge: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },

  debugBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#FFFFFF',
  },

  cameraStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },

  repCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  repLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  repNumber: {
    marginTop: 1,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '800',
    color: '#111827',
  },

  repTotal: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '700',
  },

  accuracyText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },

  repProgressContainer: {
    width: '45%',
    alignItems: 'flex-end',
  },

  repProgressBackground: {
    width: '100%',
    height: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },

  repProgressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#5B6CFF',
  },

  repProgressText: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  stalledCard: {
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 17,
    padding: 14,
  },

  stalledText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },

  stalledButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stalledButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B6CFF',
  },

  guidanceCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 14,
    flexDirection: 'row',
  },

  guidanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  guidanceText: {
    flex: 1,
    marginLeft: 11,
  },

  guidanceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  guidanceMessage: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 19,
    color: '#374151',
  },

  repFeedback: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#047857',
    fontWeight: '700',
  },

  postureTip: {
    marginTop: 3,
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },

  liveGuidance: {
    marginTop: 3,
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },

  stepsCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 13,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 31,
  },

  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepCircleActive: {
    backgroundColor: '#5B6CFF',
    borderColor: '#5B6CFF',
  },

  stepNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
  },

  stepNumberActive: {
    color: '#FFFFFF',
  },

  stepText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 12,
    lineHeight: 17,
    color: '#9CA3AF',
  },

  stepTextActive: {
    color: '#374151',
    fontWeight: '700',
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 4,
  },

  secondaryButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5B6CFF',
  },

  timeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },

  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },

  completedContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 30,
    backgroundColor: '#FAF8F5',
  },

  completedIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#22A06B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  completedTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  completedSubtitle: {
    marginTop: 7,
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
  },

  completedCard: {
    width: '100%',
    marginTop: 24,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  completedStat: {
    flex: 1,
    alignItems: 'center',
  },

  completedStatNumber: {
    fontSize: 25,
    fontWeight: '800',
    color: '#111827',
  },

  completedStatLabel: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  completedDivider: {
    width: 1,
    height: 35,
    backgroundColor: '#E5E7EB',
  },

  summaryCard: {
    width: '100%',
    marginTop: 14,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },

  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  summaryRow: {
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  summaryRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  summaryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  summaryScore: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
  },

  summaryTip: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },

  summaryNote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: '#9CA3AF',
  },

  savingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 15,
  },

  savingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 14,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 3,
  },

  savingText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
});