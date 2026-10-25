import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';


// ======================================================
// STORAGE
// ======================================================

const ACCOUNTS_KEY = 'strokebuddy_accounts';

const ACCENT = '#6366F1';

const getStorageKey = (accountId) =>
  `strokebuddy_exercise_data_${
    accountId || 'default_patient'
  }`;


// ======================================================
// LEVELS
// ======================================================

const LEVELS = {
  1: {
    name: 'Foundation',
    subtitle: 'Gentle and supported',
  },

  2: {
    name: 'Progressing',
    subtitle: 'More active movement',
  },

  3: {
    name: 'Advanced',
    subtitle: 'Greater functional challenge',
  },
};


// ======================================================
// HELPERS
// ======================================================

const getToday = () =>
  new Date().toISOString().split('T')[0];


const getDaysAgo = (days) => {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  date.setDate(
    date.getDate() - days
  );

  return date;
};


const getDefaultData = () => ({
  version: 3,

  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,

  totalCompletedSessions: 0,
  totalCompletedReps: 0,

  currentDifficultyLevel: 1,

  requestedDifficultyLevel: null,
  difficultyRequestStatus: null,
  difficultyRequestDate: null,
  difficultyRequestReviewedAt: null,
  difficultyRequestReviewer: null,

  exercises: {
    pt: {
      completedToday: false,
      sessions: [],
      todayCount: 0,
    },
  },

  sessions: [],
});


const getAccountId = (account) =>
  account?.id ||
  account?.accountId ||
  null;


const calculateExercisePercentage = (
  sessions
) => {
  if (!Array.isArray(sessions) || !sessions.length) {
    return 0;
  }

  const total =
    sessions.reduce(
      (sum, session) =>
        sum +
        Number(
          session?.completionPercentage || 0
        ),
      0
    );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        total / sessions.length
      )
    )
  );
};


const getStatusLabel = (
  session
) => {
  if (
    session?.status ===
    'completed'
  ) {
    return 'Completed';
  }

  return 'Partial';
};


const getSessionDate = (
  session
) => {
  const rawDate =
    session?.date ||
    session?.completedAt;

  if (!rawDate) {
    return null;
  }

  const date =
    new Date(rawDate);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
};


