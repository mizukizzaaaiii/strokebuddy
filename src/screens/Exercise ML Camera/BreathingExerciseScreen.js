import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications from 'expo-notifications';


// ==========================================
// PACED BREATHING SETTINGS
// ==========================================
//
// This is a gentle paced-breathing routine.
// It is NOT respiratory muscle-strength training.
//
// The routine intentionally does not include
// breath holding.
//

const TOTAL_CYCLES = 5;

const INHALE_SECONDS = 4;

const EXHALE_SECONDS = 6;


// ==========================================
// STORAGE
// ==========================================

const getStorageKey = (accountId) =>
  `strokebuddy_exercise_data_${
    accountId || 'default_patient'
  }`;


const getToday = () =>
  new Date().toISOString().split('T')[0];


const createDefaultData = () => ({
  version: 1,

  currentStreak: 0,

  longestStreak: 0,

  lastCompletedDate: null,

  totalCompletedSessions: 0,

  exercises: {
    facial: {
      completedToday: false,
      sessions: [],
      todayCount: 0,
    },

    breathing: {
      completedToday: false,
      sessions: [],
      todayCount: 0,
    },

    pt: {
      completedToday: false,
      sessions: [],
      todayCount: 0,
    },
  },

  sessions: [],
});


// ==========================================
// NOTIFICATIONS
// ==========================================

const NOTIFICATION_SETTINGS_PREFIX =
  'strokebuddy_notification_settings_';

const NOTIFICATION_MILESTONES_PREFIX =
  'strokebuddy_recovery_milestones_';

const DEFAULT_NOTIFICATION_SETTINGS = {
  medReminders: true,
  caregiverMessages: true,
  exerciseReminders: true,
  recoveryMilestones: true,
};

const RECOVERY_MILESTONES = [
  3,
  7,
  14,
  30,
];


// Keep notification behavior consistent
// with the rest of StrokeBuddy.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


const getNotificationSettingsKey = (
  accountId
) =>
  `${NOTIFICATION_SETTINGS_PREFIX}${
    accountId || 'default_patient'
  }`;


const getMilestoneNotificationKey = (
  accountId
) =>
  `${NOTIFICATION_MILESTONES_PREFIX}${
    accountId || 'default_patient'
  }`;


const getPatientNotificationSettings =
  async (accountId) => {

    try {

      const key =
        getNotificationSettingsKey(
          accountId
        );


      const saved =
        await AsyncStorage.getItem(
          key
        );


      if (!saved) {

        return {
          ...DEFAULT_NOTIFICATION_SETTINGS,
        };

      }


      const parsed =
        JSON.parse(saved);


      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(parsed || {}),
      };

    } catch (error) {

      console.log(
        'Breathing notification settings load error:',
        error
      );


      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
      };

    }

  };


const hasNotificationPermission =
  async () => {

    try {

      const permission =
        await Notifications.getPermissionsAsync();


      return (
        permission.granted === true ||
        permission.ios?.status ===
          Notifications.IosAuthorizationStatus
            ?.PROVISIONAL
      );

    } catch (error) {

      console.log(
        'Breathing notification permission check error:',
        error
      );


      return false;

    }

  };


// ==========================================
// BREATHING COMPLETION NOTIFICATION
// ==========================================

const sendBreathingCompletionNotification =
  async ({
    accountId,
  }) => {

    try {

      const settings =
        await getPatientNotificationSettings(
          accountId
        );


      // Exercise Reminders controls
      // exercise completion notifications.

      if (
        !settings.exerciseReminders
      ) {

        return;

      }


      const allowed =
        await hasNotificationPermission();


      if (!allowed) {

        return;

      }


      await Notifications.scheduleNotificationAsync({

        content: {

          title:
            'Breathing Routine Complete',

          body:
            `Great job completing ${TOTAL_CYCLES} paced breathing cycles! Your recovery progress has been saved.`,

          data: {

            type:
              'exercise_completion',

            category:
              'exerciseReminders',

            exerciseId:
              'breathing',

            patientId:
              accountId || null,

          },

        },

        trigger: {

          type:
            Notifications.SchedulableTriggerInputTypes
              .TIME_INTERVAL,

          seconds: 1,

          repeats: false,

        },

      });

    } catch (error) {

      console.log(
        'Breathing completion notification error:',
        error
      );

    }

  };


