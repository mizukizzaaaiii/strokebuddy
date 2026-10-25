import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNTS_KEY = 'strokebuddy_accounts';
const MESSAGES_KEY = 'strokebuddy_messages';
const NOTIFICATIONS_KEY = 'strokebuddy_notifications';

const POLL_INTERVAL = 1000;
const MAX_MESSAGE_LENGTH = 300;

/* ============================================================
 * HELPERS
 * ============================================================ */

function createMessageId(prefix = 'message') {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function createNotificationId() {
  return `notification_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function safelyParseArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAccountId(account) {
  if (!account) {
    return '';
  }

  return String(account.id || account.accountId || '');
}

function getMessageTimestamp(message) {
  const timestamp = new Date(message?.timestamp).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const text = String(message.text || '').trim();

  if (!text) {
    return null;
  }

  const sender =
    message.sender === 'caregiver' ? 'caregiver' : 'patient';

  return {
    ...message,
    id: String(message.id || createMessageId(sender)),
    text,
    sender,
    type: message.type || 'text',
    timestamp: message.timestamp || new Date().toISOString(),
    read: Boolean(message.read),
  };
}

/*
 * Supports the different phone-number field names that may
 * already exist in StrokeBuddy accounts.
 */
function getPatientPhoneNumber(patient) {
  if (!patient) {
    return '';
  }

  const possiblePhone =
    patient.phoneNumber ||
    patient.phone ||
    patient.mobileNumber ||
    patient.mobile ||
    patient.contactPhone ||
    patient.telephone ||
    '';

  return String(possiblePhone).trim();
}

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function CaregiverVoiceScreen({
  route,
  navigation,
}) {
  const accountId =
    route?.params?.accountId ||
    route?.params?.caregiverAccountId ||
    route?.params?.caregiverId ||
    null;

  const routePatientId =
    route?.params?.patientAccountId ||
    route?.params?.patientId ||
    null;

  const [caregiver, setCaregiver] = useState(null);
  const [patient, setPatient] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState(null);

  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const knownMessageIdsRef = useRef(new Set());
  const scrollViewRef = useRef(null);

  /* ============================================================
   * ACCESSIBILITY SETTINGS
   * ============================================================ */

  const loadAccessibilitySettings = useCallback(async () => {
    try {
      const caregiverId = accountId || 'default_caregiver';

      const key =
        `strokebuddy_accessibility_settings_${caregiverId}`;

      const stored = await AsyncStorage.getItem(key);

      if (!stored) {
        return;
      }

      const settings = JSON.parse(stored);

      setLargeText(Boolean(settings?.largeText));
      setHighContrast(Boolean(settings?.highContrast));
    } catch (accessibilityError) {
      console.log(
        'Caregiver Voice accessibility settings error:',
        accessibilityError
      );
    }
  }, [accountId]);

  useEffect(() => {
    loadAccessibilitySettings();
  }, [loadAccessibilitySettings]);

  const headingSize = largeText ? 30 : 25;
  const bodySize = largeText ? 18 : 15;
  const smallSize = largeText ? 16 : 13;

  const backgroundColor = highContrast
    ? '#FFFFFF'
    : '#F7F7FB';

  const cardBackground = '#FFFFFF';

  const textColor = highContrast
    ? '#000000'
    : '#111827';

  const secondaryTextColor = highContrast
    ? '#333333'
    : '#6B7280';

  const borderColor = highContrast
    ? '#000000'
    : '#E5E7EB';

  const inputBackground = highContrast
    ? '#FFFFFF'
    : '#F3F4F6';

  /* ============================================================
   * RESOLVE CAREGIVER + CONNECTED PATIENT
   * ============================================================ */

  const resolveAccounts = useCallback(async () => {
    try {
      const storedAccounts =
        await AsyncStorage.getItem(ACCOUNTS_KEY);

      const accounts = safelyParseArray(storedAccounts);

      if (!accounts.length) {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }

      let caregiverAccount = null;

      /*
       * Resolve the actual logged-in caregiver.
       */

      if (accountId) {
        caregiverAccount =
          accounts.find(
            account =>
              account?.role === 'caregiver' &&
              getAccountId(account) === String(accountId)
          ) || null;
      }

      /*
       * Only fall back to the first caregiver when
       * there was no account ID supplied at all.
       */

      if (!caregiverAccount && !accountId) {
        caregiverAccount =
          accounts.find(
            account => account?.role === 'caregiver'
          ) || null;
      }

      if (!caregiverAccount) {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }

      const caregiverId = getAccountId(caregiverAccount);

      /* --------------------------------------------------------
       * 1. EXPLICIT ROUTE PATIENT
       * -------------------------------------------------------- */

      if (routePatientId) {
        const explicitPatient =
          accounts.find(
            account =>
              account?.role === 'patient' &&
              getAccountId(account) === String(routePatientId)
          ) || null;

        if (explicitPatient) {
          const patientConnectedCaregiver =
            explicitPatient.connectedCaregiverId ||
            explicitPatient.caregiverId ||
            explicitPatient.connectedCaregiverAccountId ||
            null;

          const caregiverConnectedPatient =
            caregiverAccount.connectedPatientId ||
            caregiverAccount.patientId ||
            caregiverAccount.connectedPatientAccountId ||
            null;

          const belongsToCaregiver =
            !caregiverId ||
            String(patientConnectedCaregiver || '') ===
              caregiverId ||
            String(caregiverConnectedPatient || '') ===
              getAccountId(explicitPatient);

          if (belongsToCaregiver) {
            return {
              caregiverAccount,
              patientAccount: explicitPatient,
            };
          }
        }
      }

      /* --------------------------------------------------------
       * 2. CAREGIVER ACCOUNT CONNECTION
       * -------------------------------------------------------- */

      const connectedPatientId =
        caregiverAccount.connectedPatientId ||
        caregiverAccount.patientId ||
        caregiverAccount.connectedPatientAccountId ||
        null;

      if (connectedPatientId) {
        const connectedPatient =
          accounts.find(
            account =>
              account?.role === 'patient' &&
              getAccountId(account) === String(connectedPatientId)
          ) || null;

        if (connectedPatient) {
          return {
            caregiverAccount,
            patientAccount: connectedPatient,
          };
        }
      }

      /* --------------------------------------------------------
       * 3. CAREGIVER SETTINGS CONNECTION
       * -------------------------------------------------------- */

      if (caregiverId) {
        try {
          const settingsKey =
            `strokebuddy_caregiver_settings_${caregiverId}`;

          const storedSettings =
            await AsyncStorage.getItem(settingsKey);

          if (storedSettings) {
            let settings = null;

            try {
              settings = JSON.parse(storedSettings);
            } catch {
              settings = null;
            }

            const settingsPatientId =
              settings?.connectedPatientId ||
              settings?.patientId ||
              settings?.connectedPatientAccountId ||
              null;

            if (settingsPatientId) {
              const settingsPatient =
                accounts.find(
                  account =>
                    account?.role === 'patient' &&
                    getAccountId(account) ===
                      String(settingsPatientId)
                ) || null;

              if (settingsPatient) {
                return {
                  caregiverAccount,
                  patientAccount: settingsPatient,
                };
              }
            }
          }
        } catch (settingsError) {
          console.log(
            'Caregiver Voice settings lookup error:',
            settingsError
          );
        }
      }

      /* --------------------------------------------------------
       * 4. REVERSE PATIENT CONNECTION
       * -------------------------------------------------------- */

      if (caregiverId) {
        const reverseConnectedPatient =
          accounts.find(
            account =>
              account?.role === 'patient' &&
              (
                String(
                  account?.connectedCaregiverId || ''
                ) === caregiverId ||
                String(
                  account?.caregiverId || ''
                ) === caregiverId ||
                String(
                  account?.connectedCaregiverAccountId || ''
                ) === caregiverId
              )
          ) || null;

        if (reverseConnectedPatient) {
          return {
            caregiverAccount,
            patientAccount: reverseConnectedPatient,
          };
        }
      }

      return {
        caregiverAccount,
        patientAccount: null,
      };
    } catch (resolveError) {
      console.error(
        'CaregiverVoiceScreen account resolution error:',
        resolveError
      );

      return {
        caregiverAccount: null,
        patientAccount: null,
      };
    }
  }, [accountId, routePatientId]);

  /* ============================================================
   * LOAD MESSAGES
   * ============================================================ */

  const loadMessages = useCallback(
    async ({
      markPatientMessagesRead = true,
      showLoading = false,
    } = {}) => {
      try {
        if (showLoading) {
          setLoading(true);
        }

        const {
          caregiverAccount,
          patientAccount,
        } = await resolveAccounts();

        if (!caregiverAccount) {
          setCaregiver(null);
          setPatient(null);
          setMessages([]);
          setError(
            'Caregiver account could not be found.'
          );
          return;
        }

        setCaregiver(caregiverAccount);
        setPatient(patientAccount);

        const caregiverId =
          getAccountId(caregiverAccount);

        /*
         * No connected patient.
         */

        if (!patientAccount) {
          setMessages([]);
          setError(null);
          return;
        }

        const patientId =
          getAccountId(patientAccount);

        if (!patientId) {
          setMessages([]);
          setError(null);
          return;
        }

        const storedMessages =
          await AsyncStorage.getItem(MESSAGES_KEY);

        const parsedMessages =
          safelyParseArray(storedMessages);

        /*
         * Filter this exact caregiver ↔ patient conversation.
         */

        const normalizedMessages =
          parsedMessages
            .map(normalizeMessage)
            .filter(Boolean)
            .filter(message => {
              const messagePatientId =
                String(message.patientId || '');

              const messageCaregiverId =
                String(message.caregiverId || '');

              const belongsToPatient =
                messagePatientId === patientId;

              const belongsToCaregiver =
                !messageCaregiverId ||
                messageCaregiverId === caregiverId;

              return (
                belongsToPatient &&
                belongsToCaregiver
              );
            })
            .sort(
              (a, b) =>
                getMessageTimestamp(a) -
                getMessageTimestamp(b)
            );

        /*
         * Mark patient messages as read.
         */

        if (
          markPatientMessagesRead &&
          parsedMessages.length
        ) {
          let changed = false;

          const updatedAllMessages =
            parsedMessages.map(message => {
              const normalized =
                normalizeMessage(message);

              if (!normalized) {
                return message;
              }

              const isPatientMessage =
                normalized.sender === 'patient';

              const belongsToPatient =
                String(
                  normalized.patientId || ''
                ) === patientId;

              const messageCaregiverId =
                String(
                  normalized.caregiverId || ''
                );

              const belongsToCaregiver =
                !messageCaregiverId ||
                messageCaregiverId === caregiverId;

              if (
                isPatientMessage &&
                belongsToPatient &&
                belongsToCaregiver &&
                !normalized.read
              ) {
                changed = true;

                return {
                  ...message,
                  read: true,
                };
              }

              return message;
            });

          if (changed) {
            await AsyncStorage.setItem(
              MESSAGES_KEY,
              JSON.stringify(updatedAllMessages)
            );
          }
        }

        normalizedMessages.forEach(message => {
          knownMessageIdsRef.current.add(
            message.id
          );
        });

        setMessages(normalizedMessages);
        setError(null);
      } catch (loadError) {
        console.error(
          'CaregiverVoiceScreen load error:',
          loadError
        );

        setError(
          'Unable to load messages right now.'
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [resolveAccounts]
  );

  /* ============================================================
   * INITIAL LOAD + POLLING
   * ============================================================ */

  useEffect(() => {
    loadMessages({
      markPatientMessagesRead: true,
      showLoading: true,
    });

    const interval = setInterval(() => {
      loadMessages({
        markPatientMessagesRead: true,
        showLoading: false,
      });
    }, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [loadMessages]);

  /* ============================================================
   * AUTO-SCROLL
   * ============================================================ */

  useEffect(() => {
    if (!messages.length) {
      return;
    }

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [messages.length]);

  /* ============================================================
   * CALL PATIENT
   * ============================================================ */

  const callPatient = useCallback(async () => {
    if (!patient) {
      Alert.alert(
        'No connected patient',
        'Connect a patient account before making a call.'
      );

      return;
    }

    const phoneNumber =
      getPatientPhoneNumber(patient);

    if (!phoneNumber) {
      Alert.alert(
        'No phone number',
        `${patient?.name || patient?.fullName || 'This patient'} does not have a phone number saved in their account.`
      );

      return;
    }

    const telUrl =
      `tel:${phoneNumber.replace(/[^\d+]/g, '')}`;

    try {
      const supported =
        await Linking.canOpenURL(telUrl);

      if (!supported) {
        Alert.alert(
          'Calling unavailable',
          'This device cannot place phone calls.'
        );

        return;
      }

      await Linking.openURL(telUrl);
    } catch (callError) {
      console.error(
        'CaregiverVoiceScreen call error:',
        callError
      );

      Alert.alert(
        'Unable to call',
        'The phone call could not be started.'
      );
    }
  }, [patient]);

  /* ============================================================
   * REFRESH
   * ============================================================ */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadMessages({
        markPatientMessagesRead: true,
        showLoading: false,
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadMessages]);

  /* ============================================================
   * SEND CAREGIVER REPLY
   * ============================================================ */

  const sendReply = useCallback(async () => {
    const trimmedText =
      messageText.trim();

    if (!trimmedText) {
      return;
    }

    if (
      trimmedText.length >
      MAX_MESSAGE_LENGTH
    ) {
      Alert.alert(
        'Message too long',
        `Please keep messages under ${MAX_MESSAGE_LENGTH} characters.`
      );

      return;
    }

    if (!caregiver || !patient) {
      Alert.alert(
        'No connected patient',
        'Connect a patient account before sending messages.'
      );

      return;
    }

    if (sending) {
      return;
    }

    setSending(true);

    try {
      const {
        caregiverAccount,
        patientAccount,
      } = await resolveAccounts();

      if (
        !caregiverAccount ||
        !patientAccount
      ) {
        Alert.alert(
          'No connected patient',
          'The patient connection is no longer available.'
        );

        setCaregiver(caregiverAccount);
        setPatient(patientAccount);
        setMessages([]);

        return;
      }

      const caregiverId =
        getAccountId(caregiverAccount);

      const patientId =
        getAccountId(patientAccount);

      if (!caregiverId || !patientId) {
        Alert.alert(
          'Message not sent',
          'The caregiver or patient account could not be identified.'
        );

        return;
      }

      const storedMessages =
        await AsyncStorage.getItem(MESSAGES_KEY);

      const allMessages =
        safelyParseArray(storedMessages);

      const timestamp =
        new Date().toISOString();

      const newMessage = {
        id: createMessageId('caregiver'),
        patientId,
        caregiverId,
        sender: 'caregiver',
        text: trimmedText,
        type: 'text',
        timestamp,
        delivered: true,
        read: false,
      };

      const updatedMessages = [
        ...allMessages,
        newMessage,
      ];

      await AsyncStorage.setItem(
        MESSAGES_KEY,
        JSON.stringify(updatedMessages)
      );

      /*
       * Patient notification.
       */

      const storedNotifications =
        await AsyncStorage.getItem(
          NOTIFICATIONS_KEY
        );

      const notifications =
        safelyParseArray(
          storedNotifications
        );

      const caregiverName =
        caregiverAccount.name ||
        caregiverAccount.fullName ||
        'Your caregiver';

      const notification = {
        id: createNotificationId(),
        userId: patientId,
        patientId,
        caregiverId,
        type: 'caregiver_message',
        title: 'New message from your caregiver',
        message:
          `${caregiverName}: ${trimmedText}`,
        body: trimmedText,
        read: false,
        timestamp,
        relatedMessageId: newMessage.id,
      };

      await AsyncStorage.setItem(
        NOTIFICATIONS_KEY,
        JSON.stringify([
          ...notifications,
          notification,
        ])
      );

      knownMessageIdsRef.current.add(
        newMessage.id
      );

      setCaregiver(caregiverAccount);
      setPatient(patientAccount);

      setMessages(previous => [
        ...previous,
        newMessage,
      ]);

      setMessageText('');

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({
          animated: true,
        });
      }, 100);
    } catch (sendError) {
      console.error(
        'CaregiverVoiceScreen send error:',
        sendError
      );

      Alert.alert(
        'Message not sent',
        'Something went wrong while sending the message. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }, [
    caregiver,
    messageText,
    patient,
    resolveAccounts,
    sending,
  ]);

  /* ============================================================
   * QUICK REPLIES
   * ============================================================ */

  const quickReplies = useMemo(
    () => [
      'How are you feeling today?',
      'Did you complete your exercises?',
      'Remember to take your medication.',
      'Let me know if you need anything.',
    ],
    []
  );

  const useQuickReply = useCallback(
    text => {
      if (!patient) {
        return;
      }

      setMessageText(text);
    },
    [patient]
  );

  /* ============================================================
   * MESSAGE COUNT
   * ============================================================ */

  const patientMessageCount = useMemo(
    () =>
      messages.filter(
        message =>
          message.sender === 'patient'
      ).length,
    [messages]
  );

  /* ============================================================
   * DISPLAY VALUES
   * ============================================================ */

  const hasPatient = Boolean(patient);

  const patientDisplayName = hasPatient
    ? patient?.name ||
      patient?.fullName ||
      'Patient'
    : 'No Patient Connected';

  /* ============================================================
   * LOADING
   * ============================================================ */

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor,
          },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#6366F1"
          />

          <Text
            allowFontScaling
            style={[
              styles.loadingText,
              {
                color: secondaryTextColor,
                fontSize: bodySize,
              },
            ]}
          >
            Loading messages...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ============================================================
   * MAIN SCREEN
   * ============================================================ */

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? 90 : 0
        }
      >

        {/* ======================================================
         * HEADER
         * ====================================================== */}

        <View style={styles.header}>
          <View
            style={styles.headerTextContainer}
          >
            <Text
              allowFontScaling
              style={[
                styles.headerTitle,
                {
                  color: '#000000',
                  fontSize: headingSize,
                },
              ]}
            >
              Messages
            </Text>

            <Text
              allowFontScaling
              style={[
                styles.headerSubtitle,
                {
                  color: secondaryTextColor,
                  fontSize: smallSize,
                },
              ]}
            >
              {hasPatient
                ? patientDisplayName
                : 'Caregiver messaging'}
            </Text>
          </View>

          {/* ==================================================
           * TOP-RIGHT CALL BUTTON
           * ================================================== */}

          <TouchableOpacity
            style={[
              styles.headerCallButton,
              {
                backgroundColor: hasPatient
                  ? '#EEF2FF'
                  : '#F3F4F6',
                borderColor,
              },
            ]}
            onPress={callPatient}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              hasPatient
                ? `Call ${patientDisplayName}`
                : 'Call patient'
            }
          >
            <Ionicons
              name="call-outline"
              size={24}
              color={
                hasPatient
                  ? '#6366F1'
                  : '#9CA3AF'
              }
            />
          </TouchableOpacity>
        </View>

        {/* ======================================================
         * PATIENT CARD
         * ====================================================== */}

        <View
          style={[
            styles.patientCard,
            {
              backgroundColor: cardBackground,
              borderColor,
            },
          ]}
        >
          <View style={styles.patientAvatar}>
            <Ionicons
              name={
                hasPatient
                  ? 'person'
                  : 'person-outline'
              }
              size={24}
              color="#6366F1"
            />
          </View>

          <View style={styles.patientInfo}>
            <Text
              allowFontScaling
              style={[
                styles.patientName,
                {
                  color: textColor,
                  fontSize: largeText ? 19 : 17,
                },
              ]}
            >
              {patientDisplayName}
            </Text>

            {hasPatient ? (
              <View
                style={styles.connectedRow}
              >
                <View
                  style={styles.connectedDot}
                />

                <Text
                  allowFontScaling
                  style={[
                    styles.connectedText,
                    {
                      color:
                        secondaryTextColor,
                      fontSize: smallSize,
                    },
                  ]}
                >
                  Connected
                </Text>
              </View>
            ) : (
              <View
                style={styles.notConnectedRow}
              >
                <View
                  style={styles.notConnectedDot}
                />

                <Text
                  allowFontScaling
                  style={[
                    styles.notConnectedText,
                    {
                      color:
                        secondaryTextColor,
                      fontSize: smallSize,
                    },
                  ]}
                >
                  Connect a patient to use
                  messaging
                </Text>
              </View>
            )}
          </View>

          <View
            style={styles.messageCount}
          >
            <Text
              allowFontScaling
              style={[
                styles.messageCountNumber,
                {
                  color: hasPatient
                    ? '#6366F1'
                    : '#9CA3AF',
                  fontSize:
                    largeText ? 23 : 20,
                },
              ]}
            >
              {hasPatient
                ? patientMessageCount
                : '—'}
            </Text>

            <Text
              allowFontScaling
              style={[
                styles.messageCountLabel,
                {
                  color: secondaryTextColor,
                  fontSize: largeText
                    ? 13
                    : 11,
                },
              ]}
            >
              {hasPatient
                ? 'messages'
                : 'locked'}
            </Text>
          </View>
        </View>

        {/* ======================================================
         * NO PATIENT NOTICE
         * ====================================================== */}

        {!hasPatient && (
          <View
            style={[
              styles.noPatientNotice,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#F8F9FF',
                borderColor:
                  highContrast
                    ? '#000000'
                    : '#E0E7FF',
              },
            ]}
          >
            <View
              style={styles.noPatientNoticeIcon}
            >
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color="#6366F1"
              />
            </View>

            <View
              style={
                styles.noPatientNoticeContent
              }
            >
              <Text
                allowFontScaling
                style={[
                  styles.noPatientNoticeTitle,
                  {
                    color: textColor,
                    fontSize: smallSize,
                  },
                ]}
              >
                Messaging is locked
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.noPatientNoticeText,
                  {
                    color:
                      secondaryTextColor,
                    fontSize: smallSize,
                  },
                ]}
              >
                Connect a patient account
                to view conversation history
                and send or receive messages.
              </Text>

              <TouchableOpacity
                style={
                  styles.connectInlineButton
                }
                onPress={() =>
                  navigation?.navigate(
                    'Settings'
                  )
                }
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Connect patient"
              >
                <Ionicons
                  name="link-outline"
                  size={17}
                  color="#FFFFFF"
                />

                <Text
                  allowFontScaling
                  style={[
                    styles.connectInlineButtonText,
                    {
                      fontSize: smallSize,
                    },
                  ]}
                >
                  Connect Patient
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================================================
         * ERROR
         * ====================================================== */}

        {error && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#FEF3C7',
                borderColor:
                  highContrast
                    ? '#000000'
                    : '#FDE68A',
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color="#B45309"
            />

            <Text
              allowFontScaling
              style={[
                styles.errorText,
                {
                  color: highContrast
                    ? '#000000'
                    : '#92400E',
                  fontSize: smallSize,
                },
              ]}
            >
              {error}
            </Text>
          </View>
        )}

        {/* ======================================================
         * MESSAGE AREA
         * ====================================================== */}

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={
            messages.length
              ? styles.messagesContent
              : styles.emptyMessagesContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      '#EEF2FF',
                  },
                ]}
              >
                <Ionicons
                  name={
                    hasPatient
                      ? 'chatbubble-ellipses-outline'
                      : 'lock-closed-outline'
                  }
                  size={42}
                  color="#6366F1"
                />
              </View>

              {hasPatient ? (
                <>
                  <Text
                    allowFontScaling
                    style={[
                      styles.emptyTitle,
                      {
                        color: textColor,
                        fontSize:
                          largeText
                            ? 23
                            : 20,
                      },
                    ]}
                  >
                    No messages yet
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.emptyText,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          bodySize,
                      },
                    ]}
                  >
                    Start a conversation
                    with{' '}
                    {patientDisplayName}.
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    allowFontScaling
                    style={[
                      styles.emptyTitle,
                      {
                        color: textColor,
                        fontSize:
                          largeText
                            ? 23
                            : 20,
                      },
                    ]}
                  >
                    Conversation unavailable
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.emptyText,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          bodySize,
                      },
                    ]}
                  >
                    Patient messages and
                    conversation history
                    will appear here after
                    a patient is connected.
                  </Text>
                </>
              )}
            </View>
          ) : (
            messages.map(message => {
              const isCaregiver =
                message.sender ===
                'caregiver';

              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    isCaregiver
                      ? styles.caregiverMessageRow
                      : styles.patientMessageRow,
                  ]}
                >
                  {!isCaregiver && (
                    <View
                      style={styles.smallAvatar}
                    >
                      <Ionicons
                        name="person-outline"
                        size={15}
                        color="#6366F1"
                      />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isCaregiver
                        ? styles.caregiverBubble
                        : [
                            styles.patientBubble,
                            {
                              backgroundColor:
                                cardBackground,
                              borderColor,
                            },
                          ],
                    ]}
                  >
                    <Text
                      allowFontScaling
                      style={[
                        styles.messageText,
                        {
                          fontSize:
                            bodySize,
                        },
                        isCaregiver
                          ? styles.caregiverMessageText
                          : [
                              styles.patientMessageText,
                              {
                                color:
                                  textColor,
                              },
                            ],
                      ]}
                    >
                      {message.text}
                    </Text>

                    <View
                      style={[
                        styles.messageMeta,
                        isCaregiver
                          ? styles.caregiverMeta
                          : styles.patientMeta,
                      ]}
                    >
                      <Text
                        allowFontScaling
                        style={[
                          styles.timestamp,
                          isCaregiver
                            ? styles.caregiverTimestamp
                            : styles.patientTimestamp,
                          {
                            fontSize:
                              largeText
                                ? 11
                                : 10,
                          },
                        ]}
                      >
                        {formatTime(
                          message.timestamp
                        )}
                      </Text>

                      {isCaregiver && (
                        <Ionicons
                          name={
                            message.read
                              ? 'checkmark-done'
                              : 'checkmark'
                          }
                          size={15}
                          color={
                            message.read
                              ? '#DDE0FF'
                              : '#E5E7EB'
                          }
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ======================================================
         * QUICK REPLIES
         * ====================================================== */}

        <View
          style={[
            styles.quickReplySection,
            {
              backgroundColor,
            },
          ]}
        >
          <Text
            allowFontScaling
            style={[
              styles.quickReplyTitle,
              {
                color:
                  secondaryTextColor,
                fontSize: largeText
                  ? 14
                  : 12,
              },
            ]}
          >
            Quick replies
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.quickRepliesContent
            }
          >
            {quickReplies.map(reply => (
              <TouchableOpacity
                key={reply}
                style={[
                  styles.quickReply,
                  {
                    backgroundColor:
                      cardBackground,
                    borderColor,
                  },
                  !hasPatient &&
                    styles.quickReplyDisabled,
                ]}
                onPress={() =>
                  useQuickReply(reply)
                }
                disabled={!hasPatient}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                {!hasPatient && (
                  <Ionicons
                    name="lock-closed-outline"
                    size={12}
                    color="#9CA3AF"
                    style={
                      styles.quickReplyLock
                    }
                  />
                )}

                <Text
                  allowFontScaling
                  style={[
                    styles.quickReplyText,
                    {
                      color: hasPatient
                        ? '#4B5563'
                        : '#9CA3AF',
                      fontSize: largeText
                        ? 14
                        : 12,
                    },
                  ]}
                >
                  {reply}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ======================================================
         * MESSAGE INPUT
         * ====================================================== */}

        <View
          style={[
            styles.inputSection,
            {
              backgroundColor:
                cardBackground,
              borderTopColor: borderColor,
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor:
                  inputBackground,
                borderColor,
              },
              !hasPatient &&
                styles.inputWrapperDisabled,
            ]}
          >
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder={
                hasPatient
                  ? 'Type a message...'
                  : 'Connect a patient to message...'
              }
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              style={[
                styles.input,
                {
                  color: textColor,
                  fontSize: bodySize,
                },
                !hasPatient &&
                  styles.inputDisabled,
              ]}
              editable={
                !sending &&
                hasPatient
              }
              returnKeyType="default"
              allowFontScaling
            />

            <Text
              allowFontScaling={false}
              style={styles.characterCount}
            >
              {messageText.length}/
              {MAX_MESSAGE_LENGTH}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() ||
                sending ||
                !hasPatient) &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendReply}
            disabled={
              !messageText.trim() ||
              sending ||
              !hasPatient
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Ionicons
                name="send"
                size={21}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>
        </View>

        {/* ======================================================
         * SAFETY NOTE
         * ====================================================== */}

        <View
          style={[
            styles.safetyNote,
            {
              backgroundColor:
                cardBackground,
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={17}
            color="#6B7280"
          />

          <Text
            allowFontScaling
            style={[
              styles.safetyText,
              {
                color:
                  secondaryTextColor,
                fontSize: largeText
                  ? 12
                  : 10,
              },
            ]}
          >
            Messages are for caregiver
            support and communication.
            For urgent medical concerns,
            use appropriate emergency
            services.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ============================================================
 * STYLES
 * ============================================================ */

const styles = StyleSheet.create({
  /* ==========================================================
   * SCREEN
   * ========================================================== */

  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7FB',
  },

  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  loadingText: {
    marginTop: 14,
    fontWeight: '600',
  },

  /* ==========================================================
   * HEADER
   * ========================================================== */

  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 14,
  },

  /*
   * IMPORTANT:
   * Non-Home screen titles are BLACK.
   */

  headerTitle: {
    color: '#000000',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    color: '#6B7280',
    marginTop: 5,
    lineHeight: 22,
  },

  /*
   * TOP-RIGHT CALL BUTTON
   */

  headerCallButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  /* ==========================================================
   * PATIENT CARD
   * ========================================================== */

  patientCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 17,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  patientInfo: {
    flex: 1,
    marginLeft: 13,
  },

  patientName: {
    fontWeight: '800',
  },

  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22A06B',
    marginRight: 7,
  },

  connectedText: {
    fontWeight: '500',
  },

  notConnectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  notConnectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
    marginRight: 7,
  },

  notConnectedText: {
    flexShrink: 1,
    fontWeight: '500',
  },

  messageCount: {
    alignItems: 'center',
    paddingLeft: 10,
  },

  messageCountNumber: {
    fontWeight: '800',
  },

  messageCountLabel: {
    marginTop: 1,
    fontWeight: '500',
  },

  /* ==========================================================
   * NO PATIENT NOTICE
   * ========================================================== */

  noPatientNotice: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  noPatientNoticeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noPatientNoticeContent: {
    flex: 1,
    marginLeft: 11,
  },

  noPatientNoticeTitle: {
    fontWeight: '800',
  },

  noPatientNoticeText: {
    marginTop: 4,
    lineHeight: 20,
  },

  connectInlineButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
  },

  connectInlineButtonText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* ==========================================================
   * ERROR
   * ========================================================== */

  errorCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  errorText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 19,
  },

  /* ==========================================================
   * MESSAGE AREA
   * ========================================================== */

  messagesContainer: {
    flex: 1,
  },

  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },

  emptyMessagesContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },

  emptyText: {
    textAlign: 'center',
    lineHeight: 23,
  },

  /* ==========================================================
   * MESSAGE BUBBLES
   * ========================================================== */

  messageRow: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 10,
  },

  caregiverMessageRow: {
    justifyContent: 'flex-end',
  },

  patientMessageRow: {
    justifyContent: 'flex-start',
  },

  smallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    marginTop: 2,
  },

  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 7,
    borderRadius: 18,
  },

  caregiverBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 5,
  },

  patientBubble: {
    borderBottomLeftRadius: 5,
  },

  messageText: {
    lineHeight: 22,
  },

  caregiverMessageText: {
    color: '#FFFFFF',
  },

  patientMessageText: {
    color: '#111827',
  },

  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },

  caregiverMeta: {
    alignSelf: 'flex-end',
  },

  patientMeta: {
    alignSelf: 'flex-end',
  },

  timestamp: {
    marginRight: 2,
  },

  caregiverTimestamp: {
    color: '#E5E7EB',
  },

  patientTimestamp: {
    color: '#9CA3AF',
  },

  /* ==========================================================
   * QUICK REPLIES
   * ========================================================== */

  quickReplySection: {
    paddingTop: 9,
    paddingBottom: 8,
  },

  quickReplyTitle: {
    marginLeft: 20,
    marginBottom: 8,
    fontWeight: '700',
  },

  quickRepliesContent: {
    paddingHorizontal: 16,
  },

  quickReply: {
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  quickReplyDisabled: {
    backgroundColor: '#F3F4F6',
  },

  quickReplyLock: {
    marginRight: 5,
  },

  quickReplyText: {
    fontWeight: '600',
  },

  /* ==========================================================
   * INPUT
   * ========================================================== */

  inputSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 8,
    borderTopWidth: 1,
  },

  inputWrapper: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 18,
    marginRight: 9,
    paddingLeft: 15,
    paddingRight: 45,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },

  inputWrapperDisabled: {
    borderWidth: 1,
  },

  input: {
    minHeight: 44,
    maxHeight: 105,
    paddingTop: 10,
    paddingBottom: 10,
  },

  inputDisabled: {
    color: '#9CA3AF',
  },

  characterCount: {
    position: 'absolute',
    right: 10,
    bottom: 7,
    fontSize: 9,
    color: '#9CA3AF',
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: '#C7C9D9',
  },

  /* ==========================================================
   * SAFETY NOTE
   * ========================================================== */

  safetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 5,
    paddingBottom: 9,
  },

  safetyText: {
    flex: 1,
    marginLeft: 6,
    lineHeight: 15,
  },
});