const formatSessionDate = (
  session
) => {
  const date =
    getSessionDate(session);

  if (!date) {
    return 'Unknown date';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
};


const formatRequestDate = (
  dateValue
) => {
  if (!dateValue) {
    return '';
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );
};


// ======================================================
// SCREEN
// ======================================================

export default function CaregiverPTScreen({
  route,
  navigation,
}) {
  const params =
    route?.params || {};


  // ====================================================
  // CAREGIVER ID
  // ====================================================

  const caregiverAccountId =
    params.caregiverAccountId ||
    params.caregiverId ||
    params.accountId ||
    null;


  // ====================================================
  // OPTIONAL ROUTE PATIENT ID
  // ====================================================

  const routePatientAccountId =
    params.patientAccountId ||
    params.patientId ||
    null;


  // ====================================================
  // STATE
  // ====================================================

  const [
    caregiver,
    setCaregiver,
  ] = useState(null);


  const [
    patient,
    setPatient,
  ] = useState(null);


  const [
    ptData,
    setPtData,
  ] = useState(
    getDefaultData()
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);


  // ======================================================
  // RESOLVE CONNECTED PATIENT
  // ======================================================

  const resolvePatient =
    useCallback(async () => {
      const stored =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!stored) {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }


      let accounts;

      try {
        accounts =
          JSON.parse(stored);
      } catch {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }


      if (!Array.isArray(accounts)) {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }


      // --------------------------------------------------
      // FIND THE ACTUAL CAREGIVER
      // --------------------------------------------------

      let caregiverAccount = null;


      if (caregiverAccountId) {
        caregiverAccount =
          accounts.find(
            (account) =>
              account?.role === 'caregiver' &&
              String(
                getAccountId(account)
              ) ===
                String(
                  caregiverAccountId
                )
          ) || null;
      }


      /*
       * If AppNavigator did not pass the caregiver ID,
       * find the caregiver account only if there is
       * exactly one caregiver account.
       *
       * This prevents accidentally selecting an unrelated
       * caregiver when multiple caregiver accounts exist.
       */

      if (!caregiverAccount) {
        const caregiverAccounts =
          accounts.filter(
            (account) =>
              account?.role ===
              'caregiver'
          );

        if (
          caregiverAccounts.length === 1
        ) {
          caregiverAccount =
            caregiverAccounts[0];
        }
      }


      if (!caregiverAccount) {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }


      const actualCaregiverId =
        getAccountId(
          caregiverAccount
        );


      // --------------------------------------------------
      // FIND PATIENT CONNECTED TO CAREGIVER
      // --------------------------------------------------

      let connectedPatient = null;


      /*
       * Priority 1:
       *
       * Explicit patient ID passed through navigation,
       * but ONLY if that patient is actually connected
       * to this caregiver.
       */

      if (routePatientAccountId) {
        const candidate =
          accounts.find(
            (account) =>
              account?.role === 'patient' &&
              String(
                getAccountId(account)
              ) ===
                String(
                  routePatientAccountId
                )
          ) || null;


        if (candidate) {
          const candidateCaregiverId =
            candidate?.connectedCaregiverId ||
            candidate?.caregiverId ||
            candidate?.connectedCaregiverAccountId ||
            null;


          const caregiverPointsToPatient =
            String(
              caregiverAccount?.connectedPatientId ||
                caregiverAccount?.patientId ||
                ''
            ) ===
            String(
              getAccountId(candidate) || ''
            );


          const patientPointsToCaregiver =
            String(
              candidateCaregiverId || ''
            ) ===
            String(
              actualCaregiverId || ''
            );


          if (
            caregiverPointsToPatient ||
            patientPointsToCaregiver
          ) {
            connectedPatient =
              candidate;
          }
        }
      }


      /*
       * Priority 2:
       *
       * Caregiver's connectedPatientId.
       */

      if (
        !connectedPatient &&
        (
          caregiverAccount?.connectedPatientId ||
          caregiverAccount?.patientId
        )
      ) {
        const linkedPatientId =
          caregiverAccount.connectedPatientId ||
          caregiverAccount.patientId;


        connectedPatient =
          accounts.find(
            (account) =>
              account?.role === 'patient' &&
              String(
                getAccountId(account)
              ) ===
                String(
                  linkedPatientId
                )
          ) || null;
      }


      /*
       * Priority 3:
       *
       * Patient's connectedCaregiverId.
       */

      if (
        !connectedPatient
      ) {
        connectedPatient =
          accounts.find(
            (account) => {
              if (
                account?.role !==
                'patient'
              ) {
                return false;
              }


              const linkedCaregiverId =
                account?.connectedCaregiverId ||
                account?.caregiverId ||
                account?.connectedCaregiverAccountId ||
                null;


              return (
                String(
                  linkedCaregiverId || ''
                ) ===
                String(
                  actualCaregiverId || ''
                )
              );
            }
          ) || null;
      }


      /*
       * Final safety check:
       *
       * Never allow a random patient to become connected.
       */

      if (
        connectedPatient
      ) {
        const patientId =
          getAccountId(
            connectedPatient
          );


        const caregiverLinkedPatient =
          caregiverAccount?.connectedPatientId ||
          caregiverAccount?.patientId ||
          null;


        const patientLinkedCaregiver =
          connectedPatient?.connectedCaregiverId ||
          connectedPatient?.caregiverId ||
          connectedPatient?.connectedCaregiverAccountId ||
          null;


        const validCaregiverToPatient =
          caregiverLinkedPatient &&
          String(
            caregiverLinkedPatient
          ) ===
            String(
              patientId
            );


        const validPatientToCaregiver =
          patientLinkedCaregiver &&
          String(
            patientLinkedCaregiver
          ) ===
            String(
              actualCaregiverId
            );


        if (
          !validCaregiverToPatient &&
          !validPatientToCaregiver
        ) {
          connectedPatient = null;
        }
      }


      return {
        caregiverAccount,
        patientAccount:
          connectedPatient,
      };
    }, [
      caregiverAccountId,
      routePatientAccountId,
    ]);


  // ======================================================
  // LOAD PATIENT PT DATA
  // ======================================================

  const loadPatientPTData =
    useCallback(
      async ({
        showLoading = true,
      } = {}) => {
        try {
          if (showLoading) {
            setLoading(true);
          }


          const {
            caregiverAccount,
            patientAccount,
          } =
            await resolvePatient();


          setCaregiver(
            caregiverAccount
          );


          setPatient(
            patientAccount
          );


          // ----------------------------------------------
          // NO PATIENT
          // ----------------------------------------------

          if (!patientAccount) {
            /*
             * Important:
             *
             * We reset the visible PT data when there is
             * no connected patient so old patient data
             * cannot remain on screen after a disconnect.
             */

            setPtData(
              getDefaultData()
            );

            return;
          }


          // ----------------------------------------------
          // ACTUAL PATIENT ACCOUNT ID
          // ----------------------------------------------

          const actualPatientId =
            getAccountId(
              patientAccount
            );


          if (!actualPatientId) {
            setPatient(null);
            setPtData(
              getDefaultData()
            );

            return;
          }


          // ----------------------------------------------
          // PATIENT-SPECIFIC STORAGE
          // ----------------------------------------------

          const key =
            getStorageKey(
              actualPatientId
            );


          const saved =
            await AsyncStorage.getItem(
              key
            );


          if (!saved) {
            setPtData(
              getDefaultData()
            );

            return;
          }


          let parsed;


          try {
            parsed =
              JSON.parse(saved);
          } catch {
            parsed =
              getDefaultData();
          }


          const defaults =
            getDefaultData();


          const merged = {
            ...defaults,
            ...parsed,

            exercises: {
              ...defaults.exercises,
              ...(parsed?.exercises || {}),

              pt: {
                ...defaults.exercises.pt,
                ...(parsed?.exercises?.pt ||
                  {}),
              },
            },
          };


          if (
            !Array.isArray(
              merged.sessions
            )
          ) {
            merged.sessions = [];
          }


          // ----------------------------------------------
          // NORMALIZE NUMBERS
          // ----------------------------------------------

          const level =
            Number(
              merged.currentDifficultyLevel
            );


          merged.currentDifficultyLevel =
            level >= 1 &&
            level <= 3
              ? level
              : 1;


          merged.currentStreak =
            Number(
              merged.currentStreak || 0
            );


          merged.longestStreak =
            Number(
              merged.longestStreak || 0
            );


          merged.totalCompletedSessions =
            Number(
              merged.totalCompletedSessions ||
                0
            );


          merged.totalCompletedReps =
            Number(
              merged.totalCompletedReps ||
                0
            );


          // ----------------------------------------------
          // LOAD SAME DATA USED BY PATIENT
          // ----------------------------------------------

          setPtData(
            merged
          );
        } catch (error) {
          console.log(
            'Caregiver PT load error:',
            error
          );


          Alert.alert(
            'Unable to Load PT Data',
            'Please try refreshing the page.'
          );
        } finally {
          if (showLoading) {
            setLoading(false);
          }
        }
      },
      [
        resolvePatient,
      ]
    );


  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    loadPatientPTData({
      showLoading: true,
    });
  }, [
    loadPatientPTData,
  ]);


  // ======================================================
  // REFRESH WHEN SCREEN GETS FOCUS
  // ======================================================

  useEffect(() => {
    if (
      !navigation?.addListener
    ) {
      return undefined;
    }


    const unsubscribe =
      navigation.addListener(
        'focus',
        () => {
          loadPatientPTData({
            showLoading: false,
          });
        }
      );


    return unsubscribe;
  }, [
    navigation,
    loadPatientPTData,
  ]);


  // ======================================================
  // MANUAL REFRESH
  // ======================================================

  const refreshData =
    async () => {
      setRefreshing(true);


      try {
        await loadPatientPTData({
          showLoading: false,
        });
      } finally {
        setRefreshing(false);
      }
    };


  // ======================================================
  // PATIENT DISPLAY NAME
  // ======================================================

  const displayPatientName =
    patient?.name ||
    patient?.fullName ||
    'Patient';


  const hasPatient =
    Boolean(
      patient &&
      getAccountId(patient)
    );


  // ======================================================
  // CURRENT LEVEL
  // ======================================================

  const currentLevel =
    LEVELS[
      ptData.currentDifficultyLevel
    ] ||
    LEVELS[1];


  // ======================================================
  // SESSIONS
  // ======================================================

  const sessions = useMemo(() => {
    if (!hasPatient) {
      return [];
    }


    return Array.isArray(
      ptData.sessions
    )
      ? [...ptData.sessions]
          .filter(Boolean)
          .sort(
            (a, b) => {
              const dateA =
                getSessionDate(a);

              const dateB =
                getSessionDate(b);


              const timeA =
                dateA
                  ? dateA.getTime()
                  : 0;


              const timeB =
                dateB
                  ? dateB.getTime()
                  : 0;


              return timeB - timeA;
            }
          )
      : [];
  }, [
    ptData.sessions,
    hasPatient,
  ]);


  // ======================================================
  // WEEKLY ANALYTICS
  // ======================================================

  const weeklyAnalytics =
    useMemo(() => {
      if (!hasPatient) {
        return {
          weeklySessions: [],
          completedSessions: [],
          totalReps: 0,
          targetReps: 0,
          percentage: 0,
          activeDays: 0,
        };
      }


      const cutoff =
        getDaysAgo(6);


      const weeklySessions =
        sessions.filter(
          (session) => {
            const date =
              getSessionDate(
                session
              );


            return (
              date &&
              date >= cutoff
            );
          }
        );


      const completedSessions =
        weeklySessions.filter(
          (session) =>
            session?.status ===
            'completed'
        );


      const totalReps =
        weeklySessions.reduce(
          (sum, session) =>
            sum +
            Number(
              session?.reps || 0
            ),
          0
        );


      const targetReps =
        weeklySessions.reduce(
          (sum, session) =>
            sum +
            Number(
              session?.targetReps ||
                10
            ),
          0
        );


      const percentage =
        targetReps > 0
          ? Math.min(
              100,
              Math.round(
                (
                  totalReps /
                  targetReps
                ) *
                  100
              )
            )
          : 0;


      const activeDates =
        new Set(
          weeklySessions
            .map(
              (session) => {
                if (
                  session?.date
                ) {
                  return session.date;
                }


                const date =
                  getSessionDate(
                    session
                  );


                return date
                  ? date
                      .toISOString()
                      .split('T')[0]
                  : null;
              }
            )
            .filter(Boolean)
        );


      return {
        weeklySessions,
        completedSessions,
        totalReps,
        targetReps,
        percentage,
        activeDays:
          activeDates.size,
      };
    }, [
      sessions,
      hasPatient,
    ]);


  // ======================================================
  // EXERCISE ANALYTICS
  // ======================================================

  const exerciseAnalytics =
    useMemo(() => {
      if (!hasPatient) {
        return [];
      }


      const grouped = {};


      weeklyAnalytics
        .weeklySessions
        .forEach(
          (session) => {
            const id =
              session?.exerciseId ||
              session?.exerciseName ||
              'unknown';


            if (!grouped[id]) {
              grouped[id] = {
                id,

                name:
                  session?.exerciseName ||
                  'PT Exercise',

                category:
                  session?.category ||
                  'Physical Therapy',

                sessions: [],

                totalReps: 0,

                completedCount: 0,
              };
            }


            grouped[
              id
            ].sessions.push(
              session
            );


            grouped[
              id
            ].totalReps +=
              Number(
                session?.reps ||
                  0
              );


            if (
              session?.status ===
              'completed'
            ) {
              grouped[
                id
              ].completedCount +=
                1;
            }
          }
        );


      return Object.values(
        grouped
      )
        .map(
          (exercise) => ({
            ...exercise,

            percentage:
              calculateExercisePercentage(
                exercise.sessions
              ),

            sessionCount:
              exercise
                .sessions
                .length,
          })
        )
        .sort(
          (a, b) =>
            b.percentage -
            a.percentage
        );
    }, [
      weeklyAnalytics,
      hasPatient,
    ]);


  // ======================================================
  // OVERALL INSIGHT
  // ======================================================

  const recoveryInsight =
    useMemo(() => {
      if (!hasPatient) {
        return {
          title:
            'Recovery Insight',

          text:
            'Connect a patient to view their PT recovery activity and personalized session insights.',
        };
      }


      if (
        weeklyAnalytics
          .weeklySessions
          .length === 0
      ) {
        return {
          title:
            'Recovery Insight',

          text:
            'No PT sessions have been recorded during the current seven-day period yet. Progress information will appear here as sessions are completed.',
        };
      }


      if (
        weeklyAnalytics.percentage >=
        80
      ) {
        return {
          title:
            'Strong Weekly Activity',

          text:
            `The recorded sessions reached ${weeklyAnalytics.percentage}% of their combined repetition targets during the current seven-day period.`,
        };
      }


      if (
        weeklyAnalytics.percentage >=
        50
      ) {
        return {
          title:
            'Progress Building',

          text:
            `The recorded sessions reached ${weeklyAnalytics.percentage}% of their combined repetition targets during the current seven-day period.`,
        };
      }


      return {
        title:
          'Activity Overview',

        text:
          `The recorded sessions reached ${weeklyAnalytics.percentage}% of their combined repetition targets during the current seven-day period. Review the session history and rehabilitation plan when considering next steps.`,
      };
    }, [
      weeklyAnalytics,
      hasPatient,
    ]);


  // ======================================================
  // APPROVE DIFFICULTY
  // ======================================================

  const approveDifficulty =
    async () => {
      if (!hasPatient) {
        Alert.alert(
          'No Patient Connected',
          'Connect a patient before managing PT difficulty requests.'
        );

        return;
      }


      const requestedLevel =
        Number(
          ptData.requestedDifficultyLevel
        );


      if (
        requestedLevel < 1 ||
        requestedLevel > 3
      ) {
        Alert.alert(
          'Invalid Request',
          'The requested PT difficulty level is not valid.'
        );

        return;
      }


      Alert.alert(
        'Approve Difficulty Change?',
        `Change ${displayPatientName}'s PT level to Level ${requestedLevel} · ${LEVELS[requestedLevel].name}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Approve',

            onPress:
              async () => {
                try {
                  setActionLoading(
                    true
                  );


                  const actualPatientId =
                    getAccountId(
                      patient
                    );


                  const actualCaregiverId =
                    getAccountId(
                      caregiver
                    );


                  if (
                    !actualPatientId
                  ) {
                    throw new Error(
                      'Patient account not found.'
                    );
                  }


                  const key =
                    getStorageKey(
                      actualPatientId
                    );


                  const saved =
                    await AsyncStorage.getItem(
                      key
                    );


                  let data =
                    getDefaultData();


                  if (saved) {
                    try {
                      const parsed =
                        JSON.parse(
                          saved
                        );


                      data = {
                        ...getDefaultData(),
                        ...parsed,

                        exercises: {
                          ...getDefaultData()
                            .exercises,
                          ...(parsed?.exercises ||
                            {}),
                        },
                      };


                      if (
                        !Array.isArray(
                          data.sessions
                        )
                      ) {
                        data.sessions = [];
                      }
                    } catch {
                      data =
                        getDefaultData();
                    }
                  }


                  data.currentDifficultyLevel =
                    requestedLevel;


                  data.requestedDifficultyLevel =
                    null;


                  data.difficultyRequestStatus =
                    'approved';


                  data.difficultyRequestReviewedAt =
                    new Date().toISOString();


                  data.difficultyRequestReviewer =
                    actualCaregiverId ||
                    'caregiver';


                  await AsyncStorage.setItem(
                    key,
                    JSON.stringify(
                      data
                    )
                  );


                  /*
                   * Update the caregiver view
                   * immediately without waiting for
                   * another navigation event.
                   */

                  setPtData(
                    data
                  );


                  Alert.alert(
                    'Request Approved',
                    `${displayPatientName}'s PT level is now Level ${requestedLevel} · ${LEVELS[requestedLevel].name}.`
                  );
                } catch (error) {
                  console.log(
                    'Difficulty approval error:',
                    error
                  );


                  Alert.alert(
                    'Unable to Approve',
                    'The difficulty change could not be saved. Please try again.'
                  );
                } finally {
                  setActionLoading(
                    false
                  );
                }
              },
          },
        ]
      );
    };


  // ======================================================
  // DENY DIFFICULTY
  // ======================================================

  const denyDifficulty =
    async () => {
      if (!hasPatient) {
        Alert.alert(
          'No Patient Connected',
          'Connect a patient before managing PT difficulty requests.'
        );

        return;
      }


      Alert.alert(
        'Decline Request?',
        `Keep ${displayPatientName} at their current PT level?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Decline',
            style: 'destructive',

            onPress:
              async () => {
                try {
                  setActionLoading(
                    true
                  );


                  const actualPatientId =
                    getAccountId(
                      patient
                    );


                  const actualCaregiverId =
                    getAccountId(
                      caregiver
                    );


                  if (
                    !actualPatientId
                  ) {
                    throw new Error(
                      'Patient account not found.'
                    );
                  }


                  const key =
                    getStorageKey(
                      actualPatientId
                    );


                  const saved =
                    await AsyncStorage.getItem(
                      key
                    );


                  let data =
                    getDefaultData();


                  if (saved) {
                    try {
                      const parsed =
                        JSON.parse(
                          saved
                        );


                      data = {
                        ...getDefaultData(),
                        ...parsed,
                      };


                      if (
                        !Array.isArray(
                          data.sessions
                        )
                      ) {
                        data.sessions = [];
                      }
                    } catch {
                      data =
                        getDefaultData();
                    }
                  }


                  data.requestedDifficultyLevel =
                    null;


                  data.difficultyRequestStatus =
                    'denied';


                  data.difficultyRequestReviewedAt =
                    new Date().toISOString();


                  data.difficultyRequestReviewer =
                    actualCaregiverId ||
                    'caregiver';


                  await AsyncStorage.setItem(
                    key,
                    JSON.stringify(
                      data
                    )
                  );


                  setPtData(
                    data
                  );


                  Alert.alert(
                    'Request Declined',
                    `${displayPatientName} will remain at the current PT difficulty level.`
                  );
                } catch (error) {
                  console.log(
                    'Difficulty denial error:',
                    error
                  );


                  Alert.alert(
                    'Unable to Decline',
                    'The request could not be updated. Please try again.'
                  );
                } finally {
                  setActionLoading(
                    false
                  );
                }
              },
          },
        ]
      );
    };


  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color={ACCENT}
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading PT progress...
        </Text>
      </View>
    );
  }


  // ======================================================
  // MAIN SCREEN
  // ======================================================

  return (
    <ScrollView
      style={
        styles.container
      }
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={
            refreshData
          }
        />
      }
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <View
        style={
          styles.headerRow
        }
      >
        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            PT Analytics
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            {hasPatient
              ? `Track ${displayPatientName}'s physical therapy progress.`
              : 'Connect a patient to view their physical therapy progress.'}
          </Text>
        </View>


        <TouchableOpacity
          style={
            styles.headerIcon
          }
          onPress={
            refreshData
          }
          disabled={
            refreshing
          }
          activeOpacity={0.8}
        >
          {refreshing ? (
            <ActivityIndicator
              size="small"
              color={ACCENT}
            />
          ) : (
            <Ionicons
              name="fitness-outline"
              size={25}
              color={ACCENT}
            />
          )}
        </TouchableOpacity>
      </View>


      {/* ==================================================
          CONNECTION STATUS
      ================================================== */}

      <View
        style={[
          styles.connectionCard,
          hasPatient
            ? styles.connectionCardConnected
            : styles.connectionCardDisconnected,
        ]}
      >
        <View
          style={[
            styles.connectionIcon,
            hasPatient
              ? styles.connectionIconConnected
              : styles.connectionIconDisconnected,
          ]}
        >
          <Ionicons
            name={
              hasPatient
                ? 'checkmark-circle-outline'
                : 'person-outline'
            }
            size={22}
            color={
              hasPatient
                ? '#059669'
                : ACCENT
            }
          />
        </View>


        <View
          style={
            styles.connectionInfo
          }
        >
          <Text
            style={
              styles.connectionLabel
            }
          >
            Patient Connection
          </Text>

          <Text
            style={
              styles.connectionName
            }
          >
            {hasPatient
              ? displayPatientName
              : 'No Patient Connected'}
          </Text>

          <Text
            style={
              styles.connectionStatus
            }
          >
            {hasPatient
              ? 'PT data is synced to this patient account.'
              : 'Patient-specific PT data is unavailable until a patient is connected.'}
          </Text>
        </View>


        {!hasPatient && (
          <TouchableOpacity
            style={
              styles.connectionButton
            }
            onPress={() =>
              navigation?.navigate(
                'Settings'
              )
            }
            activeOpacity={0.8}
          >
            <Ionicons
              name="link-outline"
              size={17}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.connectionButtonText
              }
            >
              Connect
            </Text>
          </TouchableOpacity>
        )}
      </View>


      {/* ==================================================
          PATIENT SUMMARY
      ================================================== */}

      <View
        style={
          styles.patientCard
        }
      >
        <View
          style={
            styles.patientIcon
          }
        >
          <Ionicons
            name="person-outline"
            size={22}
            color={
              hasPatient
                ? ACCENT
                : '#A1A1AA'
            }
          />
        </View>


        <View
          style={
            styles.patientInfo
          }
        >
          <Text
            style={
              styles.patientLabel
            }
          >
            Patient
          </Text>


          <Text
            style={[
              styles.patientName,
              !hasPatient &&
                styles.disabledValue,
            ]}
          >
            {hasPatient
              ? displayPatientName
              : 'Not connected'}
          </Text>


          <Text
            style={
              styles.patientLevel
            }
          >
            {hasPatient
              ? `Level ${ptData.currentDifficultyLevel} · ${currentLevel.name} · ${currentLevel.subtitle}`
              : 'PT level unavailable'}
          </Text>
        </View>
      </View>


      {/* ==================================================
          WEEKLY PROGRESS
      ================================================== */}

      <View
        style={
          styles.progressCard
        }
      >
        <View
          style={
            styles.progressTopRow
          }
        >
          <View>
            <Text
              style={
                styles.progressLabel
              }
            >
              Current 7-Day Activity
            </Text>


            <Text
              style={[
                styles.progressPercent,
                !hasPatient &&
                  styles.disabledValue,
              ]}
            >
              {hasPatient
                ? `${weeklyAnalytics.percentage}% Complete`
                : 'Unavailable'}
            </Text>
          </View>


          <View
            style={
              styles.progressIcon
            }
          >
            <Ionicons
              name="trending-up"
              size={21}
              color={
                hasPatient
                  ? ACCENT
                  : '#A1A1AA'
              }
            />
          </View>
        </View>


        <View
          style={
            styles.progressTrack
          }
        >
          <View
            style={[
              styles.progressFill,
              {
                width: hasPatient
                  ? `${weeklyAnalytics.percentage}%`
                  : '0%',
              },
              !hasPatient &&
                styles.disabledProgressFill,
            ]}
          />
        </View>


        <Text
          style={
            styles.progressSubtitle
          }
        >
          {hasPatient
            ? `${weeklyAnalytics.activeDays} active days · ${weeklyAnalytics.completedSessions.length} completed sessions · ${weeklyAnalytics.totalReps} reps`
            : 'Connect a patient to calculate weekly activity.'}
        </Text>
      </View>


      {/* ==================================================
          KEY METRICS
      ================================================== */}

      <View
        style={
          styles.metricsCard
        }
      >

        <View
          style={
            styles.metricItem
          }
        >
          <Text
            style={[
              styles.metricNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? weeklyAnalytics.activeDays
              : '—'}
          </Text>

          <Text
            style={
              styles.metricLabel
            }
          >
            Active Days
          </Text>
        </View>


        <View
          style={
            styles.metricDivider
          }
        />


        <View
          style={
            styles.metricItem
          }
        >
          <Text
            style={[
              styles.metricNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? weeklyAnalytics
                  .weeklySessions
                  .length
              : '—'}
          </Text>

          <Text
            style={
              styles.metricLabel
            }
          >
            Sessions
          </Text>
        </View>


        <View
          style={
            styles.metricDivider
          }
        />


        <View
          style={
            styles.metricItem
          }
        >
          <Text
            style={[
              styles.metricNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? weeklyAnalytics.totalReps
              : '—'}
          </Text>

          <Text
            style={
              styles.metricLabel
            }
          >
            Reps
          </Text>
        </View>


        <View
          style={
            styles.metricDivider
          }
        />


        <View
          style={
            styles.metricItem
          }
        >
          <Text
            style={[
              styles.metricNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? ptData.currentStreak || 0
              : '—'}
          </Text>

          <Text
            style={
              styles.metricLabel
            }
          >
            Streak
          </Text>
        </View>
      </View>


      {/* ==================================================
          EXERCISE PERFORMANCE
      ================================================== */}

      <Text
        style={
          styles.sectionTitle
        }
      >
        Exercise Performance
      </Text>


      {!hasPatient ? (
        <View
          style={
            styles.lockedCard
          }
        >
          <View
            style={
              styles.lockedIcon
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={25}
              color="#A1A1AA"
            />
          </View>


          <Text
            style={
              styles.lockedTitle
            }
          >
            Patient Data Unavailable
          </Text>


          <Text
            style={
              styles.lockedText
            }
          >
            Exercise performance will appear here after a patient is connected.
          </Text>
        </View>
      ) : exerciseAnalytics.length ===
        0 ? (
        <View
          style={
            styles.emptyCard
          }
        >
          <Ionicons
            name="fitness-outline"
            size={30}
            color="#B8B8C2"
          />


          <Text
            style={
              styles.emptyTitle
            }
          >
            No exercise data yet
          </Text>


          <Text
            style={
              styles.emptyText
            }
          >
            Exercise performance will appear here after the patient completes PT sessions.
          </Text>
        </View>
      ) : (
        exerciseAnalytics.map(
          (exercise) => (
            <View
              key={
                exercise.id
              }
              style={
                styles.exerciseCard
              }
            >
              <View
                style={
                  styles.exerciseTopRow
                }
              >
                <View
                  style={
                    styles.exerciseIcon
                  }
                >
                  <Ionicons
                    name="fitness-outline"
                    size={21}
                    color={ACCENT}
                  />
                </View>


                <View
                  style={
                    styles.exerciseInfo
                  }
                >
                  <Text
                    style={
                      styles.exerciseTitle
                    }
                  >
                    {
                      exercise.name
                    }
                  </Text>


                  <Text
                    style={
                      styles.exerciseSubtitle
                    }
                  >
                    {
                      exercise.category
                    }
                    {' · '}
                    {
                      exercise.sessionCount
                    }{' '}
                    session
                    {exercise.sessionCount ===
                    1
                      ? ''
                      : 's'}
                  </Text>
                </View>


                <Text
                  style={
                    styles.exercisePercent
                  }
                >
                  {
                    exercise.percentage
                  }%
                </Text>
              </View>


              <View
                style={
                  styles.exerciseTrack
                }
              >
                <View
                  style={[
                    styles.exerciseFill,
                    {
                      width: `${exercise.percentage}%`,
                    },
                  ]}
                />
              </View>


              <Text
                style={
                  styles.exerciseFooter
                }
              >
                {
                  exercise.totalReps
                }{' '}
                repetitions recorded this week
              </Text>
            </View>
          )
        )
      )}


      {/* ==================================================
          DIFFICULTY REQUEST
      ================================================== */}

      {hasPatient &&
        ptData.difficultyRequestStatus ===
          'pending' && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Difficulty Request
            </Text>


            <View
              style={
                styles.requestCard
              }
            >
              <View
                style={
                  styles.requestIcon
                }
              >
                <Ionicons
                  name="trending-up-outline"
                  size={22}
                  color={ACCENT}
                />
              </View>


              <View
                style={
                  styles.requestInfo
                }
              >
                <Text
                  style={
                    styles.requestTitle
                  }
                >
                  Level{' '}
                  {
                    ptData.requestedDifficultyLevel
                  }{' '}
                  requested
                </Text>


                <Text
                  style={
                    styles.requestSubtitle
                  }
                >
                  {
                    LEVELS[
                      ptData.requestedDifficultyLevel
                    ]?.name ||
                    'Higher difficulty'
                  }
                  {' · '}
                  {
                    LEVELS[
                      ptData.requestedDifficultyLevel
                    ]?.subtitle ||
                    ''
                  }
                </Text>


                {ptData.difficultyRequestDate && (
                  <Text
                    style={
                      styles.requestDate
                    }
                  >
                    Requested{' '}
                    {formatRequestDate(
                      ptData.difficultyRequestDate
                    )}
                  </Text>
                )}
              </View>


              <View
                style={
                  styles.requestActions
                }
              >
                <TouchableOpacity
                  style={
                    styles.approveButton
                  }
                  onPress={
                    approveDifficulty
                  }
                  disabled={
                    actionLoading
                  }
                  activeOpacity={0.8}
                >
                  {actionLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>


                <TouchableOpacity
                  style={
                    styles.denyButton
                  }
                  onPress={
                    denyDifficulty
                  }
                  disabled={
                    actionLoading
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color="#B42318"
                  />
                </TouchableOpacity>
              </View>
            </View>


            <Text
              style={
                styles.requestNote
              }
            >
              Approving changes the patient's active PT difficulty level. Progression should be consistent with the patient's rehabilitation plan and appropriate professional guidance.
            </Text>
          </>
        )}


      {/* ==================================================
          NO PATIENT REQUEST PLACEHOLDER
      ================================================== */}

      {!hasPatient && (
        <>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Difficulty Request
          </Text>


          <View
            style={
              styles.lockedRequestCard
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={21}
              color="#A1A1AA"
            />


            <View
              style={
                styles.lockedRequestInfo
              }
            >
              <Text
                style={
                  styles.lockedRequestTitle
                }
              >
                Patient request unavailable
              </Text>


              <Text
                style={
                  styles.lockedRequestText
                }
              >
                Connect a patient to view and manage PT difficulty requests.
              </Text>
            </View>
          </View>
        </>
      )}


      {/* ==================================================
          RECENT REQUEST RESULT
      ================================================== */}

      {hasPatient &&
        ptData.difficultyRequestStatus ===
          'approved' &&
        ptData.difficultyRequestReviewedAt && (
          <View
            style={
              styles.reviewedCard
            }
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#059669"
            />


            <View
              style={
                styles.reviewedInfo
              }
            >
              <Text
                style={
                  styles.reviewedTitle
                }
              >
                Difficulty request approved
              </Text>


              <Text
                style={
                  styles.reviewedText
                }
              >
                Current level: Level{' '}
                {
                  ptData.currentDifficultyLevel
                }{' '}
                ·{' '}
                {
                  currentLevel.name
                }
              </Text>
            </View>
          </View>
        )}


      {hasPatient &&
        ptData.difficultyRequestStatus ===
          'denied' &&
        ptData.difficultyRequestReviewedAt && (
          <View
            style={
              styles.deniedCard
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#B45309"
            />


            <View
              style={
                styles.reviewedInfo
              }
            >
              <Text
                style={
                  styles.deniedTitle
                }
              >
                Difficulty request declined
              </Text>


              <Text
                style={
                  styles.deniedText
                }
              >
                The patient remains at Level{' '}
                {
                  ptData.currentDifficultyLevel
                }{' '}
                ·{' '}
                {
                  currentLevel.name
                }.
              </Text>
            </View>
          </View>
        )}


      {/* ==================================================
          RECOVERY INSIGHT
      ================================================== */}

      <View
        style={
          styles.insightCard
        }
      >
        <View
          style={
            styles.insightIcon
          }
        >
          <Ionicons
            name="sparkles-outline"
            size={22}
            color="#059669"
          />
        </View>


        <View
          style={
            styles.insightInfo
          }
        >
          <Text
            style={
              styles.insightTitle
            }
          >
            {
              recoveryInsight.title
            }
          </Text>


          <Text
            style={
              styles.insightText
            }
          >
            {
              recoveryInsight.text
            }
          </Text>
        </View>
      </View>


      {/* ==================================================
          STREAK
      ================================================== */}

      <Text
        style={
          styles.sectionTitle
        }
      >
        Recovery Streak
      </Text>


      <View
        style={
          styles.streakCard
        }
      >
        <View
          style={
            styles.streakItem
          }
        >
          <View
            style={
              styles.streakIcon
            }
          >
            <Ionicons
              name="flame-outline"
              size={23}
              color={
                hasPatient
                  ? ACCENT
                  : '#A1A1AA'
              }
            />
          </View>


          <Text
            style={[
              styles.streakNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? ptData.currentStreak ||
                0
              : '—'}
          </Text>


          <Text
            style={
              styles.streakLabel
            }
          >
            Current Streak
          </Text>
        </View>


        <View
          style={
            styles.streakDivider
          }
        />


        <View
          style={
            styles.streakItem
          }
        >
          <View
            style={
              styles.streakIcon
            }
          >
            <Ionicons
              name="trophy-outline"
              size={23}
              color={
                hasPatient
                  ? ACCENT
                  : '#A1A1AA'
              }
            />
          </View>


          <Text
            style={[
              styles.streakNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? ptData.longestStreak ||
                0
              : '—'}
          </Text>


          <Text
            style={
              styles.streakLabel
            }
          >
            Longest Streak
          </Text>
        </View>
      </View>


      {/* ==================================================
          WEEKLY SUMMARY
      ================================================== */}

      <Text
        style={
          styles.sectionTitle
        }
      >
        Weekly Summary
      </Text>


      <View
        style={
          styles.summaryCard
        }
      >
        <View
          style={
            styles.summaryItem
          }
        >
          <Text
            style={[
              styles.summaryNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? weeklyAnalytics.activeDays
              : '—'}
          </Text>


          <Text
            style={
              styles.summaryLabel
            }
          >
            Exercise Days
          </Text>
        </View>


        <View
          style={
            styles.summaryDivider
          }
        />


        <View
          style={
            styles.summaryItem
          }
        >
          <Text
            style={[
              styles.summaryNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? weeklyAnalytics
                  .weeklySessions
                  .length
              : '—'}
          </Text>


          <Text
            style={
              styles.summaryLabel
            }
          >
            Sessions
          </Text>
        </View>


        <View
          style={
            styles.summaryDivider
          }
        />


        <View
          style={
            styles.summaryItem
          }
        >
          <Text
            style={[
              styles.summaryNumber,
              !hasPatient &&
                styles.disabledMetric,
            ]}
          >
            {hasPatient
              ? `${weeklyAnalytics.percentage}%`
              : '—'}
          </Text>


          <Text
            style={
              styles.summaryLabel
            }
          >
            Goal
          </Text>
        </View>
      </View>


      {/* ==================================================
          RECENT SESSIONS
      ================================================== */}

      <Text
        style={
          styles.sectionTitle
        }
      >
        Recent Sessions
      </Text>


      {!hasPatient ? (
        <View
          style={
            styles.lockedCard
          }
        >
          <View
            style={
              styles.lockedIcon
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={25}
              color="#A1A1AA"
            />
          </View>


          <Text
            style={
              styles.lockedTitle
            }
          >
            Session History Unavailable
          </Text>


          <Text
            style={
              styles.lockedText
            }
          >
            Connect a patient to view their recent PT sessions.
          </Text>
        </View>
      ) : (
        <View
          style={
            styles.recentCard
          }
        >
          {sessions.length ===
          0 ? (
            <View
              style={
                styles.emptyRecent
              }
            >
              <Ionicons
                name="time-outline"
                size={27}
                color="#B8B8C2"
              />


              <Text
                style={
                  styles.emptyText
                }
              >
                No PT sessions have been recorded yet.
              </Text>
            </View>
          ) : (
            sessions
              .slice(0, 8)
              .map(
                (
                  session,
                  index
                ) => (
                  <View
                    key={
                      session?.id ||
                      `${session?.exerciseName || 'session'}_${index}`
                    }
                    style={
                      styles.sessionRow
                    }
                  >
                    <View
                      style={
                        styles.sessionIcon
                      }
                    >
                      <Ionicons
                        name={
                          session?.status ===
                          'completed'
                            ? 'checkmark'
                            : 'time-outline'
                        }
                        size={17}
                        color={ACCENT}
                      />
                    </View>


                    <View
                      style={
                        styles.sessionInfo
                      }
                    >
                      <Text
                        style={
                          styles.sessionExercise
                        }
                      >
                        {
                          session?.exerciseName ||
                          'PT Exercise'
                        }
                      </Text>


                      <Text
                        style={
                          styles.sessionDetails
                        }
                      >
                        {
                          formatSessionDate(
                            session
                          )
                        }
                        {' · '}
                        {
                          session?.reps ||
                          0
                        }
                        /
                        {
                          session?.targetReps ||
                          10
                        }{' '}
                        reps
                      </Text>
                    </View>


                    <View
                      style={
                        styles.sessionResult
                      }
                    >
                      <Text
                        style={
                          styles.sessionPercent
                        }
                      >
                        {
                          session?.completionPercentage ||
                          0
                        }%
                      </Text>


                      <Text
                        style={
                          styles.sessionStatus
                        }
                      >
                        {
                          getStatusLabel(
                            session
                          )
                        }
                      </Text>
                    </View>
                  </View>
                )
              )
          )}
        </View>
      )}


      {/* ==================================================
          DATA STATUS
      ================================================== */}

      <View
        style={
          styles.dataStatus
        }
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={18}
          color="#6B7280"
        />


        <Text
          style={
            styles.dataStatusText
          }
        >
          {hasPatient
            ? 'PT analytics are calculated directly from the connected patient account’s recorded StrokeBuddy exercise sessions. Changes made to PT difficulty requests are saved to that same patient account.'
            : 'No patient-specific PT information is displayed because no patient is currently connected. Connect a patient to activate this screen.'}
        </Text>
      </View>


      {/* ==================================================
          BOTTOM CONNECT CTA
      ================================================== */}

      {!hasPatient && (
        <TouchableOpacity
          style={
            styles.bottomConnectButton
          }
          onPress={() =>
            navigation?.navigate(
              'Settings'
            )
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name="link-outline"
            size={20}
            color="#FFFFFF"
          />

          <Text
            style={
              styles.bottomConnectButtonText
            }
          >
            Connect Patient in Settings
          </Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },

  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: 50,
  },

  // ====================================================
  // LOADING
  // ====================================================

  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 12,
    color: '#777',
    marginTop: 10,
  },

  // ====================================================
  // HEADER
  // ====================================================

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#000000',
  },

  headerSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: '#777777',
    marginTop: 2,
    maxWidth: 390,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  // ====================================================
  // CONNECTION
  // ====================================================

  connectionCard: {
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
  },

  connectionCardConnected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },

  connectionCardDisconnected: {
    backgroundColor: '#F5F3FF',
    borderColor: '#E5E7EB',
  },

  connectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  connectionIconConnected: {
    backgroundColor: '#FFFFFF',
  },

  connectionIconDisconnected: {
    backgroundColor: '#FFFFFF',
  },

  connectionInfo: {
    flex: 1,
  },

  connectionLabel: {
    fontSize: 10,
    color: '#777',
    marginBottom: 2,
  },

  connectionName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#333',
  },

  connectionStatus: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 15,
    marginTop: 3,
  },

  connectionButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },

  connectionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },

  // ====================================================
  // PATIENT
  // ====================================================

  patientCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  patientIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  patientInfo: {
    flex: 1,
  },

  patientLabel: {
    fontSize: 10,
    color: '#777',
  },

  patientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
    marginTop: 2,
  },

  patientLevel: {
    fontSize: 11,
    color: '#666',
    marginTop: 3,
  },

  disabledValue: {
    color: '#9CA3AF',
  },

  // ====================================================
  // PROGRESS
  // ====================================================

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },

  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 3,
  },

  progressPercent: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },

  progressIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  progressTrack: {
    height: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 4,
  },

  disabledProgressFill: {
    backgroundColor: '#D1D5DB',
  },

  progressSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 8,
  },

  // ====================================================
  // METRICS
  // ====================================================

  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 25,
  },

  metricItem: {
    flex: 1,
    alignItems: 'center',
  },

  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: ACCENT,
  },

  disabledMetric: {
    color: '#A1A1AA',
  },

  metricLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 3,
    textAlign: 'center',
  },

  metricDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },

  // ====================================================
  // SECTIONS
  // ====================================================

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },

  // ====================================================
  // EXERCISES
  // ====================================================

  exerciseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 11,
  },

  exerciseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  exerciseIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  exerciseInfo: {
    flex: 1,
  },

  exerciseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 3,
  },

  exerciseSubtitle: {
    fontSize: 10,
    color: '#777',
  },

  exercisePercent: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    marginLeft: 7,
  },

  exerciseTrack: {
    height: 7,
    backgroundColor: '#F1F3FF',
    borderRadius: 4,
    marginTop: 13,
    overflow: 'hidden',
  },

  exerciseFill: {
    height: '100%',
    backgroundColor: '#818CF8',
    borderRadius: 4,
  },

  exerciseFooter: {
    fontSize: 9,
    color: '#999',
    marginTop: 7,
  },

  // ====================================================
  // EMPTY / LOCKED
  // ====================================================

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 25,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
    marginTop: 8,
  },

  emptyText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },

  lockedCard: {
    backgroundColor: '#F8F8FA',
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 25,
  },

  lockedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  lockedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
    marginTop: 2,
  },

  lockedText: {
    fontSize: 11,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 310,
  },

  // ====================================================
  // REQUEST
  // ====================================================

  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  requestIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  requestInfo: {
    flex: 1,
  },

  requestTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
  },

  requestSubtitle: {
    fontSize: 10,
    color: '#777',
    marginTop: 3,
  },

  requestDate: {
    fontSize: 9,
    color: '#999',
    marginTop: 5,
  },

  requestActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },

  approveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#74B58A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
  },

  denyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF1F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  requestNote: {
    fontSize: 10,
    color: '#888',
    lineHeight: 15,
    marginBottom: 20,
  },

  lockedRequestCard: {
    backgroundColor: '#F8F8FA',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  lockedRequestInfo: {
    flex: 1,
    marginLeft: 10,
  },

  lockedRequestTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717A',
  },

  lockedRequestText: {
    fontSize: 10,
    color: '#A1A1AA',
    lineHeight: 15,
    marginTop: 3,
  },

  // ====================================================
  // REVIEWED
  // ====================================================

  reviewedCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  reviewedInfo: {
    flex: 1,
    marginLeft: 8,
  },

  reviewedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },

  reviewedText: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 3,
  },

  deniedCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  deniedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },

  deniedText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 3,
  },

  // ====================================================
  // INSIGHT
  // ====================================================

  insightCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 25,
  },

  insightIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  insightInfo: {
    flex: 1,
  },

  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 4,
  },

  insightText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },

  // ====================================================
  // STREAK
  // ====================================================

  streakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 25,
  },

  streakItem: {
    flex: 1,
    alignItems: 'center',
  },

  streakIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  streakNumber: {
    fontSize: 21,
    fontWeight: '800',
    color: ACCENT,
    marginTop: 5,
  },

  streakLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
  },

  streakDivider: {
    width: 1,
    height: 45,
    backgroundColor: '#E5E7EB',
  },

  // ====================================================
  // SUMMARY
  // ====================================================

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 25,
  },

  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },

  summaryNumber: {
    fontSize: 19,
    fontWeight: '700',
    color: ACCENT,
  },

  summaryLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
    textAlign: 'center',
  },

  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },

  // ====================================================
  // RECENT SESSIONS
  // ====================================================

  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  sessionIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  sessionInfo: {
    flex: 1,
  },

  sessionExercise: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },

  sessionDetails: {
    fontSize: 9,
    color: '#888',
    marginTop: 3,
  },

  sessionResult: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  sessionPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: ACCENT,
  },

  sessionStatus: {
    fontSize: 8,
    color: '#999',
    marginTop: 2,
  },

  emptyRecent: {
    paddingVertical: 25,
    alignItems: 'center',
  },

  // ====================================================
  // DATA STATUS
  // ====================================================

  dataStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 5,
    marginTop: 3,
  },

  dataStatusText: {
    flex: 1,
    color: '#777',
    fontSize: 10,
    lineHeight: 16,
    marginLeft: 7,
  },

  // ====================================================
  // BOTTOM CONNECT
  // ====================================================

  bottomConnectButton: {
    backgroundColor: ACCENT,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  bottomConnectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 8,
  },
});