// ==========================================
// RECOVERY MILESTONE NOTIFICATION
// ==========================================

const sendRecoveryMilestoneNotification =
  async ({
    accountId,
    streak,
  }) => {

    try {

      if (
        !RECOVERY_MILESTONES.includes(
          streak
        )
      ) {

        return;

      }


      const settings =
        await getPatientNotificationSettings(
          accountId
        );


      // Recovery Milestones controls
      // streak milestone notifications.

      if (
        !settings.recoveryMilestones
      ) {

        return;

      }


      const allowed =
        await hasNotificationPermission();


      if (!allowed) {

        return;

      }


      const milestoneKey =
        getMilestoneNotificationKey(
          accountId
        );


      const saved =
        await AsyncStorage.getItem(
          milestoneKey
        );


      let notifiedMilestones = [];


      if (saved) {

        try {

          const parsed =
            JSON.parse(saved);


          if (
            Array.isArray(parsed)
          ) {

            notifiedMilestones =
              parsed;

          }

        } catch (error) {

          notifiedMilestones = [];

        }

      }


      // Prevent the same milestone from
      // repeatedly notifying the patient.

      if (
        notifiedMilestones.includes(
          streak
        )
      ) {

        return;

      }


      notifiedMilestones.push(
        streak
      );


      await AsyncStorage.setItem(
        milestoneKey,
        JSON.stringify(
          notifiedMilestones
        )
      );


      let body =
        'Keep going and stay consistent with your recovery exercises.';


      if (streak === 3) {

        body =
          'You have completed recovery exercises for 3 days in a row. Keep going!';

      } else if (streak === 7) {

        body =
          'One week of recovery activity! Great work staying consistent.';

      } else if (streak === 14) {

        body =
          'Two weeks of recovery activity! Your consistency is something to celebrate.';

      } else if (streak === 30) {

        body =
          '30 days of recovery activity! Amazing consistency.';

      }


      await Notifications.scheduleNotificationAsync({

        content: {

          title:
            `${streak}-Day Recovery Streak`,

          body,

          data: {

            type:
              'recovery_milestone',

            category:
              'recoveryMilestones',

            milestone:
              streak,

            patientId:
              accountId || null,

          },

        },

        trigger: {

          type:
            Notifications.SchedulableTriggerInputTypes
              .TIME_INTERVAL,

          seconds: 2,

          repeats: false,

        },

      });

    } catch (error) {

      console.log(
        'Recovery milestone notification error:',
        error
      );

    }

  };


// ==========================================
// SCREEN
// ==========================================

