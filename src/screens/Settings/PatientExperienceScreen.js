import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
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
} from '../../context/AccessibilityContext';


export default function PatientExperienceScreen({
  navigation,
  route,
}) {
  const accountId =
    route?.params?.accountId ||
    null;

  const {
    largeText,
    highContrast,
  } = useAccessibility();


  const font = (
    normal,
    large
  ) =>
    largeText
      ? large
      : normal;


  // -------------------------------------------------------
  // Storage
  // -------------------------------------------------------

  const storageKey =
    `strokebuddy_patient_experience_${
      accountId || 'default_patient'
    }`;


  const defaultSettings = {
    recoveryTips: true,
    dailyMotivation: true,
    exerciseConfirmation: true,
    streakCelebrations: true,
    progressUpdates: true,
    caregiverSharingReminder: true,
  };


  // -------------------------------------------------------
  // Settings
  // -------------------------------------------------------

  const [
    recoveryTips,
    setRecoveryTips,
  ] = useState(
    defaultSettings.recoveryTips
  );

  const [
    dailyMotivation,
    setDailyMotivation,
  ] = useState(
    defaultSettings.dailyMotivation
  );

  const [
    exerciseConfirmation,
    setExerciseConfirmation,
  ] = useState(
    defaultSettings.exerciseConfirmation
  );

  const [
    streakCelebrations,
    setStreakCelebrations,
  ] = useState(
    defaultSettings.streakCelebrations
  );

  const [
    progressUpdates,
    setProgressUpdates,
  ] = useState(
    defaultSettings.progressUpdates
  );

  const [
    caregiverSharingReminder,
    setCaregiverSharingReminder,
  ] = useState(
    defaultSettings.caregiverSharingReminder
  );


  // -------------------------------------------------------
  // Load Settings
  // -------------------------------------------------------

  const loadSettings =
    useCallback(
      async () => {
        try {
          const saved =
            await AsyncStorage.getItem(
              storageKey
            );

          if (!saved) {
            setRecoveryTips(
              defaultSettings.recoveryTips
            );

            setDailyMotivation(
              defaultSettings.dailyMotivation
            );

            setExerciseConfirmation(
              defaultSettings.exerciseConfirmation
            );

            setStreakCelebrations(
              defaultSettings.streakCelebrations
            );

            setProgressUpdates(
              defaultSettings.progressUpdates
            );

            setCaregiverSharingReminder(
              defaultSettings.caregiverSharingReminder
            );

            return;
          }

          const settings =
            JSON.parse(saved);

          setRecoveryTips(
            typeof settings.recoveryTips === 'boolean'
              ? settings.recoveryTips
              : defaultSettings.recoveryTips
          );

          setDailyMotivation(
            typeof settings.dailyMotivation === 'boolean'
              ? settings.dailyMotivation
              : defaultSettings.dailyMotivation
          );

          setExerciseConfirmation(
            typeof settings.exerciseConfirmation === 'boolean'
              ? settings.exerciseConfirmation
              : defaultSettings.exerciseConfirmation
          );

          setStreakCelebrations(
            typeof settings.streakCelebrations === 'boolean'
              ? settings.streakCelebrations
              : defaultSettings.streakCelebrations
          );

          setProgressUpdates(
            typeof settings.progressUpdates === 'boolean'
              ? settings.progressUpdates
              : defaultSettings.progressUpdates
          );

          setCaregiverSharingReminder(
            typeof settings.caregiverSharingReminder === 'boolean'
              ? settings.caregiverSharingReminder
              : defaultSettings.caregiverSharingReminder
          );
        } catch (error) {
          console.log(
            'Error loading patient experience settings:',
            error
          );
        }
      },
      [
        storageKey,
      ]
    );


  useEffect(() => {
    loadSettings();
  }, [
    loadSettings,
  ]);


  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [
      loadSettings,
    ])
  );


  // -------------------------------------------------------
  // Save Settings
  // -------------------------------------------------------

  const saveSettings =
    async (
      values
    ) => {
      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(values)
        );
      } catch (error) {
        console.log(
          'Error saving patient experience settings:',
          error
        );
      }
    };


  // -------------------------------------------------------
  // Toggle Handlers
  // -------------------------------------------------------

  const handleRecoveryTips =
    async (value) => {
      setRecoveryTips(value);

      await saveSettings({
        recoveryTips: value,
        dailyMotivation,
        exerciseConfirmation,
        streakCelebrations,
        progressUpdates,
        caregiverSharingReminder,
      });
    };


  const handleDailyMotivation =
    async (value) => {
      setDailyMotivation(value);

      await saveSettings({
        recoveryTips,
        dailyMotivation: value,
        exerciseConfirmation,
        streakCelebrations,
        progressUpdates,
        caregiverSharingReminder,
      });
    };


  const handleExerciseConfirmation =
    async (value) => {
      setExerciseConfirmation(value);

      await saveSettings({
        recoveryTips,
        dailyMotivation,
        exerciseConfirmation: value,
        streakCelebrations,
        progressUpdates,
        caregiverSharingReminder,
      });
    };


  const handleStreakCelebrations =
    async (value) => {
      setStreakCelebrations(value);

      await saveSettings({
        recoveryTips,
        dailyMotivation,
        exerciseConfirmation,
        streakCelebrations: value,
        progressUpdates,
        caregiverSharingReminder,
      });
    };


  const handleProgressUpdates =
    async (value) => {
      setProgressUpdates(value);

      await saveSettings({
        recoveryTips,
        dailyMotivation,
        exerciseConfirmation,
        streakCelebrations,
        progressUpdates: value,
        caregiverSharingReminder,
      });
    };


  const handleCaregiverSharingReminder =
    async (value) => {
      setCaregiverSharingReminder(value);

      await saveSettings({
        recoveryTips,
        dailyMotivation,
        exerciseConfirmation,
        streakCelebrations,
        progressUpdates,
        caregiverSharingReminder: value,
      });
    };


  // -------------------------------------------------------
  // Reset
  // -------------------------------------------------------

  const resetPreferences =
    () => {
      Alert.alert(
        'Reset Preferences',
        'Reset all Patient Experience preferences to their default settings?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Reset',
            style: 'destructive',
            onPress:
              async () => {
                setRecoveryTips(
                  defaultSettings.recoveryTips
                );

                setDailyMotivation(
                  defaultSettings.dailyMotivation
                );

                setExerciseConfirmation(
                  defaultSettings.exerciseConfirmation
                );

                setStreakCelebrations(
                  defaultSettings.streakCelebrations
                );

                setProgressUpdates(
                  defaultSettings.progressUpdates
                );

                setCaregiverSharingReminder(
                  defaultSettings.caregiverSharingReminder
                );

                await saveSettings(
                  defaultSettings
                );
              },
          },
        ]
      );
    };


  // -------------------------------------------------------
  // Reusable Setting Row
  // -------------------------------------------------------

  const SettingRow = ({
    icon,
    title,
    description,
    value,
    onValueChange,
  }) => (
    <View
      style={[
        styles.settingCard,
        highContrast &&
          styles.highContrastCard,
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          highContrast &&
            styles.highContrastIconCircle,
        ]}
      >
        <Ionicons
          name={icon}
          size={
            largeText
              ? 27
              : 24
          }
          color={
            highContrast
              ? '#000000'
              : '#5B6CFF'
          }
        />
      </View>

      <View
        style={
          styles.textContainer
        }
      >
        <Text
          style={[
            styles.settingTitle,
            {
              fontSize:
                font(17, 21),
              lineHeight:
                font(22, 28),
              color:
                highContrast
                  ? '#000000'
                  : '#111827',
            },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.settingDescription,
            {
              fontSize:
                font(13, 17),
              lineHeight:
                font(19, 24),
              color:
                highContrast
                  ? '#000000'
                  : '#6B7280',
            },
          ]}
        >
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={
          onValueChange
        }
        trackColor={{
          false: '#D1D5DB',
          true: '#A5B4FC',
        }}
        thumbColor={
          value
            ? '#5B6CFF'
            : '#F9FAFB'
        }
        ios_backgroundColor="#D1D5DB"
      />
    </View>
  );


  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        highContrast &&
          styles.highContrastBackground,
      ]}
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* HEADER */}

        <View
          style={
            styles.header
          }
        >
          <TouchableOpacity
            style={[
              styles.backButton,
              highContrast &&
                styles.highContrastBorder,
            ]}
            onPress={() =>
              navigation.goBack()
            }
            activeOpacity={0.75}
          >
            <Ionicons
              name="arrow-back"
              size={
                largeText
                  ? 25
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#111827'
              }
            />
          </TouchableOpacity>

          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={[
                styles.headerTitle,
                {
                  fontSize:
                    font(26, 32),
                  lineHeight:
                    font(32, 40),
                  color:
                    highContrast
                      ? '#000000'
                      : '#111827',
                },
              ]}
            >
              Patient Experience
            </Text>

            <Text
              style={[
                styles.headerSubtitle,
                {
                  fontSize:
                    font(14, 18),
                  lineHeight:
                    font(20, 26),
                  color:
                    highContrast
                      ? '#000000'
                      : '#6B7280',
                },
              ]}
            >
              Customize how StrokeBuddy supports you throughout your recovery.
            </Text>
          </View>
        </View>


        {/* RECOVERY SUPPORT */}

        <Text
          style={[
            styles.sectionTitle,
            {
              fontSize:
                font(18, 22),
              lineHeight:
                font(23, 29),
              color:
                highContrast
                  ? '#000000'
                  : '#111827',
            },
          ]}
        >
          Recovery Support
        </Text>


        <SettingRow
          icon="bulb-outline"
          title="Recovery Tips"
          description="Show helpful recovery suggestions throughout the app."
          value={
            recoveryTips
          }
          onValueChange={
            handleRecoveryTips
          }
        />


        <SettingRow
          icon="heart-outline"
          title="Daily Motivation"
          description="Show encouraging messages to help you stay engaged with your recovery."
          value={
            dailyMotivation
          }
          onValueChange={
            handleDailyMotivation
          }
        />


        <SettingRow
          icon="flame-outline"
          title="Streak Celebrations"
          description="Celebrate recovery streaks and milestones as you make progress."
          value={
            streakCelebrations
          }
          onValueChange={
            handleStreakCelebrations
          }
        />


        {/* EXERCISE EXPERIENCE */}

        <Text
          style={[
            styles.sectionTitle,
            {
              fontSize:
                font(18, 22),
              lineHeight:
                font(23, 29),
              color:
                highContrast
                  ? '#000000'
                  : '#111827',
            },
          ]}
        >
          Exercise Experience
        </Text>


        <SettingRow
          icon="checkmark-circle-outline"
          title="Confirm Exercise Completion"
          description="Ask for confirmation before marking an exercise as completed."
          value={
            exerciseConfirmation
          }
          onValueChange={
            handleExerciseConfirmation
          }
        />


        <SettingRow
          icon="analytics-outline"
          title="Progress Updates"
          description="Show updates about your recovery progress and completed goals."
          value={
            progressUpdates
          }
          onValueChange={
            handleProgressUpdates
          }
        />


        {/* CAREGIVER EXPERIENCE */}

        <Text
          style={[
            styles.sectionTitle,
            {
              fontSize:
                font(18, 22),
              lineHeight:
                font(23, 29),
              color:
                highContrast
                  ? '#000000'
                  : '#111827',
            },
          ]}
        >
          Caregiver Experience
        </Text>


        <SettingRow
          icon="people-outline"
          title="Caregiver Sharing Reminder"
          description="Remind you when recovery activity can be shared with your connected caregiver."
          value={
            caregiverSharingReminder
          }
          onValueChange={
            handleCaregiverSharingReminder
          }
        />


        {/* INFORMATION */}

        <View
          style={[
            styles.infoCard,
            highContrast &&
              styles.highContrastInfoCard,
          ]}
        >
          <View
            style={[
              styles.infoIconCircle,
              highContrast &&
                styles.highContrastInfoIcon,
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View
            style={
              styles.infoTextContainer
            }
          >
            <Text
              style={[
                styles.infoTitle,
                {
                  fontSize:
                    font(14, 18),
                  lineHeight:
                    font(20, 25),
                  color:
                    highContrast
                      ? '#000000'
                      : '#111827',
                },
              ]}
            >
              Your preferences are saved
            </Text>

            <Text
              style={[
                styles.infoText,
                {
                  fontSize:
                    font(12, 16),
                  lineHeight:
                    font(18, 23),
                  color:
                    highContrast
                      ? '#000000'
                      : '#4B5563',
                },
              ]}
            >
              These settings are saved to your StrokeBuddy account on this device and can be changed at any time.
            </Text>
          </View>
        </View>


        {/* RESET */}

        <TouchableOpacity
          style={[
            styles.resetButton,
            highContrast &&
              styles.highContrastResetButton,
          ]}
          onPress={
            resetPreferences
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name="refresh-outline"
            size={
              largeText
                ? 22
                : 19
            }
            color={
              highContrast
                ? '#000000'
                : '#DC2626'
            }
          />

          <Text
            style={[
              styles.resetText,
              {
                fontSize:
                  font(14, 18),
                lineHeight:
                  font(19, 24),
                color:
                  highContrast
                    ? '#000000'
                    : '#DC2626',
              },
            ]}
          >
            Reset Preferences
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}


// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  highContrastBackground: {
    backgroundColor: '#FFFFFF',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 45,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 27,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  highContrastBorder: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontWeight: '800',
    marginBottom: 5,
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    fontWeight: '500',
  },

  sectionTitle: {
    fontWeight: '800',
    marginTop: 3,
    marginBottom: 12,
  },

  settingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  highContrastCard: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  textContainer: {
    flex: 1,
    paddingRight: 10,
  },

  settingTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  settingDescription: {
    fontWeight: '500',
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    marginBottom: 18,
    gap: 12,
  },

  highContrastInfoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  infoIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  highContrastInfoIcon: {
    borderWidth: 2,
    borderColor: '#000000',
  },

  infoTextContainer: {
    flex: 1,
  },

  infoTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  infoText: {
    fontWeight: '500',
  },

  resetButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  highContrastResetButton: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },

  resetText: {
    fontWeight: '800',
    marginLeft: 8,
  },

});