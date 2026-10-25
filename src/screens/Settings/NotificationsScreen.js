import React, {
  useCallback,
  useRef,
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

import * as Notifications from 'expo-notifications';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  useAccessibility,
} from '../../context/AccessibilityContext';


// ---------------------------------------------------------
// Notification behavior
// ---------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


// ---------------------------------------------------------
// Default notification settings
// ---------------------------------------------------------

const DEFAULT_SETTINGS = {
  medReminders: true,
  caregiverMessages: true,
  exerciseReminders: true,
  recoveryMilestones: true,
};


// ---------------------------------------------------------
// Notification Row
//
// IMPORTANT:
// This component stays OUTSIDE NotificationsScreen.
// This prevents the switch rows from remounting whenever
// the parent screen re-renders.
// ---------------------------------------------------------

const NotificationRow = ({
  icon,
  title,
  description,
  value,
  onValueChange,
  largeText,
  highContrast,
  disabled,
}) => {
  const font = (
    normal,
    large
  ) =>
    largeText
      ? large
      : normal;

  return (
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
        onValueChange={onValueChange}
        disabled={disabled}
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
};


// ---------------------------------------------------------
// Main screen
// ---------------------------------------------------------

export default function NotificationsScreen({
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
  // Notification settings
  // -------------------------------------------------------

  const [
    settings,
    setSettings,
  ] = useState(
    DEFAULT_SETTINGS
  );

  /*
   * Keep a synchronous reference to the newest settings.
   *
   * This prevents stale-state problems when switches are
   * tapped quickly.
   */
  const settingsRef =
    useRef(
      DEFAULT_SETTINGS
    );

  const [
    permissionStatus,
    setPermissionStatus,
  ] = useState('unknown');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);


  const storageKey =
    `strokebuddy_notification_settings_${
      accountId || 'default_patient'
    }`;


  // -------------------------------------------------------
  // Load settings
  // -------------------------------------------------------

  const loadSettings =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const saved =
            await AsyncStorage.getItem(
              storageKey
            );

          let loadedSettings = {
            ...DEFAULT_SETTINGS,
          };

          if (saved) {
            try {
              const parsed =
                JSON.parse(saved);

              if (
                parsed &&
                typeof parsed === 'object'
              ) {
                loadedSettings = {
                  medReminders:
                    typeof parsed.medReminders === 'boolean'
                      ? parsed.medReminders
                      : DEFAULT_SETTINGS.medReminders,

                  caregiverMessages:
                    typeof parsed.caregiverMessages === 'boolean'
                      ? parsed.caregiverMessages
                      : DEFAULT_SETTINGS.caregiverMessages,

                  exerciseReminders:
                    typeof parsed.exerciseReminders === 'boolean'
                      ? parsed.exerciseReminders
                      : DEFAULT_SETTINGS.exerciseReminders,

                  recoveryMilestones:
                    typeof parsed.recoveryMilestones === 'boolean'
                      ? parsed.recoveryMilestones
                      : DEFAULT_SETTINGS.recoveryMilestones,
                };
              }
            } catch (parseError) {
              console.log(
                'Notification settings parse error:',
                parseError
              );

              loadedSettings = {
                ...DEFAULT_SETTINGS,
              };
            }
          }

          /*
           * Update REF and STATE together.
           */
          settingsRef.current =
            loadedSettings;

          setSettings(
            loadedSettings
          );

          /*
           * Check current device notification
           * permission.
           */
          const permissions =
            await Notifications.getPermissionsAsync();

          setPermissionStatus(
            permissions.status
          );
        } catch (error) {
          console.log(
            'Notification settings load error:',
            error
          );
        } finally {
          setLoading(false);
        }
      },
      [
        storageKey,
      ]
    );


  // -------------------------------------------------------
  // Reload whenever this screen receives focus
  //
  // We intentionally use ONLY useFocusEffect.
  // The previous version also had useEffect calling the
  // same load function, which could cause two simultaneous
  // reads when the screen first opened.
  // -------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      loadSettings();

      return undefined;
    }, [
      loadSettings,
    ])
  );


  // -------------------------------------------------------
  // Save settings
  // -------------------------------------------------------

  const saveSettings =
    async (
      nextSettings
    ) => {
      try {
        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(
            nextSettings
          )
        );

        return true;
      } catch (error) {
        console.log(
          'Notification settings save error:',
          error
        );

        Alert.alert(
          'Settings Error',
          'Your notification preference could not be saved.'
        );

        return false;
      }
    };


  // -------------------------------------------------------
  // Request notification permission
  // -------------------------------------------------------

  const requestNotificationPermission =
    async () => {
      try {
        const current =
          await Notifications.getPermissionsAsync();

        if (
          current.status ===
          Notifications.PermissionStatus.GRANTED
        ) {
          setPermissionStatus(
            current.status
          );

          return true;
        }

        const result =
          await Notifications.requestPermissionsAsync();

        setPermissionStatus(
          result.status
        );

        if (
          result.status !==
          Notifications.PermissionStatus.GRANTED
        ) {
          Alert.alert(
            'Notifications Disabled',
            'Please allow notifications in your device settings so StrokeBuddy can send reminders and updates.'
          );

          return false;
        }

        return true;
      } catch (error) {
        console.log(
          'Notification permission error:',
          error
        );

        Alert.alert(
          'Notification Error',
          'We could not access notification permissions.'
        );

        return false;
      }
    };


  // -------------------------------------------------------
  // Toggle handler
  // -------------------------------------------------------

  const handleToggle =
    async (
      settingName,
      value
    ) => {
      /*
       * Prevent overlapping writes.
       */
      if (saving) {
        return;
      }

      /*
       * Turning a notification category ON requires
       * notification permission.
       */
      if (value) {
        const allowed =
          await requestNotificationPermission();

        if (!allowed) {
          return;
        }
      }

      setSaving(true);

      try {
        /*
         * ALWAYS read the newest settings from the ref.
         */
        const previousSettings =
          settingsRef.current;

        /*
         * Change ONLY the tapped setting.
         */
        const nextSettings = {
          ...previousSettings,
          [settingName]: value,
        };

        /*
         * Update ref immediately.
         */
        settingsRef.current =
          nextSettings;

        /*
         * Update UI.
         */
        setSettings(
          nextSettings
        );

        /*
         * Persist the complete settings object.
         */
        const saved =
          await saveSettings(
            nextSettings
          );

        /*
         * If persistence failed, restore the previous
         * settings so the UI does not falsely show a
         * preference that was not saved.
         */
        if (!saved) {
          settingsRef.current =
            previousSettings;

          setSettings(
            previousSettings
          );
        }
      } catch (error) {
        console.log(
          'Notification toggle error:',
          error
        );
      } finally {
        setSaving(false);
      }
    };


  // -------------------------------------------------------
  // Test notification
  // -------------------------------------------------------

  const sendTestNotification =
    async () => {
      const allowed =
        await requestNotificationPermission();

      if (!allowed) {
        return;
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'StrokeBuddy',
            body: 'Your notifications are working!',
            sound: 'default',
          },

          trigger: {
            type:
              Notifications.SchedulableTriggerInputTypes
                .TIME_INTERVAL,

            seconds: 2,

            repeats: false,
          },
        });

        Alert.alert(
          'Test Scheduled',
          'A StrokeBuddy test notification will appear shortly.'
        );
      } catch (error) {
        console.log(
          'Test notification error:',
          error
        );

        Alert.alert(
          'Notification Error',
          'The test notification could not be scheduled.'
        );
      }
    };


  // -------------------------------------------------------
  // Permission status
  // -------------------------------------------------------

  const notificationsEnabled =
    permissionStatus ===
    Notifications.PermissionStatus.GRANTED;


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

        {/* Header */}

        <View
          style={styles.header}
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
              Notifications
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
              Choose which StrokeBuddy updates you want to receive.
            </Text>
          </View>
        </View>


        {/* Notification status */}

        <View
          style={[
            styles.statusCard,
            highContrast &&
              styles.highContrastStatusCard,
          ]}
        >
          <View
            style={[
              styles.statusIcon,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name={
                notificationsEnabled
                  ? 'notifications-outline'
                  : 'notifications-off-outline'
              }
              size={
                largeText
                  ? 27
                  : 23
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
              styles.statusTextContainer
            }
          >
            <Text
              style={[
                styles.statusTitle,
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
              {notificationsEnabled
                ? 'Notifications are enabled'
                : 'Notifications need permission'}
            </Text>

            <Text
              style={[
                styles.statusDescription,
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
              {notificationsEnabled
                ? 'StrokeBuddy can send enabled reminders and updates.'
                : 'Allow notifications to receive StrokeBuddy reminders and updates.'}
            </Text>
          </View>
        </View>


        {/* Reminders */}

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
          Reminders
        </Text>


        <NotificationRow
          icon="medkit-outline"
          title="Medication Reminders"
          description="Get alerts when it is time to take or record your medication."
          value={
            settings.medReminders
          }
          onValueChange={
            value =>
              handleToggle(
                'medReminders',
                value
              )
          }
          largeText={
            largeText
          }
          highContrast={
            highContrast
          }
          disabled={
            loading ||
            saving
          }
        />


        <NotificationRow
          icon="fitness-outline"
          title="Exercise Reminders"
          description="Receive reminders to keep up with your recovery exercises."
          value={
            settings.exerciseReminders
          }
          onValueChange={
            value =>
              handleToggle(
                'exerciseReminders',
                value
              )
          }
          largeText={
            largeText
          }
          highContrast={
            highContrast
          }
          disabled={
            loading ||
            saving
          }
        />


        {/* Updates */}

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
          Updates
        </Text>


        <NotificationRow
          icon="chatbubble-ellipses-outline"
          title="Caregiver Messages"
          description="Get notified when your connected caregiver sends you a message."
          value={
            settings.caregiverMessages
          }
          onValueChange={
            value =>
              handleToggle(
                'caregiverMessages',
                value
              )
          }
          largeText={
            largeText
          }
          highContrast={
            highContrast
          }
          disabled={
            loading ||
            saving
          }
        />


        <NotificationRow
          icon="trophy-outline"
          title="Recovery Milestones"
          description="Get notified when you complete important recovery goals and milestones."
          value={
            settings.recoveryMilestones
          }
          onValueChange={
            value =>
              handleToggle(
                'recoveryMilestones',
                value
              )
          }
          largeText={
            largeText
          }
          highContrast={
            highContrast
          }
          disabled={
            loading ||
            saving
          }
        />


        {/* Test notification */}

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
          Test Notifications
        </Text>


        <TouchableOpacity
          style={[
            styles.testButton,
            highContrast &&
              styles.highContrastTestButton,
          ]}
          onPress={
            sendTestNotification
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name="notifications-outline"
            size={
              largeText
                ? 23
                : 20
            }
            color="#FFFFFF"
          />

          <Text
            style={[
              styles.testButtonText,
              {
                fontSize:
                  font(14, 18),

                lineHeight:
                  font(19, 24),
              },
            ]}
          >
            Send Test Notification
          </Text>
        </TouchableOpacity>


        {/* Information card */}

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
              color={highContrast ? '#000000' : '#5B6CFF'}
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
              You control your notifications
            </Text>

            <Text
              style={[
                styles.infoSubtitle,
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
              You can change these preferences at any time. Turning a category off prevents StrokeBuddy from using that notification category.
            </Text>
          </View>
        </View>

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
    marginBottom: 25,
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
  },

  headerSubtitle: {
    fontWeight: '500',
  },

  statusCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 26,
  },

  highContrastStatusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  statusTextContainer: {
    flex: 1,
  },

  statusTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  statusDescription: {
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
    borderWidth: 2,
    borderColor: '#000000',
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

  testButton: {
    backgroundColor: '#5B6CFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  highContrastTestButton: {
    backgroundColor: '#000000',
  },

  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 8,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    marginTop: 3,
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
    marginRight: 12,
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

  infoSubtitle: {
    fontWeight: '500',
  },
});