export default function BreathingExerciseScreen({
  navigation,
  route,
}) {

  const {
    name,
    accountId,
  } = route?.params || {};


  // ----------------------------------------
  // Exercise state
  // ----------------------------------------

  const [
    started,
    setStarted,
  ] = useState(false);


  const [
    completed,
    setCompleted,
  ] = useState(false);


  const [
    phase,
    setPhase,
  ] = useState('ready');


  const [
    seconds,
    setSeconds,
  ] = useState(0);


  const [
    cycle,
    setCycle,
  ] = useState(0);


  const [
    saving,
    setSaving,
  ] = useState(false);


  // ----------------------------------------
  // Prevent duplicate completion saves
  // ----------------------------------------

  const completionSaved =
    useRef(false);


  // ==========================================
  // BREATHING TIMER
  // ==========================================

  useEffect(() => {

    if (!started || completed) {
      return;
    }


    if (phase === 'ready') {
      return;
    }


    const interval = setInterval(() => {

      setSeconds((current) => {

        // ------------------------------------
        // INHALE
        // ------------------------------------

        if (
          phase === 'inhale' &&
          current >= INHALE_SECONDS - 1
        ) {

          setPhase('exhale');

          return 0;

        }


        // ------------------------------------
        // EXHALE
        // ------------------------------------

        if (
          phase === 'exhale' &&
          current >= EXHALE_SECONDS - 1
        ) {

          const nextCycle =
            cycle + 1;


          // ----------------------------------
          // Routine complete
          // ----------------------------------

          if (
            nextCycle >= TOTAL_CYCLES
          ) {

            finishExercise();

            return 0;

          }


          setCycle(nextCycle);

          setPhase('inhale');

          return 0;

        }


        return current + 1;

      });

    }, 1000);


    return () => {
      clearInterval(interval);
    };

  }, [
    started,
    completed,
    phase,
    cycle,
  ]);


  // ==========================================
  // START
  // ==========================================

  const startExercise = () => {

    completionSaved.current = false;

    setStarted(true);

    setCompleted(false);

    setCycle(0);

    setSeconds(0);

    setPhase('inhale');

  };


  // ==========================================
  // STOP EARLY
  // ==========================================

  const stopExercise = () => {

    setStarted(false);

    setPhase('ready');

    setSeconds(0);

    setCycle(0);

  };


  // ==========================================
  // FINISH
  // ==========================================

  const finishExercise = async () => {

    if (completionSaved.current) {
      return;
    }

    completionSaved.current = true;

    setStarted(false);

    setCompleted(true);

    setPhase('ready');

    setSeconds(0);

    await saveSession();

  };


  // ==========================================
  // SAVE SESSION
  // ==========================================

  const saveSession = async () => {

    try {

      setSaving(true);


      const key =
        getStorageKey(accountId);


      const saved =
        await AsyncStorage.getItem(key);


      const data =
        saved
          ? JSON.parse(saved)
          : createDefaultData();


      const today =
        getToday();


      // --------------------------------------
      // Capture previous streak before
      // updating it.
      // --------------------------------------

      const previousStreak =
        data.currentStreak || 0;


      const previousLastDate =
        data.lastCompletedDate;


      // --------------------------------------
      // Make sure required structures exist
      // --------------------------------------

      if (!data.exercises) {

        data.exercises =
          createDefaultData().exercises;

      }


      if (!data.exercises.breathing) {

        data.exercises.breathing =
          createDefaultData()
            .exercises
            .breathing;

      }


      if (!Array.isArray(data.sessions)) {

        data.sessions = [];

      }


      if (
        !Array.isArray(
          data.exercises.breathing.sessions
        )
      ) {

        data.exercises.breathing.sessions = [];

      }


      // --------------------------------------
      // Create session record
      // --------------------------------------

      const session = {

        id:
          `${Date.now()}_breathing`,

        exerciseId:
          'breathing',

        patientId:
          accountId || null,

        patientName:
          name || null,

        date:
          today,

        completedAt:
          new Date().toISOString(),

        cycles:
          TOTAL_CYCLES,

        inhaleSeconds:
          INHALE_SECONDS,

        exhaleSeconds:
          EXHALE_SECONDS,

        routineType:
          'paced_breathing',

        breathHold:
          false,

        status:
          'completed',

      };


      // --------------------------------------
      // Save global session
      // --------------------------------------

      data.sessions.push(session);


      // --------------------------------------
      // Save breathing-specific session
      // --------------------------------------

      data.exercises.breathing.sessions.push(
        session
      );


      // --------------------------------------
      // Daily progress
      // --------------------------------------

      data.exercises.breathing.todayCount =
        (data.exercises.breathing.todayCount || 0) + 1;


      data.exercises.breathing.completedToday =
        true;


      // --------------------------------------
      // Total completed sessions
      // --------------------------------------

      data.totalCompletedSessions =
        (data.totalCompletedSessions || 0) + 1;


      // --------------------------------------
      // Update recovery streak
      // --------------------------------------

      updateStreak(
        data,
        today
      );


      // --------------------------------------
      // Persist
      // --------------------------------------

      await AsyncStorage.setItem(
        key,
        JSON.stringify(data)
      );


      // ======================================
      // NOTIFICATION INTEGRATION
      // ======================================

      // Exercise completion notification.
      // Controlled by:
      // Settings > Notifications >
      // Exercise Reminders

      await sendBreathingCompletionNotification({
        accountId,
      });


      // Recovery milestone notification.
      // Controlled by:
      // Settings > Notifications >
      // Recovery Milestones

      const newStreak =
        data.currentStreak || 0;


      if (
        newStreak > previousStreak &&
        newStreak !== 0 &&
        previousLastDate !== today
      ) {

        await sendRecoveryMilestoneNotification({
          accountId,
          streak: newStreak,
        });

      }

    } catch (error) {

      console.log(
        'Breathing save error:',
        error
      );

    } finally {

      setSaving(false);

    }

  };


  // ==========================================
  // STREAK
  // ==========================================

  const updateStreak = (
    data,
    today
  ) => {

    // ----------------------------------------
    // Already completed something today
    // ----------------------------------------

    if (
      data.lastCompletedDate === today
    ) {

      return;

    }


    // ----------------------------------------
    // Continue yesterday's streak
    // ----------------------------------------

    if (
      data.lastCompletedDate &&
      isYesterday(
        data.lastCompletedDate
      )
    ) {

      data.currentStreak =
        (data.currentStreak || 0) + 1;

    } else {

      // --------------------------------------
      // New streak
      // --------------------------------------

      data.currentStreak = 1;

    }


    data.longestStreak =
      Math.max(
        data.longestStreak || 0,
        data.currentStreak
      );


    data.lastCompletedDate =
      today;

  };


  // ==========================================
  // YESTERDAY CHECK
  // ==========================================

  const isYesterday = (
    dateString
  ) => {

    const date =
      new Date(
        `${dateString}T00:00:00`
      );


    const yesterday =
      new Date();


    yesterday.setHours(
      0,
      0,
      0,
      0
    );


    yesterday.setDate(
      yesterday.getDate() - 1
    );


    return (
      date.getTime() ===
      yesterday.getTime()
    );

  };


  // ==========================================
  // PHASE INFORMATION
  // ==========================================

  const phaseText =
    phase === 'inhale'
      ? 'Inhale slowly'
      : phase === 'exhale'
        ? 'Exhale slowly'
        : 'Ready';


  const phaseSeconds =
    phase === 'inhale'
      ? INHALE_SECONDS - seconds
      : phase === 'exhale'
        ? EXHALE_SECONDS - seconds
        : 0;


  const currentCycle =
    Math.min(
      cycle + 1,
      TOTAL_CYCLES
    );


  // ==========================================
  // COMPLETED SCREEN
  // ==========================================

  if (completed) {

    return (

      <SafeAreaView
        style={styles.safeArea}
      >

        <View
          style={styles.completedContainer}
        >

          <View
            style={styles.successIcon}
          >

            <Ionicons
              name="checkmark"
              size={44}
              color="#FFFFFF"
            />

          </View>


          <Text
            style={styles.completedTitle}
          >
            Breathing Complete!
          </Text>


          <Text
            style={styles.completedSubtitle}
          >
            You completed {TOTAL_CYCLES} paced breathing cycles.
          </Text>


          <View
            style={styles.resultCard}
          >

            <View
              style={styles.resultItem}
            >

              <Text
                style={styles.resultNumber}
              >
                {TOTAL_CYCLES}
              </Text>

              <Text
                style={styles.resultLabel}
              >
                cycles
              </Text>

            </View>


            <View
              style={styles.resultDivider}
            />


            <View
              style={styles.resultItem}
            >

              <Text
                style={styles.resultNumber}
              >
                {INHALE_SECONDS}s
              </Text>

              <Text
                style={styles.resultLabel}
              >
                inhale
              </Text>

            </View>


            <View
              style={styles.resultDivider}
            />


            <View
              style={styles.resultItem}
            >

              <Text
                style={styles.resultNumber}
              >
                {EXHALE_SECONDS}s
              </Text>

              <Text
                style={styles.resultLabel}
              >
                exhale
              </Text>

            </View>

          </View>


          <View
            style={styles.completedInfo}
          >

            <Ionicons
              name="leaf-outline"
              size={20}
              color="#00A99D"
            />


            <Text
              style={styles.completedInfoText}
            >
              The routine used slow, continuous breathing without breath-holding.
            </Text>

          </View>


          <TouchableOpacity
            style={styles.doneButton}
            onPress={() =>
              navigation.goBack()
            }
          >

            <Text
              style={styles.doneButtonText}
            >
              Back to Exercises
            </Text>

          </TouchableOpacity>

        </View>

      </SafeAreaView>

    );

  }


  // ==========================================
  // MAIN SCREEN
  // ==========================================

  return (

    <SafeAreaView
      style={styles.safeArea}
    >

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={started}
            style={[styles.backButton, started && styles.disabledBackButton]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to exercises"
            accessibilityState={{ disabled: started }}
          >
            <Ionicons name="chevron-back" size={26} color="#111827" />
          </TouchableOpacity>

          <View style={styles.headerTextContainer}>
            <Text style={styles.header}>Paced Breathing</Text>

            <Text style={styles.subtitle}>
              Slow, comfortable breathing practice
            </Text>
          </View>
        </View>


        {/* BREATHING VISUAL */}

        <View
          style={styles.breathingArea}
        >

          <View
            style={[
              styles.breathCircleOuter,
              started &&
                phase === 'inhale' &&
                styles.outerInhale,
              started &&
                phase === 'exhale' &&
                styles.outerExhale,
            ]}
          >

            <View
              style={[
                styles.breathCircle,
                started &&
                  phase === 'inhale' &&
                  styles.breathCircleInhale,
                started &&
                  phase === 'exhale' &&
                  styles.breathCircleExhale,
              ]}
            >

              {started ? (

                <>

                  <Text
                    style={styles.phaseNumber}
                  >
                    {phaseSeconds}
                  </Text>


                  <Text
                    style={styles.phaseText}
                  >
                    {phaseText}
                  </Text>

                </>

              ) : (

                <Ionicons
                  name="leaf-outline"
                  size={48}
                  color="#FFFFFF"
                />

              )}

            </View>

          </View>


          {started && (

            <Text
              style={styles.cycleText}
            >
              Cycle {currentCycle} of {TOTAL_CYCLES}
            </Text>

          )}

        </View>


        {/* RHYTHM */}

        <View
          style={styles.rhythmCard}
        >

          <Text
            style={styles.rhythmTitle}
          >
            Today's breathing rhythm
          </Text>


          <View
            style={styles.rhythmRow}
          >

            <View
              style={styles.rhythmItem}
            >

              <View
                style={[
                  styles.rhythmIcon,
                  styles.inhaleIcon,
                ]}
              >

                <Ionicons
                  name="arrow-down"
                  size={20}
                  color="#00A99D"
                />

              </View>


              <Text
                style={styles.rhythmNumber}
              >
                {INHALE_SECONDS}s
              </Text>


              <Text
                style={styles.rhythmLabel}
              >
                Inhale
              </Text>

            </View>


            <Ionicons
              name="arrow-forward"
              size={20}
              color="#B0B4C0"
            />


            <View
              style={styles.rhythmItem}
            >

              <View
                style={[
                  styles.rhythmIcon,
                  styles.exhaleIcon,
                ]}
              >

                <Ionicons
                  name="arrow-up"
                  size={20}
                  color="#6366F1"
                />

              </View>


              <Text
                style={styles.rhythmNumber}
              >
                {EXHALE_SECONDS}s
              </Text>


              <Text
                style={styles.rhythmLabel}
              >
                Exhale
              </Text>

            </View>

          </View>

        </View>


        {/* INSTRUCTIONS */}

        <View
          style={styles.infoCard}
        >

          <View
            style={styles.infoHeader}
          >

            <Ionicons
              name="information-circle-outline"
              size={21}
              color="#6366F1"
            />


            <Text
              style={styles.infoTitle}
            >
              How to do it
            </Text>

          </View>


          <Text
            style={styles.instruction}
          >
            1. Sit comfortably with your feet supported.
          </Text>


          <Text
            style={styles.instruction}
          >
            2. Breathe in gently through your nose for 4 seconds.
          </Text>


          <Text
            style={styles.instruction}
          >
            3. Breathe out slowly for 6 seconds.
          </Text>


          <Text
            style={styles.instruction}
          >
            4. Repeat for 5 cycles.
          </Text>


          <Text
            style={styles.description}
          >
            Keep your shoulders relaxed. Do not force a deep breath and do not hold your breath. Breathe normally if the pace feels uncomfortable.
          </Text>

        </View>


        {/* SAFETY */}

        <View
          style={styles.safetyCard}
        >

          <Ionicons
            name="shield-checkmark-outline"
            size={21}
            color="#D97706"
          />


          <View
            style={styles.safetyContent}
          >

            <Text
              style={styles.safetyTitle}
            >
              Safety first
            </Text>


            <Text
              style={styles.safetyText}
            >
              Stop if you feel dizzy, unusually short of breath, have chest discomfort, or feel unwell. This routine is general breathing practice and does not replace a personalized rehabilitation program from a doctor, physical therapist, or respiratory therapist.
            </Text>

          </View>

        </View>


        {/* START / STOP */}

        {!started ? (

          <TouchableOpacity
            style={styles.startButton}
            onPress={startExercise}
          >

            <Ionicons
              name="play"
              size={20}
              color="#FFFFFF"
            />


            <Text
              style={styles.startButtonText}
            >
              Start Breathing Routine
            </Text>

          </TouchableOpacity>

        ) : (

          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopExercise}
          >

            <Ionicons
              name="stop"
              size={19}
              color="#FFFFFF"
            />


            <Text
              style={styles.startButtonText}
            >
              Stop Routine
            </Text>

          </TouchableOpacity>

        )}


        {saving && (

          <Text
            style={styles.savingText}
          >
            Saving your recovery session...
          </Text>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  container: {
    padding: 20,
    paddingBottom: 45,
  },

    headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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

  disabledBackButton: {
    opacity: 0.35,
  },

  headerTextContainer: {
    flex: 1,
  },

  header: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
  },

  subtitle: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
    marginBottom: 16,
  },

  // ========================================
  // BREATHING AREA
  // ========================================

  breathingArea: {
    height: 285,
    backgroundColor: '#0B111E',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  breathCircleOuter: {
    width: 205,
    height: 205,
    borderRadius: 103,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  outerInhale: {
    backgroundColor: 'rgba(0,169,157,0.16)',
  },

  outerExhale: {
    backgroundColor: 'rgba(99,102,241,0.16)',
  },

  breathCircle: {
    width: 155,
    height: 155,
    borderRadius: 78,
    backgroundColor: '#3C4557',
    justifyContent: 'center',
    alignItems: 'center',
  },

  breathCircleInhale: {
    backgroundColor: '#00A99D',
  },

  breathCircleExhale: {
    backgroundColor: '#6366F1',
  },

  phaseNumber: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
  },

  phaseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },

  cycleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
    opacity: 0.9,
  },

  // ========================================
  // RHYTHM CARD
  // ========================================

  rhythmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },

  rhythmTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
    marginBottom: 14,
  },

  rhythmRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  rhythmItem: {
    width: 105,
    alignItems: 'center',
  },

  rhythmIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },

  inhaleIcon: {
    backgroundColor: '#E1F7F4',
  },

  exhaleIcon: {
    backgroundColor: '#EEF0FF',
  },

  rhythmNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
  },

  rhythmLabel: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },

  // ========================================
  // INFO
  // ========================================

  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333',
    marginLeft: 7,
  },

  instruction: {
    fontSize: 12,
    color: '#444',
    lineHeight: 19,
    marginBottom: 4,
  },

  description: {
    fontSize: 11,
    color: '#666',
    lineHeight: 17,
    marginTop: 8,
  },

  // ========================================
  // SAFETY
  // ========================================

  safetyCard: {
    backgroundColor: '#FFF8E8',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F4E4B7',
  },

  safetyContent: {
    flex: 1,
    marginLeft: 8,
  },

  safetyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },

  safetyText: {
    fontSize: 11,
    color: '#78500D',
    lineHeight: 17,
  },

  // ========================================
  // BUTTONS
  // ========================================

  startButton: {
    backgroundColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  stopButton: {
    backgroundColor: '#8A8F9B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 7,
  },

  savingText: {
    textAlign: 'center',
    color: '#777',
    fontSize: 11,
    marginTop: 10,
  },

  // ========================================
  // COMPLETED
  // ========================================

  completedContainer: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },

  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#74B58A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  completedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
  },

  completedSubtitle: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 25,
  },

  resultCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  resultItem: {
    alignItems: 'center',
    flex: 1,
  },

  resultNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#5B6CFF',
  },

  resultLabel: {
    fontSize: 11,
    color: '#777',
    marginTop: 2,
  },

  resultDivider: {
    width: 1,
    height: 42,
    backgroundColor: '#E5E7EB',
  },

  completedInfo: {
    width: '100%',
    backgroundColor: '#EEF9F7',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  completedInfoText: {
    flex: 1,
    color: '#28756D',
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 8,
  },

  doneButton: {
    width: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },

});