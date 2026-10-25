import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  useAccessibility,
} from '../context/AccessibilityContext';


// ==========================================
// EXERCISE DEFINITIONS
// ==========================================

const EXERCISES = [
  {
    id: 'facial',
    title: 'Facial & Speech',
    subtitle: 'Facial movement and speech practice',
    icon: 'happy-outline',
    color: '#FF9500',
    route: 'FacialExercise',
    target: 'Smile evenly and hold for 3 seconds.',
  },

  {
    id: 'breathing',
    title: 'Breathing Exercises',
    subtitle: 'Slow breathing and controlled expansion',
    icon: 'leaf-outline',
    color: '#00A99D',
    route: 'BreathingExercise',
    target: 'Complete a slow breathing cycle.',
  },

  {
    id: 'pt',
    title: 'Physical Therapy',
    subtitle: 'Guided movement and rehabilitation',
    icon: 'body-outline',
    color: '#34A853',
    route: 'PTExercise',
    target: 'Complete 10 controlled repetitions.',
  },
];


// ==========================================
// PATIENT EXPERIENCE DEFAULTS
// ==========================================

const DEFAULT_PATIENT_EXPERIENCE = {
  recoveryTips: true,
  dailyMotivation: true,
  exerciseConfirmation: true,
  streakCelebrations: true,
  progressUpdates: true,
  caregiverSharingReminder: true,
};


// ==========================================
// STORAGE HELPERS
// ==========================================

const getStorageKey = (accountId) =>
  `strokebuddy_exercise_data_${
    accountId || 'default_patient'
  }`;


