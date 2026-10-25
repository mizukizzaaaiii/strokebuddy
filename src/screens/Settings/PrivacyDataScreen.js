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


export default function PrivacyDataScreen({
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

  const [
    clearing,
    setClearing,
  ] = useState(false);

  const [
    storedDataCount,
    setStoredDataCount,
  ] = useState(null);


  const font = (
    normal,
    large
  ) =>
    largeText
      ? large
      : normal;


  // -------------------------------------------------------
  // Known account-specific storage keys
  // -------------------------------------------------------

  const getAccountDataKeys =
    useCallback(
      async () => {
        if (!accountId) {
          return [];
        }

        const id =
          String(accountId);

        const keys =
          await AsyncStorage.getAllKeys();

        const exactAccountKeys = [
          `strokebuddy_accessibility_settings_${id}`,
          `strokebuddy_patient_experience_${id}`,
          `strokebuddy_share_activity_logs_${id}`,
          `strokebuddy_notification_settings_${id}`,
          `strokebuddy_recovery_${id}`,
          `strokebuddy_medications_${id}`,
          `strokebuddy_meds_${id}`,
          `strokebuddy_messages_${id}`,
          `strokebuddy_notifications_${id}`,
          `strokebuddy_emergency_contacts_${id}`,
        ];

        const matchedKeys =
          keys.filter(
            (key) =>
              exactAccountKeys.includes(key) ||
              key.includes(`_${id}_`) ||
              key.endsWith(`_${id}`)
          );

        return [
          ...new Set(
            matchedKeys
          ),
        ];
      },
      [
        accountId,
      ]
    );


  // -------------------------------------------------------
  // Count account-specific data
  // -------------------------------------------------------

  const loadDataSummary =
    useCallback(
      async () => {
        try {
          const accountKeys =
            await getAccountDataKeys();

          setStoredDataCount(
            accountKeys.length
          );
        } catch (error) {
          console.log(
            'Error checking local data:',
            error
          );

          setStoredDataCount(null);
        }
      },
      [
        getAccountDataKeys,
      ]
    );


  useEffect(() => {
    loadDataSummary();
  }, [
    loadDataSummary,
  ]);


  useFocusEffect(
    useCallback(() => {
      loadDataSummary();
    }, [
      loadDataSummary,
    ])
  );


  // -------------------------------------------------------
  // Clear local data
  // -------------------------------------------------------

  const clearLocalData =
    () => {
      if (!accountId) {
        Alert.alert(
          'Unable to Clear Data',
          'A patient account could not be identified. Please return to your account and try again.'
        );

        return;
      }

      Alert.alert(
        'Clear Local App Data',
        'This will remove locally stored StrokeBuddy preferences and patient-specific app data from this device. Your StrokeBuddy account itself will not be deleted.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Clear Data',
            style: 'destructive',
            onPress:
              performClearData,
          },
        ]
      );
    };


  const performClearData =
    async () => {
      if (
        clearing ||
        !accountId
      ) {
        return;
      }

      setClearing(true);

      try {
        /*
         * IMPORTANT:
         * We intentionally do NOT remove:
         *
         * - strokebuddy_accounts
         * - the patient's account record
         * - another patient's information
         * - global app configuration
         *
         * Only keys belonging to this account are removed.
         */

        const accountKeys =
          await getAccountDataKeys();

        if (
          accountKeys.length > 0
        ) {
          await AsyncStorage.multiRemove(
            accountKeys
          );
        }

        setStoredDataCount(0);

        Alert.alert(
          'Data Cleared',
          'Your locally stored patient-specific StrokeBuddy preferences and app data have been cleared. Your StrokeBuddy account has not been deleted.'
        );
      } catch (error) {
        console.log(
          'Error clearing local data:',
          error
        );

        Alert.alert(
          'Unable to Clear Data',
          'Something went wrong while clearing your local data. Please try again.'
        );
      } finally {
        setClearing(false);
      }
    };


  // -------------------------------------------------------
  // Information card
  // -------------------------------------------------------

  const InformationCard = ({
    icon,
    title,
    children,
  }) => (
    <View
      style={[
        styles.card,
        highContrast &&
          styles.highContrastCard,
      ]}
    >
      <View
        style={styles.cardTop}
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

        <Text
          style={[
            styles.cardTitle,
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
      </View>

      <Text
        style={[
          styles.cardText,
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
        {children}
      </Text>
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
              Privacy & Data
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
              Learn what information StrokeBuddy uses and manage locally stored app data.
            </Text>
          </View>
        </View>


        {/* Your Information */}

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
          Your Information
        </Text>


        <InformationCard
          icon="person-outline"
          title="Account Information"
        >
          StrokeBuddy may store information associated with your account, such as your name, email address, role, and caregiver connection information.
        </InformationCard>


        <InformationCard
          icon="analytics-outline"
          title="Recovery Information"
        >
          Recovery-related information may include exercise progress, completed activities, streak information, medication information, and other features you choose to use.
        </InformationCard>


        <InformationCard
          icon="people-outline"
          title="Caregiver Connection"
        >
          If you connect a caregiver, StrokeBuddy uses connection information so supported patient and caregiver communication and care features can work.
        </InformationCard>


        {/* Data Controls */}

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
          Data Controls
        </Text>


        <InformationCard
          icon="phone-portrait-outline"
          title="Local Storage"
        >
          Some StrokeBuddy features store information locally on your device so your settings and patient-specific app data can remain available between sessions.
        </InformationCard>


        {/* Stored data status */}

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
              name="server-outline"
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
              Local data status
            </Text>

            <Text
              style={[
                styles.statusText,
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
              {storedDataCount === null
                ? 'Checking locally stored account data...'
                : storedDataCount === 0
                  ? 'No account-specific local data was found.'
                  : `${storedDataCount} account-specific storage item${
                      storedDataCount === 1
                        ? ''
                        : 's'
                    } found on this device.`}
            </Text>
          </View>
        </View>


        {/* Clear */}

        <TouchableOpacity
          style={[
            styles.dangerCard,
            highContrast &&
              styles.highContrastDangerCard,
          ]}
          onPress={
            clearLocalData
          }
          disabled={
            clearing
          }
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.dangerIcon,
              highContrast &&
                styles.highContrastDangerIcon,
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={
                largeText
                  ? 27
                  : 23
              }
              color={
                highContrast
                  ? '#000000'
                  : '#DC2626'
              }
            />
          </View>

          <View
            style={
              styles.dangerTextContainer
            }
          >
            <Text
              style={[
                styles.dangerTitle,
                {
                  fontSize:
                    font(16, 20),
                  lineHeight:
                    font(21, 27),
                  color:
                    highContrast
                      ? '#000000'
                      : '#DC2626',
                },
              ]}
            >
              {clearing
                ? 'Clearing Data...'
                : 'Clear Local App Data'}
            </Text>

            <Text
              style={[
                styles.dangerDescription,
                {
                  fontSize:
                    font(12, 16),
                  lineHeight:
                    font(17, 23),
                  color:
                    highContrast
                      ? '#000000'
                      : '#6B7280',
                },
              ]}
            >
              Remove this account's locally stored preferences and app data from this device.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 25
                : 22
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>


        {/* Important notice */}

        <View
          style={[
            styles.noticeCard,
            highContrast &&
              styles.highContrastNoticeCard,
          ]}
        >
          <View
            style={[
              styles.noticeIconCircle,
              highContrast &&
                styles.highContrastNoticeIcon,
            ]}
          >
            <Ionicons
              name="information-circle-outline"
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
              styles.noticeTextContainer
            }
          >
            <Text
              style={[
                styles.noticeTitle,
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
              Important
            </Text>

            <Text
              style={[
                styles.noticeText,
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
              Clearing local data does not delete your StrokeBuddy account. Your account record remains available so you can continue using your account.
            </Text>
          </View>
        </View>


        {/* Footer */}

        <Text
          style={[
            styles.footer,
            {
              fontSize:
                font(11, 14),
              lineHeight:
                font(17, 21),
              color:
                highContrast
                  ? '#000000'
                  : '#9CA3AF',
            },
          ]}
        >
          StrokeBuddy privacy controls may expand as additional account and recovery features are added.
        </Text>

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

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 12,
  },

  highContrastCard: {
    borderWidth: 2,
    borderColor: '#000000',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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

  cardTitle: {
    flex: 1,
    fontWeight: '800',
  },

  cardText: {
    fontWeight: '500',
  },

  statusCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    marginTop: 4,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  highContrastStatusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  statusTextContainer: {
    flex: 1,
  },

  statusTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  statusText: {
    fontWeight: '500',
  },

  dangerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  highContrastDangerCard: {
    borderWidth: 2,
    borderColor: '#000000',
  },

  dangerIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  highContrastDangerIcon: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  dangerTextContainer: {
    flex: 1,
    paddingRight: 8,
  },

  dangerTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  dangerDescription: {
    fontWeight: '500',
  },

  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },

  highContrastNoticeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  noticeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  highContrastNoticeIcon: {
    borderWidth: 2,
    borderColor: '#000000',
  },

  noticeTextContainer: {
    flex: 1,
  },

  noticeTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  noticeText: {
    fontWeight: '500',
  },

  footer: {
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 2,
  },
});