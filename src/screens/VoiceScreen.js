import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useAccessibility } from '../context/AccessibilityContext';

// ============================================================
// STORAGE
// ============================================================

const ACCOUNTS_KEY = 'strokebuddy_accounts';
const MESSAGES_KEY = 'strokebuddy_messages';
const NOTIFICATION_SETTINGS_PREFIX =
  'strokebuddy_notification_settings_';
const MESSAGE_NOTIFICATION_TRACKING_PREFIX =
  'strokebuddy_message_notification_tracking_';

// ============================================================
// DEFAULT NOTIFICATION SETTINGS
// ============================================================

const DEFAULT_NOTIFICATION_SETTINGS = {
  medReminders: true,
  caregiverMessages: true,
  exerciseReminders: true,
  recoveryMilestones: true,
};

// ============================================================
// NOTIFICATION HANDLER
// ============================================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============================================================
// NOTIFICATION HELPERS
// ============================================================

const getNotificationSettingsKey = (accountId) =>
  `${NOTIFICATION_SETTINGS_PREFIX}${accountId}`;

const getMessageNotificationTrackingKey = (accountId) =>
  `${MESSAGE_NOTIFICATION_TRACKING_PREFIX}${accountId}`;

const getPatientNotificationSettings = async (accountId) => {
  try {
    if (!accountId) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    const saved = await AsyncStorage.getItem(
      getNotificationSettingsKey(accountId)
    );

    if (!saved) {
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.log(
      'Notification settings load error:',
      error
    );

    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

const hasNotificationPermission = async () => {
  try {
    const permissions =
      await Notifications.getPermissionsAsync();

    return (
      permissions.granted ||
      permissions.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.log(
      'Notification permission error:',
      error
    );

    return false;
  }
};

const sendCaregiverMessageNotification = async ({
  accountId,
  caregiverName,
  message,
  messageId,
}) => {
  try {
    if (!accountId || !messageId) {
      return;
    }

    const settings =
      await getPatientNotificationSettings(accountId);

    if (!settings.caregiverMessages) {
      return;
    }

    const permissionGranted =
      await hasNotificationPermission();

    if (!permissionGranted) {
      return;
    }

    const trackingKey =
      getMessageNotificationTrackingKey(accountId);

    const savedTracking =
      await AsyncStorage.getItem(trackingKey);

    let trackedIds = [];

    if (savedTracking) {
      try {
        trackedIds = JSON.parse(savedTracking);

        if (!Array.isArray(trackedIds)) {
          trackedIds = [];
        }
      } catch {
        trackedIds = [];
      }
    }

    // Do not notify twice for the same message.
    if (trackedIds.includes(messageId)) {
      return;
    }

    trackedIds.push(messageId);

    // Keep the tracking list small.
    if (trackedIds.length > 100) {
      trackedIds = trackedIds.slice(-100);
    }

    await AsyncStorage.setItem(
      trackingKey,
      JSON.stringify(trackedIds)
    );

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Message from ${
          caregiverName || 'Your caregiver'
        }`,
        body:
          String(message || '').length > 120
            ? `${String(message).slice(0, 117)}...`
            : String(message || ''),
        sound: 'default',
        data: {
          type: 'caregiver_message',
          category: 'caregiverMessages',
          patientId: accountId,
          messageId,
          caregiverName:
            caregiverName || 'Your caregiver',
        },
      },
      trigger: {
        seconds: 1,
      },
    });
  } catch (error) {
    console.log(
      'Caregiver message notification error:',
      error
    );
  }
};

// ============================================================
// PATIENT VOICE + MESSAGING SCREEN
// ============================================================

export default function VoiceScreen({
  navigation,
  route,
}) {
  const {
    name,
    accountId,
  } = route?.params || {};

  // ==========================================================
  // ACCESSIBILITY
  // ==========================================================

  let accessibilityValues = {};

  try {
    accessibilityValues =
      useAccessibility() || {};
  } catch (error) {
    console.log(
      'Accessibility context error:',
      error
    );
  }

  const {
    largeText = false,
    highContrast = false,
  } = accessibilityValues;

  // ==========================================================
  // STATE
  // ==========================================================

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [caregiver, setCaregiver] = useState(null);
  const [patient, setPatient] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // ==========================================================
  // REFS
  // ==========================================================

  const scrollViewRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);
  const speechBaseMessageRef = useRef('');

  // ==========================================================
  // COLORS
  // ==========================================================

  const backgroundColor =
    highContrast ? '#FFFFFF' : '#FAF8F5';

  const textColor =
    highContrast ? '#000000' : '#000000';

  const secondaryTextColor =
    highContrast ? '#333333' : '#777777';

  const iconColor =
    highContrast ? '#000000' : '#4B5563';

  const cardBackground =
    highContrast ? '#FFFFFF' : '#FFFFFF';

  const borderColor =
    highContrast ? '#111827' : '#E5E7EB';

  const primaryColor =
    highContrast ? '#000000' : '#6366F1';

  // ==========================================================
  // SPEECH RECOGNITION EVENTS
  // ==========================================================

  useSpeechRecognitionEvent('start', () => {
    if (!mountedRef.current) {
      return;
    }

    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!mountedRef.current) {
      return;
    }

    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!mountedRef.current) {
      return;
    }

    const transcript =
      event?.results?.[0]?.transcript?.trim() || '';

    if (!transcript) {
      return;
    }

    const base =
      speechBaseMessageRef.current?.trim() || '';

    const combined = base
      ? `${base} ${transcript}`
      : transcript;

    setMessage(
      combined.slice(0, 300)
    );
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!mountedRef.current) {
      return;
    }

    setIsListening(false);

    const errorCode =
      event?.error ||
      event?.message ||
      'unknown';

    if (
      errorCode === 'aborted' ||
      errorCode === 'no-speech'
    ) {
      return;
    }

    console.log(
      'Speech recognition error:',
      event
    );

    Alert.alert(
      'Speech Recognition',
      'Speech recognition could not start. Please check that microphone and speech recognition access are enabled for StrokeBuddy.'
    );
  });

  // ==========================================================
  // DISPLAY NAME
  // ==========================================================

  const displayName =
    patient?.name ||
    name ||
    'there';

  // ==========================================================
  // FIND CONNECTED CAREGIVER
  // ==========================================================

  const findConnectedCaregiver = (
    accounts,
    currentPatient
  ) => {
    if (!currentPatient) {
      return null;
    }

    let connectedCaregiver = null;

    // --------------------------------------------------------
    // Patient -> caregiver
    // --------------------------------------------------------

    const patientCaregiverId =
      currentPatient.connectedCaregiverId ||
      currentPatient.caregiverId ||
      currentPatient.connectedCaregiverAccountId;

    if (patientCaregiverId) {
      connectedCaregiver =
        accounts.find(
          (account) =>
            account?.id === patientCaregiverId &&
            account?.role === 'caregiver'
        ) || null;
    }

    // --------------------------------------------------------
    // Caregiver -> patient fallback
    // --------------------------------------------------------

    if (!connectedCaregiver) {
      connectedCaregiver =
        accounts.find(
          (account) =>
            account?.role === 'caregiver' &&
            (
              account?.connectedPatientId ===
                currentPatient.id ||
              account?.patientId ===
                currentPatient.id ||
              account?.connectedPatientAccountId ===
                currentPatient.id
            )
        ) || null;
    }

    return connectedCaregiver;
  };

  // ==========================================================
  // SAFELY UPDATE PATIENT STATE
  // ==========================================================

  const updatePatientIfChanged = (
    nextPatient
  ) => {
    setPatient((current) => {
      const currentId =
        current?.id || null;

      const nextId =
        nextPatient?.id || null;

      if (currentId === nextId) {
        return current;
      }

      return nextPatient || null;
    });
  };

  // ==========================================================
  // SAFELY UPDATE CAREGIVER STATE
  // ==========================================================

  const updateCaregiverIfChanged = (
    nextCaregiver
  ) => {
    setCaregiver((current) => {
      const currentId =
        current?.id || null;

      const nextId =
        nextCaregiver?.id || null;

      if (currentId === nextId) {
        return current;
      }

      return nextCaregiver || null;
    });
  };

  // ==========================================================
  // LOAD MESSAGING DATA
  //
  // IMPORTANT:
  // This function intentionally does NOT use useCallback.
  //
  // None of the lifecycle effects below depend on this
  // function. This prevents the callback identity from
  // participating in an effect dependency loop.
  // ==========================================================

  const loadMessagingData = async (
    shouldShowLoading = false,
    shouldMarkRead = true
  ) => {
    if (!accountId) {
      if (mountedRef.current) {
        setPatient(null);
        setCaregiver(null);
        setMessages([]);
        setUnreadCount(0);
        setLoading(false);
      }

      return;
    }

    try {
      if (
        shouldShowLoading &&
        mountedRef.current
      ) {
        setLoading(true);
      }

      // ------------------------------------------------------
      // LOAD ACCOUNTS
      // ------------------------------------------------------

      const savedAccounts =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      let accounts = [];

      if (savedAccounts) {
        try {
          const parsed =
            JSON.parse(savedAccounts);

          if (Array.isArray(parsed)) {
            accounts = parsed;
          }
        } catch (error) {
          console.log(
            'Accounts JSON error:',
            error
          );
        }
      }

      // ------------------------------------------------------
      // FIND CURRENT PATIENT
      // ------------------------------------------------------

      const currentPatient =
        accounts.find(
          (account) =>
            account?.id === accountId &&
            account?.role === 'patient'
        ) ||
        accounts.find(
          (account) =>
            account?.id === accountId
        ) ||
        null;

      // ------------------------------------------------------
      // ACCOUNT NOT FOUND
      // ------------------------------------------------------

      if (!currentPatient) {
        if (mountedRef.current) {
          updatePatientIfChanged(null);
          updateCaregiverIfChanged(null);
          setMessages([]);
          setUnreadCount(0);
        }

        return;
      }

      // ------------------------------------------------------
      // FIND CONNECTED CAREGIVER
      // ------------------------------------------------------

      const connectedCaregiver =
        findConnectedCaregiver(
          accounts,
          currentPatient
        );

      if (mountedRef.current) {
        updatePatientIfChanged(
          currentPatient
        );

        /*
         * IMPORTANT:
         * The caregiver object comes directly from
         * strokebuddy_accounts, including profilePicture.
         *
         * This means the Messages screen automatically
         * receives the same saved caregiver PFP used by
         * CaregiverSettingsScreen.
         */
        updateCaregiverIfChanged(
          connectedCaregiver
        );
      }

      // ------------------------------------------------------
      // LOAD SHARED MESSAGES
      // ------------------------------------------------------

      const savedMessages =
        await AsyncStorage.getItem(
          MESSAGES_KEY
        );

      let allMessages = [];

      if (savedMessages) {
        try {
          const parsed =
            JSON.parse(savedMessages);

          if (Array.isArray(parsed)) {
            allMessages = parsed;
          }
        } catch (error) {
          console.log(
            'Messages JSON error:',
            error
          );
        }
      }

      // ------------------------------------------------------
      // ONLY SHOW THIS PATIENT'S MESSAGES
      //
      // Also verify caregiver connection when a caregiver
      // exists so unrelated conversations do not appear.
      // ------------------------------------------------------

      const connectedCaregiverId =
        connectedCaregiver?.id || null;

      const currentPatientId =
        currentPatient.id;

      const patientMessages =
        allMessages
          .filter((item) => {
            if (
              item?.patientId !==
              currentPatientId
            ) {
              return false;
            }

            // If a connected caregiver exists,
            // only show that conversation.
            if (connectedCaregiverId) {
              return (
                item?.caregiverId ===
                connectedCaregiverId
              );
            }

            // If no caregiver is connected,
            // allow old patient messages to remain
            // visible for compatibility.
            return true;
          })
          .sort(
            (a, b) =>
              new Date(
                a?.timestamp || 0
              ) -
              new Date(
                b?.timestamp || 0
              )
          );

      // ------------------------------------------------------
      // CALCULATE UNREAD CAREGIVER MESSAGES
      // ------------------------------------------------------

      const unreadMessages =
        patientMessages.filter(
          (item) =>
            item?.sender === 'caregiver' &&
            item?.readByPatient !== true &&
            item?.read !== true
        );

      const nextUnreadCount =
        unreadMessages.length;

      // ------------------------------------------------------
      // NOTIFY ABOUT NEW CAREGIVER MESSAGE
      // ------------------------------------------------------

      if (
        connectedCaregiver &&
        unreadMessages.length > 0
      ) {
        const newestUnread =
          unreadMessages[
            unreadMessages.length - 1
          ];

        await sendCaregiverMessageNotification({
          accountId: currentPatientId,
          caregiverName:
            connectedCaregiver.name ||
            'Your caregiver',
          message:
            newestUnread?.text || '',
          messageId:
            newestUnread?.id ||
            newestUnread?.timestamp ||
            `${newestUnread?.timestamp}_${newestUnread?.text}`,
        });
      }

      // ------------------------------------------------------
      // MARK CAREGIVER MESSAGES AS READ
      // ------------------------------------------------------

      if (
        shouldMarkRead &&
        connectedCaregiver &&
        unreadMessages.length > 0
      ) {
        const unreadIds = new Set(
          unreadMessages.map(
            (item) => item?.id
          )
        );

        let changed = false;

        const updatedAllMessages =
          allMessages.map((item) => {
            if (
              item?.patientId ===
                currentPatientId &&
              item?.caregiverId ===
                connectedCaregiverId &&
              item?.sender ===
                'caregiver' &&
              (
                item?.readByPatient !==
                  true ||
                item?.read !== true
              ) &&
              unreadIds.has(item?.id)
            ) {
              changed = true;

              return {
                ...item,
                readByPatient: true,
                read: true,
                readAt:
                  new Date().toISOString(),
              };
            }

            return item;
          });

        if (changed) {
          await AsyncStorage.setItem(
            MESSAGES_KEY,
            JSON.stringify(
              updatedAllMessages
            )
          );

          // Update the local copy too.
          for (
            let i = 0;
            i < patientMessages.length;
            i += 1
          ) {
            const item =
              patientMessages[i];

            if (
              item?.sender ===
                'caregiver' &&
              unreadIds.has(item?.id)
            ) {
              patientMessages[i] = {
                ...item,
                readByPatient: true,
                read: true,
                readAt:
                  new Date().toISOString(),
              };
            }
          }
        }
      }

      // ------------------------------------------------------
      // UPDATE MESSAGE STATE ONLY WHEN IT CHANGED
      // ------------------------------------------------------

      if (mountedRef.current) {
        setMessages((current) => {
          const currentSignature =
            current
              .map(
                (item) =>
                  `${item?.id || ''}|${
                    item?.readByPatient
                      ? 1
                      : 0
                  }|${
                    item?.read
                      ? 1
                      : 0
                  }`
              )
              .join('||');

          const nextSignature =
            patientMessages
              .map(
                (item) =>
                  `${item?.id || ''}|${
                    item?.readByPatient
                      ? 1
                      : 0
                  }|${
                    item?.read
                      ? 1
                      : 0
                  }`
              )
              .join('||');

          if (
            currentSignature ===
            nextSignature
          ) {
            return current;
          }

          return patientMessages;
        });

        const actualUnreadCount =
          shouldMarkRead
            ? 0
            : nextUnreadCount;

        setUnreadCount(
          (current) =>
            current ===
            actualUnreadCount
              ? current
              : actualUnreadCount
        );
      }
    } catch (error) {
      console.log(
        'Voice/messaging load error:',
        error
      );
    } finally {
      if (
        shouldShowLoading &&
        mountedRef.current
      ) {
        setLoading(false);
      }

      if (
        mountedRef.current &&
        refreshingRef.current
      ) {
        setRefreshing(false);
        refreshingRef.current = false;
      }
    }
  };

  // ==========================================================
  // INITIAL LOAD
  //
  // EMPTY DEPENDENCY ARRAY IS INTENTIONAL.
  // ==========================================================

  useEffect(() => {
    mountedRef.current = true;

    loadMessagingData(true, true);

    return () => {
      mountedRef.current = false;

      try {
        ExpoSpeechRecognitionModule.abort();
      } catch (error) {
        console.log(
          'Speech cleanup error:',
          error
        );
      }
    };
  }, []);

  // ==========================================================
  // SCREEN FOCUS REFRESH
  // ==========================================================

  useEffect(() => {
    if (
      !navigation ||
      !navigation.addListener
    ) {
      return undefined;
    }

    const unsubscribe =
      navigation.addListener(
        'focus',
        () => {
          if (mountedRef.current) {
            loadMessagingData(
              false,
              true
            );
          }
        }
      );

    return () => {
      if (
        typeof unsubscribe ===
        'function'
      ) {
        unsubscribe();
      }
    };
  }, []);

  // ==========================================================
  // PERIODIC REFRESH
  // ==========================================================

  useEffect(() => {
    const refreshMessages =
      async () => {
        if (!mountedRef.current) {
          return;
        }

        try {
          await loadMessagingData(
            false,
            true
          );
        } catch (error) {
          console.log(
            'Message polling error:',
            error
          );
        }
      };

    const interval = setInterval(
      refreshMessages,
      2000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ==========================================================
  // AUTO SCROLL WHEN NEW MESSAGE ARRIVES
  // ==========================================================

  useEffect(() => {
    if (
      messages.length >
      lastMessageCountRef.current
    ) {
      const timeout = setTimeout(() => {
        if (mountedRef.current) {
          scrollViewRef.current?.scrollToEnd(
            {
              animated: true,
            }
          );
        }
      }, 100);

      lastMessageCountRef.current =
        messages.length;

      return () => {
        clearTimeout(timeout);
      };
    }

    lastMessageCountRef.current =
      messages.length;

    return undefined;
  }, [messages.length]);

  // ==========================================================
  // MANUAL REFRESH
  // ==========================================================

  const handleRefresh = async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    setRefreshing(true);

    try {
      await loadMessagingData(
        false,
        true
      );
    } catch (error) {
      console.log(
        'Manual refresh error:',
        error
      );
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }

      refreshingRef.current = false;
    }
  };

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const sendMessage = async (
    text = message,
    type = 'text'
  ) => {
    const trimmedMessage =
      String(text || '').trim();

    if (!trimmedMessage) {
      return;
    }

    if (trimmedMessage.length > 300) {
      Alert.alert(
        'Message Too Long',
        'Please keep your message under 300 characters.'
      );

      return;
    }

    if (!accountId) {
      Alert.alert(
        'Account Error',
        'We could not identify your patient account. Please sign in again.'
      );

      return;
    }

    if (!caregiver) {
      Alert.alert(
        'No Caregiver Connected',
        'Connect a caregiver in Settings before sending messages.'
      );

      return;
    }

    if (sending) {
      return;
    }

    setSending(true);

    try {
      // ------------------------------------------------------
      // LOAD LATEST ACCOUNT DATA BEFORE SENDING
      // ------------------------------------------------------

      const savedAccounts =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      const accounts = savedAccounts
        ? JSON.parse(savedAccounts)
        : [];

      const currentPatient =
        accounts.find(
          (account) =>
            account?.id === accountId &&
            account?.role === 'patient'
        ) ||
        accounts.find(
          (account) =>
            account?.id === accountId
        );

      if (!currentPatient) {
        Alert.alert(
          'Account Error',
          'Your patient account could not be found.'
        );

        return;
      }

      const linkedCaregiver =
        findConnectedCaregiver(
          accounts,
          currentPatient
        );

      if (!linkedCaregiver) {
        Alert.alert(
          'No Caregiver Connected',
          'Connect a caregiver in Settings before sending messages.'
        );

        updateCaregiverIfChanged(null);

        return;
      }

      // ------------------------------------------------------
      // LOAD EXISTING MESSAGES
      // ------------------------------------------------------

      const savedMessages =
        await AsyncStorage.getItem(
          MESSAGES_KEY
        );

      let allMessages = [];

      if (savedMessages) {
        try {
          const parsed =
            JSON.parse(savedMessages);

          if (Array.isArray(parsed)) {
            allMessages = parsed;
          }
        } catch {
          allMessages = [];
        }
      }

      // ------------------------------------------------------
      // UNIQUE MESSAGE ID
      // ------------------------------------------------------

      const newMessage = {
        id: `${accountId}_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`,

        patientId:
          currentPatient.id ||
          accountId,

        patientName:
          currentPatient.name ||
          name ||
          'Patient',

        caregiverId:
          linkedCaregiver.id,

        caregiverName:
          linkedCaregiver.name ||
          'Caregiver',

        sender: 'patient',

        senderId: accountId,

        text: trimmedMessage,

        type: type || 'text',

        timestamp:
          new Date().toISOString(),

        readByPatient: true,

        readByCaregiver: false,

        read: true,
      };

      // ------------------------------------------------------
      // SAVE
      // ------------------------------------------------------

      const updatedMessages = [
        ...allMessages,
        newMessage,
      ];

      await AsyncStorage.setItem(
        MESSAGES_KEY,
        JSON.stringify(
          updatedMessages
        )
      );

      // ------------------------------------------------------
      // UPDATE UI IMMEDIATELY
      // ------------------------------------------------------

      if (mountedRef.current) {
        setMessages((current) => [
          ...current,
          newMessage,
        ]);

        setMessage('');

        setSending(false);

        updateCaregiverIfChanged(
          linkedCaregiver
        );
      }

      // ------------------------------------------------------
      // SCROLL TO NEW MESSAGE
      // ------------------------------------------------------

      setTimeout(() => {
        if (mountedRef.current) {
          scrollViewRef.current?.scrollToEnd(
            {
              animated: true,
            }
          );
        }
      }, 100);
    } catch (error) {
      console.log(
        'Send message error:',
        error
      );

      if (mountedRef.current) {
        Alert.alert(
          'Message Error',
          'We could not send your message. Please try again.'
        );
      }
    } finally {
      if (mountedRef.current) {
        setSending(false);
      }
    }
  };

  // ==========================================================
  // QUICK NEEDS
  // ==========================================================

  const sendQuickPhrase = (
    phrase
  ) => {
    if (!caregiver) {
      return;
    }

    sendMessage(
      phrase,
      'quick'
    );
  };

  // ==========================================================
  // VOICE INPUT
  // ==========================================================

  const handleVoicePress = async () => {
    if (!caregiver) {
      return;
    }

    try {
      // ------------------------------------------------------
      // STOP CURRENT LISTENING SESSION
      // ------------------------------------------------------

      if (isListening) {
        try {
          await ExpoSpeechRecognitionModule.stop();
        } catch (error) {
          console.log(
            'Speech stop error:',
            error
          );
        }

        setIsListening(false);

        return;
      }

      // ------------------------------------------------------
      // SAVE EXISTING MESSAGE TEXT
      // ------------------------------------------------------

      speechBaseMessageRef.current =
        message.trim();

      // ------------------------------------------------------
      // REQUEST MICROPHONE + SPEECH PERMISSION
      // ------------------------------------------------------

      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission?.granted) {
        Alert.alert(
          'Speech Access Needed',
          'Please allow microphone and speech recognition access in Settings so StrokeBuddy can turn your speech into text.'
        );

        return;
      }

      // ------------------------------------------------------
      // START REAL SPEECH RECOGNITION
      // ------------------------------------------------------

      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
      });
    } catch (error) {
      console.log(
        'Speech recognition start error:',
        error
      );

      if (mountedRef.current) {
        setIsListening(false);

        Alert.alert(
          'Speech Recognition',
          'Speech recognition could not start. Please check that microphone and speech recognition access are enabled for StrokeBuddy.'
        );
      }
    }
  };

  // ==========================================================
  // CLEAR MESSAGE
  // ==========================================================

  const clearMessage = () => {
    setMessage('');
    speechBaseMessageRef.current = '';
  };

  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  const formatTime = (
    timestamp
  ) => {
    if (!timestamp) {
      return '';
    }

    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return date.toLocaleTimeString(
      [],
      {
        hour: 'numeric',
        minute: '2-digit',
      }
    );
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (
    timestamp
  ) => {
    if (!timestamp) {
      return '';
    }

    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    const today = new Date();

    if (
      date.toDateString() ===
      today.toDateString()
    ) {
      return 'Today';
    }

    return date.toLocaleDateString(
      [],
      {
        month: 'short',
        day: 'numeric',
      }
    );
  };

  // ==========================================================
  // MESSAGE STATUS
  // ==========================================================

  const getMessageStatus = (
    item
  ) => {
    if (
      item?.sender !==
      'patient'
    ) {
      return '';
    }

    if (
      item?.readByCaregiver ===
        true ||
      (item?.read === true &&
        item?.readByCaregiver ===
          true)
    ) {
      return 'Seen';
    }

    return 'Sent';
  };

  // ==========================================================
  // RENDER MESSAGE
  // ==========================================================

  const renderMessage = (
    item,
    index
  ) => {
    const isPatient =
      item?.sender ===
      'patient';

    const previous =
      messages[index - 1];

    const previousDate =
      formatDate(
        previous?.timestamp
      );

    const currentDate =
      formatDate(
        item?.timestamp
      );

    const showDate =
      currentDate &&
      currentDate !==
        previousDate;

    return (
      <React.Fragment
        key={
          item?.id ||
          `${item?.timestamp}_${index}`
        }
      >
        {showDate && (
          <View
            style={[
              styles.dateDivider,
              largeText &&
                styles.dateDividerLarge,
            ]}
          >
            <View
              style={[
                styles.dateLine,
                highContrast &&
                  styles.highContrastLine,
              ]}
            />

            <Text
              style={[
                styles.dateText,
                largeText &&
                  styles.dateTextLarge,
                {
                  color:
                    secondaryTextColor,
                },
              ]}
              allowFontScaling
            >
              {currentDate}
            </Text>

            <View
              style={[
                styles.dateLine,
                highContrast &&
                  styles.highContrastLine,
              ]}
            />
          </View>
        )}

        <View
          style={[
            styles.messageRow,
            isPatient
              ? styles.patientRow
              : styles.caregiverRow,
          ]}
        >
          {!isPatient && (
            /*
             * CAREGIVER MESSAGE AVATAR
             *
             * Uses the caregiver.profilePicture saved by
             * CaregiverSettingsScreen.
             *
             * If no PFP exists, the exact same default
             * person icon is shown as the connection card.
             */
            <View
              style={[
                styles.caregiverAvatar,
                largeText &&
                  styles.caregiverAvatarLarge,
                highContrast &&
                  styles.highContrastAvatar,
              ]}
            >
              {caregiver?.profilePicture ? (
                <Image
                  source={{
                    uri: caregiver.profilePicture,
                  }}
                  style={[
                    styles.caregiverAvatarImage,
                    largeText &&
                      styles.caregiverAvatarImageLarge,
                  ]}
                />
              ) : (
                <Ionicons
                  name="person"
                  size={
                    largeText
                      ? 18
                      : 14
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#6366F1'
                  }
                />
              )}
            </View>
          )}

          <View
            style={[
              styles.messageBubble,
              largeText &&
                styles.messageBubbleLarge,
              isPatient
                ? styles.patientBubble
                : styles.caregiverBubble,
              highContrast &&
                !isPatient &&
                styles.highContrastCaregiverBubble,
              highContrast &&
                isPatient &&
                styles.highContrastPatientBubble,
            ]}
          >
            <Text
              style={[
                styles.messageBubbleText,
                largeText &&
                  styles.messageBubbleTextLarge,
                isPatient
                  ? styles.patientText
                  : styles.caregiverText,
                highContrast &&
                  isPatient &&
                  styles.highContrastPatientText,
                highContrast &&
                  !isPatient &&
                  styles.highContrastCaregiverText,
              ]}
              allowFontScaling
            >
              {item?.text}
            </Text>

            <View
              style={[
                styles.messageMeta,
                largeText &&
                  styles.messageMetaLarge,
              ]}
            >
              <Text
                style={[
                  styles.messageTime,
                  largeText &&
                    styles.messageTimeLarge,
                  isPatient
                    ? styles.patientTime
                    : styles.caregiverTime,
                ]}
                allowFontScaling
              >
                {isPatient
                  ? 'You'
                  : caregiver?.name ||
                    item?.caregiverName ||
                    'Caregiver'}
                {' • '}
                {formatTime(
                  item?.timestamp
                )}
              </Text>

              {isPatient && (
                <Text
                  style={[
                    styles.messageStatus,
                    largeText &&
                      styles.messageStatusLarge,
                  ]}
                  allowFontScaling
                >
                  {getMessageStatus(
                    item
                  )}
                </Text>
              )}
            </View>
          </View>
        </View>
      </React.Fragment>
    );
  };

  // ==========================================================
  // QUICK BUTTON COMPONENT
  // ==========================================================

  const QuickNeedButton = ({
    icon,
    label,
    phrase,
  }) => (
    <TouchableOpacity
      style={[
        styles.quickButton,
        largeText &&
          styles.quickButtonLarge,
        !caregiver &&
          styles.quickButtonDisabled,
        highContrast &&
          styles.highContrastQuickButton,
      ]}
      onPress={() =>
        sendQuickPhrase(
          phrase
        )
      }
      disabled={
        !caregiver ||
        sending
      }
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Send ${phrase}`}
    >
      <Ionicons
        name={icon}
        size={
          largeText
            ? 21
            : 17
        }
        color={
          caregiver
            ? highContrast
              ? '#000000'
              : '#5B6CFF'
            : '#AEB2C5'
        }
      />

      <Text
        style={[
          styles.quickButtonText,
          largeText &&
            styles.quickButtonTextLarge,
          !caregiver &&
            styles.quickButtonTextDisabled,
          highContrast &&
            styles.highContrastQuickText,
        ]}
        allowFontScaling
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ==========================================================
  // UI
  // ==========================================================

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
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        keyboardVerticalOffset={
          Platform.OS === 'ios'
            ? 8
            : 0
        }
      >
        <View
          style={[
            styles.container,
            largeText &&
              styles.containerLarge,
          ]}
        >
          {/* ==================================================
              HEADER
          ================================================== */}

          <View
            style={[
              styles.headerRow,
              largeText &&
                styles.headerRowLarge,
            ]}
          >
            <View
              style={
                styles.headerTextContainer
              }
            >
              <Text
                style={[
                  styles.header,
                  largeText &&
                    styles.headerLarge,
                  {
                    color:
                      textColor,
                  },
                ]}
                allowFontScaling
              >
                Messages
              </Text>

              <Text
                style={[
                  styles.subtitle,
                  largeText &&
                    styles.subtitleLarge,
                  {
                    color:
                      secondaryTextColor,
                  },
                ]}
                allowFontScaling
              >
                Talk with your caregiver
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.refreshButton,
                largeText &&
                  styles.refreshButtonLarge,
                highContrast &&
                  styles.highContrastRefreshButton,
              ]}
              onPress={
                handleRefresh
              }
              disabled={
                refreshing ||
                loading
              }
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Refresh messages"
            >
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color={
                    highContrast
                      ? '#000000'
                      : '#6366F1'
                  }
                />
              ) : (
                <Ionicons
                  name="refresh-outline"
                  size={
                    largeText
                      ? 25
                      : 21
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#6366F1'
                  }
                />
              )}
            </TouchableOpacity>
          </View>

          {/* ==================================================
              SIMPLE WELCOME
          ================================================== */}

          <View
            style={[
              styles.welcomeCard,
              largeText &&
                styles.welcomeCardLarge,
              highContrast &&
                styles.highContrastCard,
            ]}
          >
            <View
              style={[
                styles.welcomeIcon,
                largeText &&
                  styles.welcomeIconLarge,
                highContrast &&
                  styles.highContrastIcon,
              ]}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={
                  largeText
                    ? 25
                    : 21
                }
                color={
                  highContrast
                    ? '#000000'
                    : '#6366F1'
                }
              />
            </View>

            <View
              style={
                styles.welcomeTextContainer
              }
            >
              <Text
                style={[
                  styles.welcomeTitle,
                  largeText &&
                    styles.welcomeTitleLarge,
                  {
                    color:
                      highContrast
                        ? '#000000'
                        : '#3730A3',
                  },
                ]}
                allowFontScaling
              >
                Hi, {displayName}
              </Text>

              <Text
                style={[
                  styles.welcomeText,
                  largeText &&
                    styles.welcomeTextLarge,
                  {
                    color:
                      highContrast
                        ? '#333333'
                        : '#6366A8',
                  },
                ]}
                allowFontScaling
              >
                Send a message whenever you need to reach your caregiver.
              </Text>
            </View>
          </View>

          {/* ==================================================
              CAREGIVER CONNECTION
          ================================================== */}

          <View
            style={[
              styles.connectionCard,
              largeText &&
                styles.connectionCardLarge,
              highContrast &&
                styles.highContrastCard,
            ]}
          >
            {caregiver?.profilePicture ? (
              <Image
                source={{
                  uri: caregiver.profilePicture,
                }}
                style={[
                  styles.connectionIcon,
                  styles.connectionProfileImage,
                  largeText &&
                    styles.connectionIconLarge,
                  largeText &&
                    styles.connectionProfileImageLarge,
                ]}
              />
            ) : (
              <View
                style={[
                  styles.connectionIcon,
                  largeText &&
                    styles.connectionIconLarge,
                  highContrast &&
                    styles.highContrastIcon,
                ]}
              >
                <Ionicons
                  name="person"
                  size={
                    largeText
                      ? 22
                      : 19
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#5B6CFF'
                  }
                />
              </View>
            )}

            <View
              style={
                styles.connectionInfo
              }
            >
              <Text
                style={[
                  styles.connectionTitle,
                  largeText &&
                    styles.connectionTitleLarge,
                  {
                    color:
                      textColor,
                  },
                ]}
                allowFontScaling
              >
                {caregiver
                  ? caregiver.name ||
                    'Your caregiver'
                  : 'No caregiver connected'}
              </Text>

              <Text
                style={[
                  styles.connectionSubtitle,
                  largeText &&
                    styles.connectionSubtitleLarge,
                  {
                    color:
                      secondaryTextColor,
                  },
                ]}
                allowFontScaling
              >
                {caregiver
                  ? 'Connected caregiver'
                  : 'Connect a caregiver in Settings to start messaging'}
              </Text>
            </View>

            <View
              style={[
                styles.onlineDot,
                caregiver
                  ? styles.online
                  : styles.offline,
                largeText &&
                  styles.onlineDotLarge,
              ]}
            />
          </View>

          {/* ==================================================
              CONNECT BUTTON
          ================================================== */}

          {!caregiver && (
            <TouchableOpacity
              style={[
                styles.connectButton,
                largeText &&
                  styles.connectButtonLarge,
                highContrast &&
                  styles.highContrastPrimaryButton,
              ]}
              onPress={() => {
                if (
                  navigation?.navigate
                ) {
                  navigation.navigate(
                    'Settings'
                  );
                } else {
                  Alert.alert(
                    'Caregiver Connection',
                    'Open Settings to connect your caregiver.'
                  );
                }
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Connect a caregiver"
            >
              <Ionicons
                name="link-outline"
                size={
                  largeText
                    ? 21
                    : 17
                }
                color="#FFFFFF"
              />

              <Text
                style={[
                  styles.connectButtonText,
                  largeText &&
                    styles.connectButtonTextLarge,
                ]}
                allowFontScaling
              >
                Connect a Caregiver
              </Text>
            </TouchableOpacity>
          )}

          {/* ==================================================
              MESSAGES
          ================================================== */}

          <ScrollView
            ref={scrollViewRef}
            style={
              styles.messagesContainer
            }
            contentContainerStyle={[
              styles.messagesContent,
              largeText &&
                styles.messagesContentLarge,
            ]}
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  handleRefresh
                }
                tintColor={
                  highContrast
                    ? '#000000'
                    : '#6366F1'
                }
              />
            }
          >
            {loading ? (
              <View
                style={[
                  styles.loadingState,
                  largeText &&
                    styles.loadingStateLarge,
                ]}
              >
                <ActivityIndicator
                  size="large"
                  color={
                    highContrast
                      ? '#000000'
                      : '#6366F1'
                  }
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
                  allowFontScaling
                >
                  Loading your messages...
                </Text>
              </View>
            ) : (
              messages.map(
                renderMessage
              )
            )}
          </ScrollView>

          {/* ==================================================
              QUICK NEEDS
          ================================================== */}

          <View
            style={[
              styles.quickSection,
              largeText &&
                styles.quickSectionLarge,
            ]}
          >
            <View
              style={
                styles.quickTitleRow
              }
            >
              <Text
                style={[
                  styles.quickTitle,
                  largeText &&
                    styles.quickTitleLarge,
                  {
                    color:
                      secondaryTextColor,
                  },
                ]}
                allowFontScaling
              >
                Quick Needs
              </Text>

              {unreadCount > 0 && (
                <View
                  style={
                    styles.unreadBadge
                  }
                >
                  <Text
                    style={
                      styles.unreadBadgeText
                    }
                  >
                    {unreadCount}
                  </Text>
                </View>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={[
                styles.quickScroll,
                largeText &&
                  styles.quickScrollLarge,
              ]}
            >
              <QuickNeedButton
                icon="water-outline"
                label="Water"
                phrase="I need water"
              />

              <QuickNeedButton
                icon="help-circle-outline"
                label="Help"
                phrase="I need help"
              />

              <QuickNeedButton
                icon="restaurant-outline"
                label="Food"
                phrase="I need food"
              />

              <QuickNeedButton
                icon="home-outline"
                label="Bathroom"
                phrase="I need to use the bathroom"
              />

              <QuickNeedButton
                icon="medical-outline"
                label="Medication"
                phrase="I need help with my medication"
              />

              <QuickNeedButton
                icon="notifications-outline"
                label="Check on me"
                phrase="Please check on me"
              />
            </ScrollView>
          </View>

          {/* ==================================================
              MESSAGE INPUT
          ================================================== */}

          <View
            style={[
              styles.inputContainer,
              largeText &&
                styles.inputContainerLarge,
            ]}
          >
            <TouchableOpacity
              style={[
                styles.micButton,
                largeText &&
                  styles.micButtonLarge,
                isListening &&
                  styles.micButtonActive,
                !caregiver &&
                  styles.micButtonDisabled,
                highContrast &&
                  caregiver &&
                  styles.highContrastPrimaryButton,
              ]}
              onPress={
                handleVoicePress
              }
              disabled={
                !caregiver ||
                sending
              }
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                isListening
                  ? 'Stop voice input'
                  : 'Start voice input'
              }
            >
              <Ionicons
                name={
                  isListening
                    ? 'stop'
                    : 'mic'
                }
                size={
                  largeText
                    ? 26
                    : 22
                }
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <View
              style={[
                styles.inputWrapper,
                largeText &&
                  styles.inputWrapperLarge,
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  largeText &&
                    styles.inputLarge,
                  highContrast &&
                    styles.highContrastInput,
                ]}
                placeholder={
                  caregiver
                    ? 'Type a message...'
                    : 'Connect a caregiver to message'
                }
                placeholderTextColor={
                  highContrast
                    ? '#555555'
                    : '#9CA3AF'
                }
                value={message}
                onChangeText={(
                  text
                ) => {
                  setMessage(text);

                  speechBaseMessageRef.current =
                    text;
                }}
                multiline
                maxLength={300}
                editable={
                  !!caregiver &&
                  !sending
                }
                returnKeyType="default"
                accessibilityLabel="Message input"
                allowFontScaling
              />

              {message.length >
                0 && (
                <TouchableOpacity
                  style={[
                    styles.clearButton,
                    largeText &&
                      styles.clearButtonLarge,
                  ]}
                  onPress={
                    clearMessage
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Clear message"
                >
                  <Ionicons
                    name="close-circle"
                    size={
                      largeText
                        ? 21
                        : 18
                    }
                    color={
                      highContrast
                        ? '#333333'
                        : '#A1A1AA'
                    }
                  />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                largeText &&
                  styles.sendButtonLarge,
                (
                  !message.trim() ||
                  !caregiver ||
                  sending
                ) &&
                  styles.sendButtonDisabled,
                highContrast &&
                  message.trim() &&
                  caregiver &&
                  !sending &&
                  styles.highContrastPrimaryButton,
              ]}
              onPress={() =>
                sendMessage()
              }
              disabled={
                !message.trim() ||
                !caregiver ||
                sending
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
                  name="arrow-up"
                  size={
                    largeText
                      ? 25
                      : 21
                  }
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>

          {/* ==================================================
              CHARACTER COUNT
          ================================================== */}

          {message.length >
            0 && (
            <Text
              style={[
                styles.characterCount,
                largeText &&
                  styles.characterCountLarge,
                {
                  color:
                    secondaryTextColor,
                },
              ]}
              allowFontScaling
            >
              {message.length}/300
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  keyboard: {
    flex: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 7,
  },

  containerLarge: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 10,
  },

  // ========================================================
  // HEADER
  // ========================================================

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  headerRowLarge: {
    marginBottom: 10,
  },

  headerTextContainer: {
    flex: 1,
  },

  header: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#000000',
  },

  headerLarge: {
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
    marginTop: 5,
  },

  subtitleLarge: {
    fontSize: 18,
    lineHeight: 26,
    marginTop: 6,
  },

  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  refreshButtonLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  highContrastRefreshButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  // ========================================================
  // WELCOME
  // ========================================================

  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F1FF',
    borderWidth: 1,
    borderColor: '#E0E2FF',
    borderRadius: 15,
    padding: 11,
    marginBottom: 8,
  },

  welcomeCardLarge: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },

  highContrastCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  welcomeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  welcomeIconLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 13,
  },

  highContrastIcon: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  welcomeTextContainer: {
    flex: 1,
  },

  welcomeTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#3730A3',
  },

  welcomeTitleLarge: {
    fontSize: 19,
    lineHeight: 26,
  },

  welcomeText: {
    fontSize: 11,
    color: '#6366A8',
    lineHeight: 16,
    marginTop: 2,
  },

  welcomeTextLarge: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 3,
  },

  // ========================================================
  // CONNECTION
  // ========================================================

  connectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  connectionCardLarge: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 15,
    marginBottom: 10,
  },

  connectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  connectionIconLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 13,
  },

  /*
   * Caregiver PFP in the connection card.
   * Keeps the same dimensions as the existing default
   * caregiver icon so the layout does not move.
   */

  connectionProfileImage: {
    resizeMode: 'cover',
  },

  connectionProfileImageLarge: {
    resizeMode: 'cover',
  },

  connectionInfo: {
    flex: 1,
  },

  connectionTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#333333',
  },

  connectionTitleLarge: {
    fontSize: 19,
    lineHeight: 26,
  },

  connectionSubtitle: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
    lineHeight: 15,
  },

  connectionSubtitleLarge: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 3,
  },

  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  onlineDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  online: {
    backgroundColor: '#34C759',
  },

  offline: {
    backgroundColor: '#C7C7CC',
  },

  // ========================================================
  // CONNECT BUTTON
  // ========================================================

  connectButton: {
    height: 37,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 7,
  },

  connectButtonLarge: {
    height: 50,
    borderRadius: 15,
    gap: 9,
    marginBottom: 10,
  },

  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  connectButtonTextLarge: {
    fontSize: 16,
  },

  highContrastPrimaryButton: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },

  // ========================================================
  // MESSAGES
  // ========================================================

  messagesContainer: {
    flex: 1,
  },

  messagesContent: {
    paddingTop: 5,
    paddingBottom: 8,
  },

  messagesContentLarge: {
    paddingTop: 8,
    paddingBottom: 12,
  },

  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 45,
  },

  loadingStateLarge: {
    paddingTop: 60,
  },

  loadingText: {
    fontSize: 12,
    color: '#888888',
    marginTop: 9,
  },

  loadingTextLarge: {
    fontSize: 16,
    marginTop: 12,
  },

  // ========================================================
  // DATE DIVIDER
  // ========================================================

  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 7,
  },

  dateDividerLarge: {
    marginVertical: 10,
  },

  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  highContrastLine: {
    backgroundColor: '#111827',
  },

  dateText: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
    marginHorizontal: 8,
  },

  dateTextLarge: {
    fontSize: 12,
    marginHorizontal: 10,
  },

  // ========================================================
  // MESSAGE ROW
  // ========================================================

  messageRow: {
    width: '100%',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  patientRow: {
    justifyContent: 'flex-end',
  },

  caregiverRow: {
    justifyContent: 'flex-start',
  },

  caregiverAvatar: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 2,
    overflow: 'hidden',
  },

  caregiverAvatarLarge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 8,
  },

  /*
   * Actual caregiver PFP inside message avatar.
   */

  caregiverAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  caregiverAvatarImageLarge: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  highContrastAvatar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
  },

  messageBubbleLarge: {
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: 19,
  },

  patientBubble: {
    backgroundColor: '#818CF8',
    borderBottomRightRadius: 4,
  },

  caregiverBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },

  highContrastPatientBubble: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },

  highContrastCaregiverBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  messageBubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },

  messageBubbleTextLarge: {
    fontSize: 18,
    lineHeight: 25,
  },

  patientText: {
    color: '#FFFFFF',
  },

  caregiverText: {
    color: '#333333',
  },

  highContrastPatientText: {
    color: '#FFFFFF',
  },

  highContrastCaregiverText: {
    color: '#000000',
  },

  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    gap: 8,
  },

  messageMetaLarge: {
    marginTop: 7,
    gap: 10,
  },

  messageTime: {
    fontSize: 9,
  },

  messageTimeLarge: {
    fontSize: 12,
  },

  patientTime: {
    color: '#E0E3FF',
  },

  caregiverTime: {
    color: '#9CA3AF',
  },

  messageStatus: {
    fontSize: 9,
    color: '#E0E3FF',
    fontWeight: '600',
  },

  messageStatusLarge: {
    fontSize: 12,
  },

  // ========================================================
  // QUICK NEEDS
  // ========================================================

  quickSection: {
    paddingTop: 1,
  },

  quickSectionLarge: {
    paddingTop: 3,
  },

  quickTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },

  quickTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#777777',
  },

  quickTitleLarge: {
    fontSize: 16,
    marginBottom: 2,
  },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5B6CFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 7,
    paddingHorizontal: 5,
  },

  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  quickScroll: {
    paddingBottom: 5,
    gap: 7,
  },

  quickScrollLarge: {
    paddingBottom: 8,
    gap: 9,
  },

  quickButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9DCFF',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  quickButtonLarge: {
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 7,
  },

  quickButtonDisabled: {
    backgroundColor: '#F5F5F7',
    borderColor: '#E5E5EA',
  },

  highContrastQuickButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  quickButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },

  quickButtonTextLarge: {
    fontSize: 15,
  },

  quickButtonTextDisabled: {
    color: '#AEB2C5',
  },

  highContrastQuickText: {
    color: '#000000',
  },

  // ========================================================
  // INPUT
  // ========================================================

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 3,
  },

  inputContainerLarge: {
    paddingTop: 6,
  },

  micButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 7,
  },

  micButtonLarge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginRight: 9,
  },

  micButtonActive: {
    backgroundColor: '#FF5C5C',
  },

  micButtonDisabled: {
    backgroundColor: '#C7C9D9',
  },

  inputWrapper: {
    flex: 1,
    position: 'relative',
  },

  inputWrapperLarge: {
    minHeight: 55,
  },

  input: {
    width: '100%',
    minHeight: 45,
    maxHeight: 90,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 10,
    paddingRight: 36,
    fontSize: 14,
    color: '#333333',
  },

  inputLarge: {
    minHeight: 55,
    maxHeight: 115,
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingTop: 14,
    paddingBottom: 12,
    paddingRight: 44,
    fontSize: 18,
  },

  highContrastInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
    color: '#000000',
  },

  clearButton: {
    position: 'absolute',
    right: 10,
    top: 13,
  },

  clearButtonLarge: {
    right: 13,
    top: 17,
  },

  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 7,
  },

  sendButtonLarge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginLeft: 9,
  },

  sendButtonDisabled: {
    backgroundColor: '#C7C9D9',
  },

  characterCount: {
    textAlign: 'right',
    fontSize: 9,
    color: '#9CA3AF',
    marginTop: 2,
    marginRight: 53,
  },

  characterCountLarge: {
    fontSize: 12,
    marginTop: 4,
    marginRight: 65,
  },
});