const getPatientExperienceKey = (accountId) =>
  `strokebuddy_patient_experience_${
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
// COMPONENT
// ==========================================

export default function ExercisesScreen({
  navigation,
  route,
}) {

  const {
    name,
    role,
    email,
    accountId,
  } = route?.params || {};


  // ==========================================
  // ACCESSIBILITY
  // ==========================================

  const {
    largeText,
    highContrast,
  } = useAccessibility();


  // ==========================================
  // STATE
  // ==========================================

  const [
    exerciseData,
    setExerciseData,
  ] = useState(null);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    patientExperience,
    setPatientExperience,
  ] = useState(
    DEFAULT_PATIENT_EXPERIENCE
  );


  // ==========================================
  // LOAD PATIENT EXPERIENCE SETTINGS
  // ==========================================

  const loadPatientExperienceSettings =
    async () => {

      try {

        const key =
          getPatientExperienceKey(
            accountId
          );


        const saved =
          await AsyncStorage.getItem(
            key
          );


        if (!saved) {

          setPatientExperience(
            DEFAULT_PATIENT_EXPERIENCE
          );

          return;

        }


        const settings =
          JSON.parse(saved);


        setPatientExperience({

          recoveryTips:
            typeof settings.recoveryTips === 'boolean'
              ? settings.recoveryTips
              : true,

          dailyMotivation:
            typeof settings.dailyMotivation === 'boolean'
              ? settings.dailyMotivation
              : true,

          exerciseConfirmation:
            typeof settings.exerciseConfirmation === 'boolean'
              ? settings.exerciseConfirmation
              : true,

          streakCelebrations:
            typeof settings.streakCelebrations === 'boolean'
              ? settings.streakCelebrations
              : true,

          progressUpdates:
            typeof settings.progressUpdates === 'boolean'
              ? settings.progressUpdates
              : true,

          caregiverSharingReminder:
            typeof settings.caregiverSharingReminder === 'boolean'
              ? settings.caregiverSharingReminder
              : true,

        });

      } catch (error) {

        console.log(
          'Patient Experience settings load error:',
          error
        );


        setPatientExperience(
          DEFAULT_PATIENT_EXPERIENCE
        );

      }

    };


  // ==========================================
  // LOAD EXERCISE DATA
  // ==========================================

  const loadExerciseData = async () => {

    try {

      setLoading(true);


      // ----------------------------------------
      // LOAD PATIENT EXPERIENCE
      // ----------------------------------------

      await loadPatientExperienceSettings();


      // ----------------------------------------
      // LOAD EXERCISE DATA
      // ----------------------------------------

      const key =
        getStorageKey(accountId);


      const saved =
        await AsyncStorage.getItem(key);


      let data;


      if (saved) {

        data =
          JSON.parse(saved);

      } else {

        data =
          createDefaultData();

      }


      // ----------------------------------------
      // SAFETY DEFAULTS FOR OLDER DATA
      // ----------------------------------------

      data.exercises =
        data.exercises || {};


      EXERCISES.forEach(
        (exercise) => {

          if (
            !data.exercises[
              exercise.id
            ]
          ) {

            data.exercises[
              exercise.id
            ] = {

              completedToday:
                false,

              sessions:
                [],

              todayCount:
                0,

            };

          }

        }
      );


      data.sessions =
        Array.isArray(data.sessions)
          ? data.sessions
          : [];


      data.currentStreak =
        Number(
          data.currentStreak
        ) || 0;


      data.longestStreak =
        Number(
          data.longestStreak
        ) || 0;


      data.totalCompletedSessions =
        Number(
          data.totalCompletedSessions
        ) || 0;


      // ----------------------------------------
      // RESET DAILY FLAGS WHEN NEW DAY BEGINS
      // ----------------------------------------

      const today =
        getToday();


      const lastCompleted =
        data.lastCompletedDate;


      if (
        lastCompleted &&
        lastCompleted !== today
      ) {

        Object.keys(
          data.exercises
        ).forEach(
          (id) => {

            if (
              data.exercises[id]
            ) {

              data.exercises[id]
                .completedToday =
                  false;

              data.exercises[id]
                .todayCount =
                  0;

            }

          }
        );

      }


      // ----------------------------------------
      // SAVE NORMALIZED DATA
      // ----------------------------------------

      await AsyncStorage.setItem(
        key,
        JSON.stringify(data)
      );


      setExerciseData(data);

    } catch (error) {

      console.log(
        'Exercise data load error:',
        error
      );


      const fallback =
        createDefaultData();


      setExerciseData(
        fallback
      );

    } finally {

      setLoading(false);

    }

  };


  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {

    loadExerciseData();

  }, [accountId]);


  // ==========================================
  // RELOAD WHEN SCREEN RECEIVES FOCUS
  // ==========================================

  useFocusEffect(
    useCallback(() => {

      loadPatientExperienceSettings();

      loadExerciseData();

    }, [accountId])
  );


  // ==========================================
  // GET EXERCISE PROGRESS
  // ==========================================

  const getExerciseProgress =
    (id) => {

      if (
        !exerciseData?.exercises?.[id]
      ) {

        return 0;

      }


      const exercise =
        exerciseData.exercises[id];


      if (
        exercise.completedToday
      ) {

        return 100;

      }


      if (
        id === 'pt' &&
        exercise.todayCount
      ) {

        return Math.min(
          100,
          Math.round(
            (
              exercise.todayCount /
              10
            ) * 100
          )
        );

      }


      return 0;

    };


  // ==========================================
  // TOTAL DAILY PROGRESS
  // ==========================================

  const completedCount =
    EXERCISES.filter(
      (exercise) =>
        exerciseData?.exercises?.[
          exercise.id
        ]?.completedToday
    ).length;


  const totalProgress =
    Math.round(
      (
        completedCount /
        EXERCISES.length
      ) * 100
    );


  // ==========================================
  // NAVIGATE TO EXERCISE
  // ==========================================

  const openExercise =
    (exercise) => {

      navigation.navigate(
        exercise.route,
        {
          name,
          role,
          email,
          accountId,

          // ------------------------------------
          // PATIENT EXPERIENCE PREFERENCE
          // ------------------------------------
          exerciseConfirmation:
            patientExperience
              .exerciseConfirmation,
        }
      );

    };


  // ==========================================
  // ACCESSIBILITY COLORS
  // ==========================================

  const textColor =
    highContrast
      ? '#000000'
      : '#1F2937';


  const secondaryTextColor =
    highContrast
      ? '#1F2937'
      : '#777777';


  const primaryColor =
    highContrast
      ? '#000000'
      : '#5B6CFF';


  const borderColor =
    highContrast
      ? '#111827'
      : '#E5E7EB';


  // ==========================================
  // LOADING
  // ==========================================

  if (
    loading ||
    !exerciseData
  ) {

    return (

      <SafeAreaView
        style={[
          styles.safeArea,
          highContrast &&
            styles.highContrastBackground,
        ]}
      >

        <View
          style={styles.loadingContainer}
        >

          <ActivityIndicator
            size="large"
            color={primaryColor}
          />


          <Text
            style={[
              styles.loadingText,
              largeText &&
                styles.loadingTextLarge,
              {
                color:
                  secondaryTextColor,
              },
            ]}
            allowFontScaling={true}
          >
            Loading your exercises...
          </Text>

        </View>

      </SafeAreaView>

    );

  }


  // ==========================================
  // MAIN
  // ==========================================

  return (

    <SafeAreaView
      style={[
        styles.safeArea,
        highContrast &&
          styles.highContrastBackground,
      ]}
    >

      <ScrollView
        contentContainerStyle={[
          styles.container,
          largeText &&
            styles.containerLarge,
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ==================================
            HEADER
        ================================== */}

        <View
          style={[
            styles.header,
            largeText &&
              styles.headerLarge,
          ]}
        >

          <Text
            style={[
              styles.headerTitle,
              largeText &&
                styles.headerTitleLarge,
              {
                color:
                  '#000000',
              },
            ]}
            allowFontScaling={true}
          >
            Guided Exercises
          </Text>


          <Text
            style={[
              styles.headerSubtitle,
              largeText &&
                styles.headerSubtitleLarge,
              {
                color:
                  secondaryTextColor,
              },
            ]}
            allowFontScaling={true}
          >
            Practice your recovery exercises at your own pace.
          </Text>

        </View>


        {/* ==================================
            DAILY PROGRESS
        ================================== */}

        <View
          style={[
            styles.progressCard,
            largeText &&
              styles.progressCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
        >

          <View
            style={[
              styles.progressIcon,
              largeText &&
                styles.progressIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >

            <Ionicons
              name="fitness-outline"
              size={
                largeText
                  ? 32
                  : 27
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />

          </View>


          <View
            style={styles.progressInfo}
          >

            <Text
              style={[
                styles.progressTitle,
                largeText &&
                  styles.progressTitleLarge,
                {
                  color:
                    textColor,
                },
              ]}
              allowFontScaling={true}
            >
              Today's Recovery
            </Text>


            <Text
              style={[
                styles.progressSubtitle,
                largeText &&
                  styles.progressSubtitleLarge,
                {
                  color:
                    secondaryTextColor,
                },
              ]}
              allowFontScaling={true}
            >
              {completedCount} of {EXERCISES.length}{' '}
              routines completed
            </Text>


            <View
              style={[
                styles.progressBackground,
                highContrast &&
                  styles.highContrastProgressBackground,
              ]}
            >

              <View
                style={[
                  styles.progressFill,
                  highContrast &&
                    styles.highContrastProgressFill,
                  {
                    width:
                      `${totalProgress}%`,
                  },
                ]}
              />

            </View>

          </View>


          <Text
            style={[
              styles.progressPercent,
              largeText &&
                styles.progressPercentLarge,
              {
                color:
                  primaryColor,
              },
            ]}
            allowFontScaling={true}
          >
            {totalProgress}%
          </Text>

        </View>


        {/* ==================================
            STREAK
        ================================== */}

        {patientExperience.streakCelebrations && (

          <View
            style={[
              styles.streakCard,
              largeText &&
                styles.streakCardLarge,
              highContrast &&
                styles.highContrastCard,
            ]}
          >

            <View
              style={[
                styles.streakIcon,
                largeText &&
                  styles.streakIconLarge,
                highContrast &&
                  styles.highContrastIconCircle,
              ]}
            >

              <Ionicons
                name="flame-outline"
                size={
                  largeText
                    ? 32
                    : 27
                }
                color={
                  highContrast
                    ? '#000000'
                    : '#F59E0B'
                }
              />

            </View>


            <View
              style={styles.streakInfo}
            >

              <Text
                style={[
                  styles.streakTitle,
                  largeText &&
                    styles.streakTitleLarge,
                  {
                    color:
                      textColor,
                  },
                ]}
                allowFontScaling={true}
              >
                Recovery Streak
              </Text>


              <Text
                style={[
                  styles.streakSubtitle,
                  largeText &&
                    styles.streakSubtitleLarge,
                  {
                    color:
                      secondaryTextColor,
                  },
                ]}
                allowFontScaling={true}
              >
                Keep completing exercises to build your streak.
              </Text>

            </View>


            <View
              style={
                styles.streakNumberContainer
              }
            >

              <Text
                style={[
                  styles.streakNumber,
                  largeText &&
                    styles.streakNumberLarge,
                  {
                    color:
                      highContrast
                        ? '#000000'
                        : '#F59E0B',
                  },
                ]}
                allowFontScaling={true}
              >
                {exerciseData.currentStreak}
              </Text>


              <Text
                style={[
                  styles.streakDays,
                  largeText &&
                    styles.streakDaysLarge,
                  {
                    color:
                      secondaryTextColor,
                  },
                ]}
                allowFontScaling={true}
              >
                days
              </Text>

            </View>

          </View>

        )}


        {/* ==================================
            EXERCISES
        ================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.sectionTitleLarge,
            {
              color:
                textColor,
            },
          ]}
          allowFontScaling={true}
        >
          Today's Routines
        </Text>


        {EXERCISES.map(
          (exercise) => {

            const progress =
              getExerciseProgress(
                exercise.id
              );


            const completed =
              exerciseData.exercises?.[
                exercise.id
              ]?.completedToday;


            return (

              <TouchableOpacity
                key={exercise.id}
                style={[
                  styles.card,
                  largeText &&
                    styles.cardLarge,
                  highContrast &&
                    styles.highContrastCard,
                ]}
                onPress={() =>
                  openExercise(exercise)
                }
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={
                  `${exercise.title}. ${exercise.subtitle}`
                }
              >

                <View
                  style={[
                    styles.exerciseIcon,
                    largeText &&
                      styles.exerciseIconLarge,
                    {
                      backgroundColor:
                        highContrast
                          ? '#FFFFFF'
                          : `${exercise.color}18`,
                    },
                    highContrast &&
                      styles.highContrastExerciseIcon,
                  ]}
                >

                  <Ionicons
                    name={exercise.icon}
                    size={
                      largeText
                        ? 32
                        : 27
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : exercise.color
                    }
                  />

                </View>


                <View
                  style={styles.cardContent}
                >

                  <View
                    style={styles.cardTitleRow}
                  >

                    <Text
                      style={[
                        styles.cardTitle,
                        largeText &&
                          styles.cardTitleLarge,
                        {
                          color:
                            textColor,
                        },
                      ]}
                      allowFontScaling={true}
                    >
                      {exercise.title}
                    </Text>


                    {completed && (

                      <Ionicons
                        name="checkmark-circle"
                        size={
                          largeText
                            ? 26
                            : 21
                        }
                        color={
                          highContrast
                            ? '#000000'
                            : '#34A853'
                        }
                      />

                    )}

                  </View>


                  <Text
                    style={[
                      styles.cardSub,
                      largeText &&
                        styles.cardSubLarge,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                    allowFontScaling={true}
                  >
                    {exercise.subtitle}
                  </Text>


                  <Text
                    style={[
                      styles.targetText,
                      largeText &&
                        styles.targetTextLarge,
                      {
                        color:
                          secondaryTextColor,
                      },
                    ]}
                    allowFontScaling={true}
                  >
                    {exercise.target}
                  </Text>


                  <View
                    style={[
                      styles.progressBackground,
                      highContrast &&
                        styles.highContrastProgressBackground,
                    ]}
                  >

                    <View
                      style={[
                        styles.progressFill,
                        highContrast &&
                          styles.highContrastProgressFill,
                        {
                          width:
                            `${progress}%`,
                          backgroundColor:
                            highContrast
                              ? '#000000'
                              : exercise.color,
                        },
                      ]}
                    />

                  </View>

                </View>


                <Ionicons
                  name="chevron-forward"
                  size={
                    largeText
                      ? 28
                      : 21
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#9CA3AF'
                  }
                />

              </TouchableOpacity>

            );

          }
        )}


        {/* ==================================
            EXERCISE CONFIRMATION STATUS
        ================================== */}

        <View
          style={[
            styles.preferenceStatusCard,
            largeText &&
              styles.preferenceStatusCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
        >

          <View
            style={[
              styles.preferenceStatusIcon,
              largeText &&
                styles.preferenceStatusIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >

            <Ionicons
              name={
                patientExperience
                  .exerciseConfirmation
                  ? 'checkmark-circle-outline'
                  : 'flash-off-outline'
              }
              size={
                largeText
                  ? 27
                  : 21
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />

          </View>


          <View
            style={styles.preferenceStatusInfo}
          >

            <Text
              style={[
                styles.preferenceStatusTitle,
                largeText &&
                  styles.preferenceStatusTitleLarge,
                {
                  color:
                    textColor,
                },
              ]}
              allowFontScaling={true}
            >
              Exercise Completion Confirmation
            </Text>


            <Text
              style={[
                styles.preferenceStatusText,
                largeText &&
                  styles.preferenceStatusTextLarge,
                {
                  color:
                    secondaryTextColor,
                },
              ]}
              allowFontScaling={true}
            >
              {patientExperience.exerciseConfirmation
                ? 'You will be asked to confirm when an exercise is completed.'
                : 'Exercises can be completed without an extra confirmation step.'}
            </Text>

          </View>

        </View>


        {/* ==================================
            INFO
        ================================== */}

        <View
          style={[
            styles.infoCard,
            largeText &&
              styles.infoCardLarge,
            highContrast &&
              styles.highContrastInfoCard,
          ]}
        >

          <View
            style={[
              styles.infoIcon,
              largeText &&
                styles.infoIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >

            <Ionicons
              name="information-circle-outline"
              size={
                largeText
                  ? 27
                  : 21
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />

          </View>


          <Text
            style={[
              styles.infoText,
              largeText &&
                styles.infoTextLarge,
              {
                color:
                  highContrast
                    ? '#000000'
                    : '#5B5BD6',
              },
            ]}
            allowFontScaling={true}
          >
            StrokeBuddy records your completed exercise sessions so your recovery progress can be viewed over time.
          </Text>

        </View>

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  // ========================================
  // MAIN SCREEN
  // ========================================

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  highContrastBackground: {
    backgroundColor: '#FFFFFF',
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  containerLarge: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 80,
  },


  // ========================================
  // LOADING
  // ========================================

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },

  loadingTextLarge: {
    fontSize: 17,
  },


  // ========================================
  // HEADER
  // ========================================

  header: {
    marginBottom: 20,
  },

  headerLarge: {
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  headerTitleLarge: {
    fontSize: 34,
    lineHeight: 42,
  },

  headerSubtitle: {
    fontSize: 14,
    marginTop: 5,
    lineHeight: 20,
  },

  headerSubtitleLarge: {
    fontSize: 18,
    lineHeight: 26,
    marginTop: 7,
  },


  // ========================================
  // GENERAL HIGH CONTRAST
  // ========================================

  highContrastCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },


  // ========================================
  // DAILY PROGRESS
  // ========================================

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  progressCardLarge: {
    paddingVertical: 20,
    paddingHorizontal: 19,
    borderRadius: 22,
    marginBottom: 15,
  },

  progressIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  progressIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 15,
  },

  progressInfo: {
    flex: 1,
  },

  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  progressTitleLarge: {
    fontSize: 21,
    lineHeight: 28,
  },

  progressSubtitle: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 9,
  },

  progressSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
    marginBottom: 12,
  },

  progressBackground: {
    height: 7,
    backgroundColor: '#ECECF2',
    borderRadius: 6,
    overflow: 'hidden',
  },

  highContrastProgressBackground: {
    backgroundColor: '#D1D5DB',
    borderWidth: 1,
    borderColor: '#111827',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#5B6CFF',
    borderRadius: 6,
  },

  highContrastProgressFill: {
    backgroundColor: '#000000',
  },

  progressPercent: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 11,
  },

  progressPercentLarge: {
    fontSize: 23,
    lineHeight: 30,
    marginLeft: 14,
  },


  // ========================================
  // STREAK
  // ========================================

  streakCard: {
    backgroundColor: '#FFFDF7',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F4E7C2',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  streakCardLarge: {
    paddingVertical: 19,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginBottom: 29,
  },

  streakIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: '#FFF4D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  streakIconLarge: {
    width: 59,
    height: 59,
    borderRadius: 20,
    marginRight: 14,
  },

  streakInfo: {
    flex: 1,
  },

  streakTitle: {
    fontSize: 15,
    fontWeight: '800',
  },

  streakTitleLarge: {
    fontSize: 20,
    lineHeight: 27,
  },

  streakSubtitle: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 17,
  },

  streakSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },

  streakNumberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  streakNumber: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 29,
  },

  streakNumberLarge: {
    fontSize: 34,
    lineHeight: 40,
  },

  streakDays: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },

  streakDaysLarge: {
    fontSize: 12,
    marginTop: 2,
  },


  // ========================================
  // SECTION
  // ========================================

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  sectionTitleLarge: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 16,
  },


  // ========================================
  // EXERCISE CARDS
  // ========================================

  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardLarge: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginBottom: 15,
  },

  exerciseIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  exerciseIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 15,
  },

  highContrastExerciseIcon: {
    borderWidth: 2,
    borderColor: '#111827',
  },

  cardContent: {
    flex: 1,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },

  cardTitleLarge: {
    fontSize: 20,
    lineHeight: 27,
  },

  cardSub: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },

  cardSubLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },

  targetText: {
    fontSize: 11,
    marginTop: 7,
    marginBottom: 9,
    lineHeight: 16,
  },

  targetTextLarge: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 11,
  },


  // ========================================
  // PREFERENCE STATUS
  // ========================================

  preferenceStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  preferenceStatusCardLarge: {
    paddingVertical: 18,
    paddingHorizontal: 17,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 15,
  },

  preferenceStatusIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  preferenceStatusIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    marginRight: 14,
  },

  preferenceStatusInfo: {
    flex: 1,
  },

  preferenceStatusTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },

  preferenceStatusTitleLarge: {
    fontSize: 17,
    lineHeight: 24,
  },

  preferenceStatusText: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  preferenceStatusTextLarge: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },


  // ========================================
  // INFO CARD
  // ========================================

  infoCard: {
    backgroundColor: '#F5F6FF',
    borderRadius: 17,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },

  infoCardLarge: {
    paddingVertical: 18,
    paddingHorizontal: 17,
    borderRadius: 20,
    marginTop: 10,
  },

  highContrastInfoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoIconLarge: {
    width: 39,
    height: 39,
    borderRadius: 13,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 9,
    paddingTop: 1,
  },

  infoTextLarge: {
    fontSize: 14,
    lineHeight: 21,
    marginLeft: 11,
  },

});