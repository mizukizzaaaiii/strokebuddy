import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  Switch,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import {
  Ionicons,
} from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  recognizeText,
} from 'expo-mlkit-ocr';

import * as Notifications from 'expo-notifications';

import {
  useAccessibility,
} from '../context/AccessibilityContext';

// Medication reminders should still be visible when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


// ==========================================
// PATIENT MEDICATION SCREEN
// ==========================================

export default function MedsScreen({
  navigation,
  route,
}) {

  const {
    name,
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
  // CAMERA
  // ==========================================

  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const cameraRef = useRef(null);


  // ==========================================
  // INPUT STATE
  // ==========================================

  const [
    medName,
    setMedName,
  ] = useState('');

  const [
    dosage,
    setDosage,
  ] = useState('');

  const [
    instructions,
    setInstructions,
  ] = useState('');

  const [
    frequency,
    setFrequency,
  ] = useState('Once daily');

  const [
    reminderTime,
    setReminderTime,
  ] = useState('9:00 AM');

  const [
    secondReminderTime,
    setSecondReminderTime,
  ] = useState('9:00 PM');

  const [
    reminderEnabled,
    setReminderEnabled,
  ] = useState(true);

  const [
    medicationRemindersEnabled,
    setMedicationRemindersEnabled,
  ] = useState(true);


  // ==========================================
  // MEDICATION STATE
  // ==========================================

  const [
    medications,
    setMedications,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState(null);


  // ==========================================
  // SCANNER STATE
  // ==========================================

  const [
    showCamera,
    setShowCamera,
  ] = useState(true);

  const [
    scanning,
    setScanning,
  ] = useState(false);

  const [
    barcodeData,
    setBarcodeData,
  ] = useState(null);

  const [
    ocrText,
    setOcrText,
  ] = useState('');

  const [
    scanResultVisible,
    setScanResultVisible,
  ] = useState(false);

  const [
    scanDetected,
    setScanDetected,
  ] = useState({
    name: '',
    type: '',
    dosage: '',
    frequency: '',
    instructions: '',
  });

  const [
    scannerError,
    setScannerError,
  ] = useState('');

  const [
    flashEnabled,
    setFlashEnabled,
  ] = useState(false);


  // ==========================================
  // HISTORY MODAL
  // ==========================================

  const [
    historyMedication,
    setHistoryMedication,
  ] = useState(null);

  const [
    historyVisible,
    setHistoryVisible,
  ] = useState(false);


  // ==========================================
  // ACCESSIBILITY-AWARE STYLES
  // ==========================================

  const styles = createStyles(
    largeText,
    highContrast
  );


  // ==========================================
  // STORAGE KEY
  // ==========================================

  const getMedicationStorageKey =
    () => {

      const patientId =
        accountId || 'default_patient';

      return `strokebuddy_medications_${patientId}`;

    };

  const getNotificationSettingsKey =
    () => {
      const patientId =
        accountId || 'default_patient';

      return `strokebuddy_notification_settings_${patientId}`;
    };

  const parseScheduleTimes = (schedule) => {
    const text = String(schedule || '').trim();
    if (!text) {
      return [];
    }

    // Caregiver entries commonly look like:
    // "8:00 AM and 8:00 PM" or "8 AM, 8 PM".
    // Keep only recognizable clock times so unrelated text is not shown
    // as a reminder time.
    const matches = text.match(/\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:AM|PM)\b/gi);
    return Array.from(new Set((matches || []).map((value) => value.replace(/\s+/g, ' ').trim())));
  };

  const deriveFrequencyFromCaregiverRecord = (medication) => {
    if (medication?.frequency) {
      return medication.frequency;
    }

    const count = Number.parseInt(medication?.dosesPerDay, 10);
    if (Number.isFinite(count) && count > 0) {
      if (count === 1) return 'Once daily';
      if (count === 2) return 'Twice daily';
      if (count === 3) return 'Three times daily';
      if (count === 4) return 'Four times daily';
      return `${count} times daily`;
    }

    return 'As directed';
  };

  const getNotificationIds =
    (medication) => {
      if (
        Array.isArray(
          medication?.notificationIds
        )
      ) {
        return medication.notificationIds.filter(
          Boolean
        );
      }

      if (
        medication?.notificationId
      ) {
        return [
          medication.notificationId,
        ];
      }

      return [];
    };

  const cancelMedicationNotifications =
    async (medication) => {
      const ids =
        getNotificationIds(medication);

      await Promise.all(
        ids.map(
          async (notificationId) => {
            try {
              await Notifications.cancelScheduledNotificationAsync(
                notificationId
              );
            } catch (error) {
              // The notification may already be gone.
              console.log(
                'Medication notification cancel warning:',
                error
              );
            }
          }
        )
      );
    };

  const parseReminderTime =
    (value) => {
      const normalized =
        String(value || '')
          .trim()
          .toUpperCase();

      const match12 =
        normalized.match(
          /^(\d{1,2}):(\d{2})\s*(AM|PM)$/
        );

      if (match12) {
        let hour =
          Number(match12[1]);
        const minute =
          Number(match12[2]);

        if (
          hour >= 1 &&
          hour <= 12 &&
          minute >= 0 &&
          minute <= 59
        ) {
          if (
            match12[3] === 'AM' &&
            hour === 12
          ) {
            hour = 0;
          }

          if (
            match12[3] === 'PM' &&
            hour !== 12
          ) {
            hour += 12;
          }

          return {
            hour,
            minute,
          };
        }
      }

      const match24 =
        normalized.match(
          /^(\d{1,2}):(\d{2})$/
        );

      if (match24) {
        const hour =
          Number(match24[1]);
        const minute =
          Number(match24[2]);

        if (
          hour >= 0 &&
          hour <= 23 &&
          minute >= 0 &&
          minute <= 59
        ) {
          return {
            hour,
            minute,
          };
        }
      }

      return null;
    };

  const ensureNotificationPermission =
    async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(
            'medication-reminders',
            {
              name: 'Medication Reminders',
              importance:
                Notifications.AndroidImportance?.HIGH ||
                4,
              sound: 'default',
              vibrationPattern: [
                0,
                250,
                250,
                250,
              ],
              lockscreenVisibility:
                Notifications.AndroidNotificationVisibility?.PUBLIC ||
                1,
            }
          );
        }

        const existing =
          await Notifications.getPermissionsAsync();

        if (
          existing?.granted
        ) {
          return true;
        }

        const requested =
          await Notifications.requestPermissionsAsync();

        if (
          requested?.granted
        ) {
          return true;
        }

        return false;
      } catch (error) {
        console.log(
          'Medication notification permission error:',
          error
        );

        return false;
      }
    };

  const loadNotificationSetting =
    async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            getNotificationSettingsKey()
          );

        if (!saved) {
          setMedicationRemindersEnabled(
            true
          );
          return true;
        }

        const settings =
          JSON.parse(saved);

        const enabled =
          typeof settings?.medicationReminders === 'boolean'
            ? settings.medicationReminders
            : true;

        setMedicationRemindersEnabled(
          enabled
        );

        return enabled;
      } catch (error) {
        console.log(
          'Notification settings load error:',
          error
        );

        setMedicationRemindersEnabled(
          true
        );

        return true;
      }
    };

  const scheduleMedicationNotifications =
    async (
      medication,
      settingOverride = medicationRemindersEnabled
    ) => {
      if (!medication?.id) {
        return [];
      }

      await cancelMedicationNotifications(
        medication
      );

      if (
        settingOverride === false ||
        medication.enabled === false ||
        medication.frequency === 'As needed'
      ) {
        return [];
      }

      const permissionGranted =
        await ensureNotificationPermission();

      if (!permissionGranted) {
        return [];
      }

      const times = [
        medication.time || '9:00 AM',
      ];

      if (
        medication.frequency === 'Twice daily'
      ) {
        times.push(
          medication.secondTime ||
          '9:00 PM'
        );
      }

      const scheduledIds = [];

      for (
        const timeValue of times
      ) {
        const parsed =
          parseReminderTime(timeValue);

        if (!parsed) {
          continue;
        }

        try {
          const notificationId =
            await Notifications.scheduleNotificationAsync({
              content: {
                title:
                  `Medication Reminder: ${medication.name}`,
                body:
                  `${medication.dosage}. ${medication.instructions}`,
                sound: 'default',
                channelId:
                  'medication-reminders',
                data: {
                  type: 'medication-reminder',
                  patientId:
                    medication.patientId ||
                    accountId ||
                    null,
                  medicationId:
                    medication.id,
                },
              },
              trigger: {
                type:
                  Notifications.SchedulableTriggerInputTypes?.DAILY ||
                  'daily',
                hour: parsed.hour,
                minute: parsed.minute,
              },
            });

          scheduledIds.push(
            notificationId
          );
        } catch (error) {
          console.log(
            'Medication notification scheduling error:',
            error
          );
        }
      }

      return scheduledIds;
    };

  const rescheduleAllMedicationNotifications =
    async (
      sourceMedications = medications,
      settingOverride = medicationRemindersEnabled
    ) => {
      const settingEnabled =
        settingOverride !== false;

      if (
        sourceMedications.length === 0
      ) {
        return;
      }

      if (
        !settingEnabled
      ) {
        await Promise.all(
          sourceMedications.map(
            (medication) =>
              cancelMedicationNotifications(
                medication
              )
          )
        );

        const cleaned =
          sourceMedications.map(
            (medication) => ({
              ...medication,
              notificationIds: [],
              notificationId: null,
            })
          );

        await persistMedications(
          cleaned
        );

        setMedications(
          cleaned
        );

        return;
      }

      const permissionGranted =
        await ensureNotificationPermission();

      if (!permissionGranted) {
        return;
      }

      const updated =
        [];

      for (
        const medication of sourceMedications
      ) {
        const ids =
          await scheduleMedicationNotifications(
            medication,
            settingEnabled
          );

        updated.push({
          ...medication,
          notificationIds: ids,
          notificationId:
            ids[0] || null,
        });
      }

      await persistMedications(
        updated
      );

      setMedications(
        updated
      );
    };


  // ==========================================
  // TODAY KEY
  //
  // Uses the DEVICE'S LOCAL date.
  // This prevents UTC from changing the
  // medication day early/late.
  // ==========================================

  const getToday =
    () => {

      const date =
        new Date();

      const year =
        date.getFullYear();

      const month =
        String(
          date.getMonth() + 1
        ).padStart(
          2,
          '0'
        );

      const day =
        String(
          date.getDate()
        ).padStart(
          2,
          '0'
        );

      return `${year}-${month}-${day}`;

    };


  // ==========================================
  // LOAD MEDICATIONS
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const initializeMedicationScreen =
      async () => {
        const settingEnabled =
          await loadNotificationSetting();

        if (cancelled) {
          return;
        }

        await loadMedications();

        if (cancelled) {
          return;
        }

        // Existing saved medication reminders are reconciled
        // after medication data is loaded.
        const saved =
          await AsyncStorage.getItem(
            getMedicationStorageKey()
          );

        if (
          saved &&
          settingEnabled
        ) {
          try {
            const parsed =
              JSON.parse(saved);

            const parsedMedications =
              Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed?.medications)
                  ? parsed.medications
                  : [];

            if (
              parsedMedications.length > 0
            ) {
              const normalized =
                parsedMedications.map(
                  (medication) => ({
                    ...medication,
                    notificationIds:
                      getNotificationIds(
                        medication
                      ),
                    notificationId:
                      getNotificationIds(
                        medication
                      )[0] || null,
                  })
                );

              if (!cancelled) {
                await rescheduleAllMedicationNotifications(
                  normalized,
                  settingEnabled
                );
              }
            }
          } catch (error) {
            console.log(
              'Medication notification initialization error:',
              error
            );
          }
        }
      };

    initializeMedicationScreen();

    return () => {
      cancelled = true;
    };
  }, [accountId]);


  // ==========================================
  // KEEP THE PATIENT SCANNER ON THE MAIN PAGE
  // ==========================================

  useEffect(() => {
    let active = true;

    const prepareScanner = async () => {
      try {
        if (!permission?.granted) {
          const result = await requestPermission();

          if (active && result?.granted) {
            setShowCamera(true);
          }
        } else if (active) {
          setShowCamera(true);
        }
      } catch (error) {
        console.log('Camera setup error:', error);
      }
    };

    prepareScanner();

    return () => {
      active = false;
    };
  }, []);


  // ==========================================
  // OPEN MEDICATION SCANNER
  // ==========================================
  // Keep scanner opening centralized so every scan entry point
  // (scan card, rescan, etc.) uses the same permission behavior.
  const openMedicationScanner =
    async () => {
      try {
        if (!permission?.granted) {
          const result = await requestPermission();

          if (!result?.granted) {
            Alert.alert(
              'Camera Permission Needed',
              'Allow camera access in Settings so StrokeBuddy can scan the medication label.'
            );
            return false;
          }
        }

        setScannerError('');
        setBarcodeData(null);
        setOcrText('');
        setScanning(false);
        setShowCamera(true);
        return true;
      } catch (error) {
        console.log(
          'Unable to open medication scanner:',
          error
        );

        Alert.alert(
          'Scanner Error',
          'The medication scanner could not be opened. Please try again.'
        );
        return false;
      }
    };


  // ==========================================
  // REFRESH NOTIFICATION SETTING WHEN FOCUSED
  // ==========================================

  useEffect(() => {
    const unsubscribe =
      navigation?.addListener?.(
        'focus',
        async () => {
          const enabled =
            await loadNotificationSetting();

          const saved =
            await AsyncStorage.getItem(
              getMedicationStorageKey()
            );

          if (!saved) {
            return;
          }

          try {
            const parsed =
              JSON.parse(saved);

            const parsedMedications =
              Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed?.medications)
                  ? parsed.medications
                  : [];

            if (parsedMedications.length > 0) {
              await rescheduleAllMedicationNotifications(
                parsedMedications,
                enabled
              );
            }
          } catch (error) {
            console.log(
              'Medication notification refresh error:',
              error
            );
          }
        }
      );

    return unsubscribe;
  }, [navigation, accountId]);


  // ==========================================
  // LOAD SAVED MEDICATIONS
  // ==========================================

  const loadMedications =
    async (showLoader = true) => {

      try {

        if (showLoader) {
          setLoading(true);
        }

        const storageKey =
          getMedicationStorageKey();

        const saved =
          await AsyncStorage.getItem(
            storageKey
          );

        if (saved) {

          const parsed =
            JSON.parse(saved);

          // CaregiverMedsScreen stores the patient record as:
          // { version, medications, notes, doseHistory }.
          // Older patient builds stored a plain medication array.
          // Read both formats so caregiver-entered medications appear
          // without changing the patient UI.
          const sourceMedications =
            Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.medications)
                ? parsed.medications
                : [];

          const today =
            getToday();

          const normalized =
            sourceMedications.map(
              (medication) => {

                const history =
                  Array.isArray(
                    medication.doseHistory
                  )
                    ? medication.doseHistory
                    : [];

                const takenToday =
                  history.some(
                    (entry) =>
                      entry.date === today &&
                      entry.status === 'taken'
                  ) ||
                  (
                    medication.lastTakenDate === today &&
                    medication.takenToday === true
                  );

                const notificationIds =
                  getNotificationIds(
                    medication
                  );

                const scheduleTimes =
                  parseScheduleTimes(
                    medication.schedule
                  );

                const resolvedTime =
                  medication.time ||
                  scheduleTimes[0] ||
                  '9:00 AM';

                const resolvedSecondTime =
                  medication.secondTime ||
                  scheduleTimes[1] ||
                  '9:00 PM';

                const resolvedType =
                  medication.type ||
                  medication.medicationType ||
                  '';

                return {
                  ...medication,
                  id:
                    medication.id ||
                    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  name:
                    medication.name || '',
                  dosage:
                    medication.dosage || '',
                  instructions:
                    medication.instructions || '',
                  frequency:
                    deriveFrequencyFromCaregiverRecord(
                      medication
                    ),
                  medicationType:
                    resolvedType,
                  type:
                    resolvedType,
                  schedule:
                    medication.schedule ||
                    '',
                  takenToday,
                  doseHistory:
                    history,
                  enabled:
                    medication.enabled !== false,
                  time:
                    resolvedTime,
                  secondTime:
                    resolvedSecondTime,
                  notificationIds,
                  notificationId:
                    notificationIds[0] || null,
                };

              }
            );

          setMedications(
            normalized
          );

          // Do NOT overwrite a caregiver's object with a plain array.
          // Keeping the envelope preserves notes and other caregiver data.
          if (!Array.isArray(parsed)) {
            await AsyncStorage.setItem(
              storageKey,
              JSON.stringify({
                ...parsed,
                version:
                  parsed.version || 3,
                medications:
                  normalized,
              })
            );
          } else {
            await AsyncStorage.setItem(
              storageKey,
              JSON.stringify(
                normalized
              )
            );
          }

        } else {

          setMedications([]);

        }

      } catch (error) {

        console.log(
          'Medication load error:',
          error
        );

        Alert.alert(
          'Medication Error',
          'We could not load your saved medications.'
        );

      } finally {

        if (showLoader) {
          setLoading(false);
        }

      }

    };

  // ==========================================
  // KEEP CAREGIVER MEDICATIONS IN SYNC
  // ==========================================

  useEffect(() => {
    let active = true;

    const refreshFromCaregiver = async () => {
      if (!active) return;
      await loadMedications(false);
    };

    const interval = setInterval(refreshFromCaregiver, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [accountId]);

  // ==========================================
  // SAVE ALL MEDICATIONS
  // ==========================================

  const persistMedications =
    async (
      updatedMedications
    ) => {

      try {

        const storageKey =
          getMedicationStorageKey();

        const existingRaw =
          await AsyncStorage.getItem(
            storageKey
          );

        let existing = null;

        if (existingRaw) {
          try {
            existing = JSON.parse(existingRaw);
          } catch {
            existing = null;
          }
        }

        // Preserve the caregiver's shared patient-record envelope.
        // This is important because the caregiver screen stores:
        // { version, medications, notes, doseHistory }.
        if (
          existing &&
          !Array.isArray(existing) &&
          typeof existing === 'object'
        ) {
          await AsyncStorage.setItem(
            storageKey,
            JSON.stringify({
              ...existing,
              version:
                existing.version || 3,
              medications:
                updatedMedications,
              notes:
                Array.isArray(existing.notes)
                  ? existing.notes
                  : [],
              doseHistory:
                Array.isArray(existing.doseHistory)
                  ? existing.doseHistory
                  : [],
            })
          );
        } else {
          // Backward compatibility for older patient-only data.
          await AsyncStorage.setItem(
            storageKey,
            JSON.stringify(
              updatedMedications
            )
          );
        }

        return true;

      } catch (error) {

        console.log(
          'Medication save error:',
          error
        );

        Alert.alert(
          'Save Error',
          'Your medication changes could not be saved.'
        );

        return false;

      }

    };

  // ==========================================
  // BARCODE DETECTED
  // ==========================================

  const handleBarcodeScanned =
    (result) => {

      if (!result?.data) {

        return;

      }

      setBarcodeData({
        type:
          result.type || 'unknown',

        data:
          result.data,
      });

    };


  // ==========================================
  // BARCODE LOOKUP
  // ==========================================

  const lookupMedicationByBarcode =
    async (barcode) => {

      const rawBarcode = String(barcode || '').trim();

      if (!rawBarcode) {
        return null;
      }

      const cleanBarcode = rawBarcode.replace(/[^0-9A-Za-z-]/g, '');

      const tryOpenFda = async (field, value) => {
        try {
          const search = `${field}:"${value}"`;
          const url =
            `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(search)}&limit=1`;

          const response = await fetch(url);

          if (!response.ok) {
            return null;
          }

          const json = await response.json();
          return json?.results?.[0] || null;
        } catch (error) {
          console.log('Medication barcode lookup warning:', error);
          return null;
        }
      };

      // A medication barcode is often a UPC/EAN rather than an NDC.
      // We therefore try exact NDC/package fields when the scanned value
      // is also formatted like an NDC. If it is a normal UPC/EAN, OCR
      // remains the primary source instead of inventing medication data.
      const candidates = [
        ['packaging.package_ndc', cleanBarcode],
        ['openfda.package_ndc', cleanBarcode],
        ['openfda.product_ndc', cleanBarcode],
      ];

      for (const [field, value] of candidates) {
        if (!value) {
          continue;
        }

        const result = await tryOpenFda(field, value);

        if (result) {
          const brandName =
            result?.openfda?.brand_name?.[0] ||
            result?.brand_name ||
            '';

          const genericName =
            result?.openfda?.generic_name?.[0] ||
            result?.generic_name ||
            '';

          const dosageForm =
            result?.dosage_form ||
            '';

          const activeIngredient =
            result?.active_ingredients?.[0]?.strength ||
            '';

          const administration =
            Array.isArray(result?.dosage_and_administration)
              ? result.dosage_and_administration[0]
              : '';

          const route =
            result?.route?.[0] ||
            result?.route ||
            '';

          return {
            name:
              brandName || genericName,
            genericName,
            type: dosageForm,
            dosage: activeIngredient,
            frequency: parseMedicationFrequency(
              administration || ''
            ),
            instructions: cleanInstructionText(
              administration || ''
            ),
            route,
            source: 'OpenFDA',
          };
        }
      }

      return null;
    };


  const cleanInstructionText =
    (value) => {
      return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/^\s*directions?\s*[:\-]?\s*/i, '')
        .trim();
    };


  const parseMedicationFrequency =
    (value) => {
      const text = String(value || '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!text) {
        return '';
      }

      const lower = text.toLowerCase();

      if (
        /\b(twice|2 times|two times)\b.*\b(day|daily)\b/.test(lower) ||
        /\bevery\s+12\s*(hours?|hrs?)\b/.test(lower) ||
        /\bq12h\b/.test(lower)
      ) {
        return 'Twice daily';
      }

      if (
        /\b(three times|3 times|thrice)\b.*\b(day|daily)\b/.test(lower) ||
        /\bevery\s+8\s*(hours?|hrs?)\b/.test(lower) ||
        /\bq8h\b/.test(lower)
      ) {
        return 'Three times daily';
      }

      if (
        /\b(four times|4 times)\b.*\b(day|daily)\b/.test(lower) ||
        /\bevery\s+6\s*(hours?|hrs?)\b/.test(lower) ||
        /\bq6h\b/.test(lower)
      ) {
        return 'Four times daily';
      }

      if (
        /\b(once|1 time|one time)\b.*\b(day|daily)\b/.test(lower) ||
        /\bevery\s+24\s*(hours?|hrs?)\b/.test(lower) ||
        /\bq24h\b/.test(lower) ||
        /\bdaily\b/.test(lower)
      ) {
        return 'Once daily';
      }

      if (
        /\b(as needed|as required|when needed|prn)\b/.test(lower)
      ) {
        return 'As needed';
      }

      if (/\bat bedtime\b/.test(lower)) {
        return 'At bedtime';
      }

      return '';
    };


  // ==========================================
  // OCR CLEANUP / TEXT AGGREGATION
  // ==========================================

  const normalizeOcrLine =
    (value) => {
      return String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/[|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

  const isEnglishReadableText =
    (value) => {
      const text = normalizeOcrLine(value);

      if (!text) {
        return false;
      }

      // Do not display OCR fragments written in non-Latin scripts.
      if (!/^[\x20-\x7E]+$/.test(text)) {
        return false;
      }

      const letters =
        (text.match(/[A-Za-z]/g) || []).length;

      return letters >= 2;
    };

  const collectOcrText =
    (result) => {
      const collected = [];
      const seen = new Set();

      const add = (value) => {
        const line = normalizeOcrLine(value);

        if (!isEnglishReadableText(line)) {
          return;
        }

        const key = line.toLowerCase();

        if (seen.has(key)) {
          return;
        }

        seen.add(key);
        collected.push(line);
      };

      add(result?.text);

      const walk = (value) => {
        if (!value) {
          return;
        }

        if (typeof value === 'string') {
          add(value);
          return;
        }

        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }

        if (typeof value === 'object') {
          add(value.text);
          add(value.rawText);
          add(value.value);

          if (Array.isArray(value.blocks)) {
            value.blocks.forEach(walk);
          }

          if (Array.isArray(value.lines)) {
            value.lines.forEach(walk);
          }

          if (Array.isArray(value.elements)) {
            value.elements.forEach(walk);
          }
        }
      };

      walk(result?.blocks);
      walk(result?.lines);
      walk(result?.elements);

      return collected.join('\n');
    };


  // ==========================================
  // TAKE PHOTO + OCR
  // ==========================================

  const captureMedicationLabel =
    async () => {

      if (
        !cameraRef.current ||
        scanning
      ) {
        return;
      }

      try {
        setScanning(true);
        setScannerError('');

        const photo =
          await cameraRef.current.takePictureAsync({
            quality: 1,
            skipProcessing: false,
          });

        if (!photo?.uri) {
          throw new Error('No image was captured.');
        }

        // OCR works on either the front or back of the package.
        // The back is recommended because it usually contains the
        // directions, dose, and barcode together.
        const result =
          await recognizeText(photo.uri);

        const recognizedText =
          collectOcrText(result);

        setOcrText(recognizedText);

        const ocrSuggestions =
          parseMedicationLabel(recognizedText);

        // Barcode is only a fallback for the medication name.
        let barcodeSuggestions = null;

        if (barcodeData?.data) {
          barcodeSuggestions =
            await lookupMedicationByBarcode(
              barcodeData.data
            );
        }

        const suggestions = {
          name:
            ocrSuggestions.name ||
            barcodeSuggestions?.name ||
            '',
          type: '',
          dosage: '',
          frequency: '',
          instructions: '',
        };

        setScanDetected(suggestions);

        if (suggestions.name) {
          setMedName(suggestions.name);
        }

        setShowCamera(false);
        setScanResultVisible(true);

      } catch (error) {
        console.log(
          'Medication OCR/barcode error:',
          error
        );

        setScannerError(
          'We could not read the label clearly. Try the back of the box with the barcode and medication label visible, improve the lighting, or scan again.'
        );

        Alert.alert(
          'Label Not Read',
          'StrokeBuddy could not read the medication label clearly. Try the back of the box with the barcode and medication label visible, or scan again.'
        );

      } finally {
        setScanning(false);
      }
    };


  // ==========================================
  // PARSE OCR TEXT
  // ==========================================

  const parseMedicationLabel =
    (text) => {

      const raw = String(text || '');

      if (!raw.trim()) {
        return {};
      }

      const normalizedText = raw
        .replace(/\r/g, '\n')
        .replace(/[|]+/g, ' ')
        .replace(/\n{2,}/g, '\n');

      const lines = normalizedText
        .split(/\n+/)
        .map(normalizeOcrLine)
        .filter(isEnglishReadableText)
        .filter(Boolean);

      if (lines.length === 0) {
        return {};
      }

      const allText = lines.join('\n');
      const lowerAllText = allText.toLowerCase();

      const boilerplatePatterns = [
        /^rx$/i,
        /^prescription$/i,
        /^refill/i,
        /^quantity/i,
        /^qty\b/i,
        /^pharmacy\b/i,
        /^patient\b/i,
        /^doctor\b/i,
        /^prescriber\b/i,
        /^date\b/i,
        /^discard\b/i,
        /^lot\b/i,
        /^lot no/i,
        /^lot number/i,
        /^exp\b/i,
        /^expiration/i,
        /^ndc\b/i,
        /^din\b/i,
        /^barcode\b/i,
        /^keep out of reach/i,
        /^store at/i,
        /^storage/i,
        /^warning/i,
        /^distributed by/i,
        /^manufactured by/i,
        /^made by/i,
        /^ingredients?\b/i,
        /^inactive ingredients?/i,
        /^www\./i,
        /^https?:\/\//i,
      ];

      const isBoilerplate = (line) =>
        boilerplatePatterns.some((pattern) =>
          pattern.test(line)
        );

      const usefulLines = lines.filter(
        (line) => !isBoilerplate(line)
      );

      // --------------------------------------
      // DOSAGE / STRENGTH
      // --------------------------------------

      const dosagePatterns = [
        /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|kg|mL|ml|L|IU|units?)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mL|ml|L|g|mg|actuation|dose))?\b/i,
        /\b\d+(?:\.\d+)?\s*%\b/i,
        /\b\d+(?:\.\d+)?\s*(?:mg|mcg)\s*\/\s*\d+(?:\.\d+)?\s*(?:mL|ml|L)\b/i,
      ];

      const dosageCandidates = [];

      usefulLines.forEach((line) => {
        dosagePatterns.forEach((pattern) => {
          const match = line.match(pattern);
          if (match?.[0]) {
            dosageCandidates.push({
              value: match[0].replace(/\s+/g, ' ').trim(),
              line,
            });
          }
        });
      });

      const dosageMatch =
        dosageCandidates[0]?.value || '';

      // --------------------------------------
      // MEDICATION TYPE / DOSAGE FORM
      // --------------------------------------

      const typePatterns = [
        { type: 'Chewable tablet', pattern: /\bchewable\b.*\btablet\b/i },
        { type: 'Extended-release tablet', pattern: /\b(?:extended|sustained|controlled|delayed)\s*-?release\b.*\btablet/i },
        { type: 'Tablet', pattern: /\btablets?\b|\btab\.?\b/i },
        { type: 'Capsule', pattern: /\bcapsules?\b|\bcap\.?\b/i },
        { type: 'Liquid', pattern: /\bliquid\b|\boral solution\b|\bsuspension\b|\bsyrup\b/i },
        { type: 'Cream', pattern: /\bcream\b/i },
        { type: 'Ointment', pattern: /\bointment\b/i },
        { type: 'Gel', pattern: /\bgel\b/i },
        { type: 'Lotion', pattern: /\blotion\b/i },
        { type: 'Patch', pattern: /\bpatch\b/i },
        { type: 'Inhaler', pattern: /\binhaler\b/i },
        { type: 'Drops', pattern: /\bdrops?\b|\bophthalmic\b/i },
        { type: 'Spray', pattern: /\bspray\b|\bnasal spray\b/i },
        { type: 'Injection', pattern: /\binjection\b|\binjectable\b/i },
        { type: 'Suppository', pattern: /\bsuppositor(?:y|ies)\b/i },
      ];

      let detectedType = '';

      for (const item of typePatterns) {
        if (item.pattern.test(allText)) {
          detectedType = item.type;
          break;
        }
      }

      // --------------------------------------
      // WHEN / FREQUENCY
      // --------------------------------------

      let detectedFrequency =
        parseMedicationFrequency(allText);

      const explicitFrequencyLine = usefulLines.find((line) =>
        /^(?:when|frequency|schedule|directions?)\s*:/i.test(line)
      );

      if (explicitFrequencyLine) {
        const value = explicitFrequencyLine
          .replace(/^(?:when|frequency|schedule|directions?)\s*:\s*/i, '')
          .trim();

        detectedFrequency =
          parseMedicationFrequency(value) || value;
      }

      // --------------------------------------
      // HOW TO TAKE / INSTRUCTIONS
      // --------------------------------------

      const instructionPatterns = [
        /\btake\b/i,
        /\bby mouth\b/i,
        /\bwith food\b/i,
        /\bwith meals?\b/i,
        /\bafter (?:food|meal|breakfast|lunch|dinner)\b/i,
        /\bbefore (?:food|meal|breakfast|lunch|dinner)\b/i,
        /\bat bedtime\b/i,
        /\bapply\b/i,
        /\binhale\b/i,
        /\binstill\b/i,
        /\bspray\b/i,
        /\bswallow\b/i,
        /\bchew\b/i,
        /\bdissolve\b/i,
        /\bdo not crush\b/i,
        /\bdo not chew\b/i,
        /\bas needed\b/i,
        /\buse\b/i,
      ];

      const explicitInstructionLine = usefulLines.find((line) =>
        /^(?:directions?|instructions?|how to take|how to use)\s*:/i.test(line)
      );

      let detectedInstructions =
        explicitInstructionLine
          ? explicitInstructionLine
              .replace(/^(?:directions?|instructions?|how to take|how to use)\s*:\s*/i, '')
              .trim()
          : '';

      if (!detectedInstructions) {
        const instructionCandidate = usefulLines.find((line) => {
          if (line.length < 8 || line.length > 180) {
            return false;
          }

          if (dosagePatterns.some((pattern) => pattern.test(line)) &&
              line.split(/\s+/).length <= 5) {
            return false;
          }

          return instructionPatterns.some((pattern) =>
            pattern.test(line)
          );
        });

        detectedInstructions =
          instructionCandidate || '';
      }

      if (
        detectedInstructions &&
        detectedInstructions.toLowerCase() ===
          String(detectedFrequency || '').toLowerCase()
      ) {
        detectedInstructions = '';
      }

      // --------------------------------------
      // MEDICATION NAME
      // --------------------------------------

      const explicitNamePatterns = [
        /^(?:medication|medicine|drug|name|brand|brand name|generic|generic name)\s*:\s*(.+)$/i,
      ];

      let detectedName = '';

      for (const line of lines) {
        for (const pattern of explicitNamePatterns) {
          const match = line.match(pattern);
          if (!match?.[1]) {
            continue;
          }

          const candidate = normalizeOcrLine(match[1]);

          if (
            isPlausibleMedicationName(
              candidate,
              dosagePatterns,
              typePatterns,
              instructionPatterns
            )
          ) {
            detectedName = candidate;
            break;
          }
        }

        if (detectedName) {
          break;
        }
      }

      if (!detectedName) {
        const candidates = usefulLines
          .map((line, index) => {
            const words = line.split(/\s+/).filter(Boolean);
            const lower = line.toLowerCase();
            let score = 0;

            if (!isPlausibleMedicationName(
              line,
              dosagePatterns,
              typePatterns,
              instructionPatterns
            )) {
              return { line, score: -100 };
            }

            // A product name is usually short enough to be a title,
            // but should not be a tiny OCR fragment such as "xtra".
            if (words.length <= 6) {
              score += 4;
            }

            if (words.length >= 2 && words.length <= 5) {
              score += 3;
            }

            if (/^[A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*)*$/.test(line)) {
              score += 3;
            }

            if (/^[A-Z0-9][A-Z0-9\- ]{3,}$/.test(line)) {
              score += 2;
            }

            if (/\b(brand|name|generic)\b/i.test(lower)) {
              score -= 3;
            }

            if (/\b(ingredients?|active|strength|directions?|warning|storage)\b/i.test(lower)) {
              score -= 8;
            }

            // Medication names are often prominent near the beginning of
            // the label, but position is only a small signal.
            score += Math.max(0, 4 - index * 0.5);

            return { line, score };
          })
          .sort((a, b) => b.score - a.score);

        if (candidates[0]?.score >= 5) {
          detectedName = candidates[0].line;
        }
      }

      if (detectedName) {
        detectedName = detectedName
          .replace(/^(?:rx|drug|medicine|medication|brand|generic)\s*[:#-]\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      return {
        name: detectedName,
        type: detectedType,
        dosage: dosageMatch,
        frequency: detectedFrequency || '',
        instructions: cleanInstructionText(detectedInstructions),
      };
    };

  const isPlausibleMedicationName =
    (
      candidate,
      dosagePatterns = [],
      typePatterns = [],
      instructionPatterns = []
    ) => {
      const value = normalizeOcrLine(candidate);

      if (!isEnglishReadableText(value)) {
        return false;
      }

      if (value.length < 5 || value.length > 70) {
        return false;
      }

      const words = value.split(/\s+/).filter(Boolean);

      // Prevent truncated OCR fragments from becoming the medication name.
      if (
        words.length === 1 &&
        value.length < 5
      ) {
        return false;
      }

      if (
        dosagePatterns.some((pattern) => pattern.test(value))
      ) {
        return false;
      }

      if (
        typePatterns.some((item) => item.pattern.test(value)) &&
        words.length <= 4
      ) {
        return false;
      }

      if (
        instructionPatterns.some((pattern) => pattern.test(value))
      ) {
        return false;
      }

      if (/^\d[\d\s.,/%-]*$/.test(value)) {
        return false;
      }

      if (/\b(exp|expiration|lot|batch|ndc|din|qty|quantity|warning|storage|ingredients?)\b/i.test(value)) {
        return false;
      }

      if (/^(?:extra|xtra|strength|directions?|instructions?|tablets?|capsules?|medicine|medication)$/i.test(value)) {
        return false;
      }

      const letters =
        (value.match(/[A-Za-z]/g) || []).length;

      const digits =
        (value.match(/\d/g) || []).length;

      if (letters < 3) {
        return false;
      }

      if (digits > letters) {
        return false;
      }

      return true;
    };


  // ==========================================
  // USE SCAN RESULTS
  // ==========================================

  const useScanResults =
    () => {

      setScanResultVisible(
        false
      );

      setScannerError('');

    };


  // ==========================================
  // RESCAN
  // ==========================================

  const rescanMedication =
    () => {

      setScanResultVisible(
        false
      );

      setBarcodeData(
        null
      );

      setOcrText(
        ''
      );

      setScanDetected({
        name: '',
        type: '',
        dosage: '',
        frequency: '',
        instructions: '',
      });

      setScannerError('');

      setTimeout(
        () => {
          openMedicationScanner();
        },
        200
      );

    };


  // ==========================================
  // MARK DOSE AS TAKEN
  // ==========================================

  const markAsTaken =
    async (id) => {

      try {

        const now =
          new Date();

        const today =
          getToday();


        const updated =
          medications.map(
            (medication) => {

              if (
                medication.id !== id
              ) {

                return medication;

              }


              const previousHistory =
                Array.isArray(
                  medication.doseHistory
                )
                  ? medication.doseHistory
                  : [];


              const alreadyTakenToday =
                previousHistory.some(
                  (entry) =>
                    entry.date ===
                      today &&
                    entry.status ===
                      'taken'
                );


              if (
                alreadyTakenToday
              ) {

                return {

                  ...medication,

                  takenToday:
                    true,

                };

              }


              const newDose = {

                id:
                  `${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2, 7)}`,

                date:
                  today,

                timestamp:
                  now.toISOString(),

                status:
                  'taken',

              };


              return {

                ...medication,

                takenToday:
                  true,

                lastTakenAt:
                  now.toISOString(),

                doseHistory: [

                  ...previousHistory,

                  newDose,

                ],

                updatedAt:
                  now.toISOString(),

              };

            }
          );


        const saved =
          await persistMedications(
            updated
          );


        if (saved) {

          setMedications(
            updated
          );

          if (
            historyMedication
          ) {

            const updatedHistoryMedication =
              updated.find(
                (item) =>
                  item.id ===
                  historyMedication.id
              );

            if (
              updatedHistoryMedication
            ) {

              setHistoryMedication(
                updatedHistoryMedication
              );

            }

          }

        }

      } catch (error) {

        console.log(
          'Medication taken error:',
          error
        );

      }

    };


  // ==========================================
  // UNMARK TODAY'S DOSE
  // ==========================================

  const unmarkAsTaken =
    async (id) => {

      try {

        const today =
          getToday();


        const updated =
          medications.map(
            (medication) => {

              if (
                medication.id !== id
              ) {

                return medication;

              }


              const history =
                Array.isArray(
                  medication.doseHistory
                )
                  ? medication.doseHistory
                  : [];


              const filteredHistory =
                history.filter(
                  (entry) =>
                    !(
                      entry.date ===
                        today &&
                      entry.status ===
                        'taken'
                    )
                );


              const lastRemainingDose =
                filteredHistory
                  .filter(
                    (entry) =>
                      entry.status ===
                      'taken'
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.timestamp) -
                      new Date(a.timestamp)
                  )[0];


              return {

                ...medication,

                takenToday:
                  false,

                lastTakenAt:
                  lastRemainingDose?.timestamp ||
                  null,

                doseHistory:
                  filteredHistory,

                updatedAt:
                  new Date().toISOString(),

              };

            }
          );


        const saved =
          await persistMedications(
            updated
          );


        if (saved) {

          setMedications(
            updated
          );

          if (
            historyMedication
          ) {

            const updatedHistoryMedication =
              updated.find(
                (item) =>
                  item.id ===
                  historyMedication.id
              );

            if (
              updatedHistoryMedication
            ) {

              setHistoryMedication(
                updatedHistoryMedication
              );

            }

          }

        }

      } catch (error) {

        console.log(
          'Medication unmark error:',
          error
        );

      }

    };


  // ==========================================
  // TOGGLE TAKEN
  // ==========================================

  const toggleTaken =
    (medication) => {

      if (
        medication.takenToday
      ) {

        unmarkAsTaken(
          medication.id
        );

      } else {

        markAsTaken(
          medication.id
        );

      }

    };


  // ==========================================
  // ENABLE / DISABLE MEDICATION REMINDER
  // ==========================================

  const toggleMedicationReminder =
    async (medication) => {
      const nextEnabled =
        medication.enabled === false;

      const updated =
        medications.map(
          (item) =>
            item.id === medication.id
              ? {
                  ...item,
                  enabled:
                    nextEnabled,
                  updatedAt:
                    new Date().toISOString(),
                }
              : item
        );

      const saved =
        await persistMedications(
          updated
        );

      if (!saved) {
        return;
      }

      if (!nextEnabled) {
        await cancelMedicationNotifications(
          medication
        );
      }

      const updatedTarget =
        updated.find(
          (item) =>
            item.id === medication.id
        );

      if (
        nextEnabled &&
        medicationRemindersEnabled
      ) {
        const notificationIds =
          await scheduleMedicationNotifications(
            updatedTarget
          );

        updatedTarget.notificationIds =
          notificationIds;
        updatedTarget.notificationId =
          notificationIds[0] || null;
      } else {
        updatedTarget.notificationIds =
          [];
        updatedTarget.notificationId =
          null;
      }

      await persistMedications(
        updated
      );

      setMedications(
        [...updated]
      );
    };


  // ==========================================
  // SHOW HISTORY
  // ==========================================

  const openHistory =
    (medication) => {

      setHistoryMedication(
        medication
      );

      setHistoryVisible(
        true
      );

    };


  // ==========================================
  // FORMAT TIME
  // ==========================================

  const formatTime =
    (timestamp) => {

      if (!timestamp) {

        return '';

      }


      return new Date(
        timestamp
      ).toLocaleTimeString(
        [],
        {
          hour:
            'numeric',

          minute:
            '2-digit',
        }
      );

    };


  // ==========================================
  // FORMAT DATE
  // ==========================================

  const formatDate =
    (dateString) => {

      if (!dateString) {

        return '';

      }


      const date =
        new Date(
          `${dateString}T12:00:00`
        );


      return date.toLocaleDateString(
        [],
        {
          month:
            'short',

          day:
            'numeric',

          year:
            'numeric',
        }
      );

    };


  // ==========================================
  // TODAY'S COUNT
  // ==========================================

  const takenTodayCount =
    medications.filter(
      (medication) =>
        medication.takenToday
    ).length;


  const adherencePercentage =
    medications.length > 0
      ? Math.round(
          (
            takenTodayCount /
            medications.length
          ) * 100
        )
      : 0;


  // ==========================================
  // CAMERA SCREEN
  // ==========================================

  const renderScanner = () => (

      <View style={styles.scannerScreen}>

        <CameraView
          ref={cameraRef}
          style={styles.fullCamera}
          facing="back"
          enableTorch={flashEnabled}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'code128',
              'code39',
              'code93',
              'datamatrix',
              'pdf417',
            ],
          }}
          onBarcodeScanned={
            handleBarcodeScanned
          }
        >

          {/* ================================= TOP ================================= */}

          <View style={styles.scannerTop}>

            <Text
              style={styles.scannerTitle}
            >
              Scan Medication
            </Text>


            <TouchableOpacity
              style={
                styles.flashButton
              }
              onPress={() =>
                setFlashEnabled(
                  (value) =>
                    !value
                )
              }
              accessibilityRole="button"
              accessibilityLabel={
                flashEnabled
                  ? 'Turn flash off'
                  : 'Turn flash on'
              }
            >

              <Ionicons
                name={
                  flashEnabled
                    ? 'flash'
                    : 'flash-off'
                }
                size={
                  largeText
                    ? 24
                    : 20
                }
                color="#FFFFFF"
                style={styles.scanIcon}
              />

            </TouchableOpacity>

          </View>


          {/* ================================= SCAN AREA ================================= */}

          <View style={styles.scanArea}>

            <View style={styles.scanFrame}>

              <View
                style={styles.scanCorners}
              />

              <Ionicons
                name="scan-outline"
                size={
                  largeText
                    ? 52
                    : 44
                }
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.scanInstruction
                }
              >
                Place the medication label in the frame.
              </Text>

            </View>

            {barcodeData && (

              <View
                style={
                  styles.barcodeDetected
                }
              >

                <Ionicons
                  name="barcode"
                  size={
                    largeText
                      ? 20
                      : 17
                  }
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.barcodeDetectedText
                  }
                >
                  Barcode detected
                </Text>

              </View>

            )}

          </View>


          {/* ================================= BOTTOM ================================= */}

          <View
            style={
              styles.scannerBottom
            }
          >

            <Text
              style={
                styles.scannerHint
              }
            >
              For best accuracy, scan the back of the box with the barcode visible. The front can also be scanned.
            </Text>


            <TouchableOpacity
              style={[
                styles.scanButton,
                scanning &&
                  styles.scanButtonDisabled,
              ]}
              onPress={
                captureMedicationLabel
              }
              disabled={scanning}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={
                scanning
                  ? 'Reading medication label'
                  : 'Capture and read medication label'
              }
            >

              {scanning ? (

                <>

                  <ActivityIndicator
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.scanButtonText
                    }
                  >
                    Reading label...
                  </Text>

                </>

              ) : (

                <>

                  <Ionicons
                    name="camera"
                    size={
                      largeText
                        ? 25
                        : 21
                    }
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.scanButtonText
                    }
                  >
                    Capture & Read Label
                  </Text>

                </>

              )}

            </TouchableOpacity>

          </View>

        </CameraView>

      </View>

  );


  // ==========================================
  // MAIN UI
  // ==========================================

  return (

    <SafeAreaView
      style={styles.safeArea}
    >

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          true
        }
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        alwaysBounceVertical={true}
      >

        {/* ======================================
            HEADER
        ====================================== */}

        <View
          style={styles.headerRow}
        >

          <View
            style={
              styles.headerTextContainer
            }
          >

            <Text
              style={styles.headerTitle}
            >
              My Medications
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Your doses for today.
            </Text>

          </View>

        </View>


        {/* ======================================
            TODAY SUMMARY
        ====================================== */}

        <View
          style={styles.todayCard}
        >

          <View
            style={styles.todayIcon}
          >

            <Ionicons
              name="medical"
              size={
                largeText
                  ? 29
                  : 25
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />

          </View>


          <View
            style={styles.todayInfo}
          >

            <Text
              style={styles.todayTitle}
            >
              Today's doses
            </Text>

            <Text
              style={
                styles.todaySubtitle
              }
            >
              {takenTodayCount} of{' '}
              {medications.length}{' '}
              medications marked taken
            </Text>

          </View>


          <View
            style={styles.todayBadge}
          >

            <Text
              style={
                styles.todayBadgeText
              }
            >
              {adherencePercentage}%
            </Text>

          </View>

        </View>


        {showCamera ? (

          <View
            style={styles.inlineScannerContainer}
          >
            {renderScanner()}
          </View>

        ) : (

          <TouchableOpacity
            style={styles.scanCard}
            onPress={openMedicationScanner}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Scan a medication label"
          >

            <View style={styles.scanIconContainer}>
              <Ionicons
                name="scan-outline"
                size={largeText ? 32 : 27}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.scanInfo}>
              <Text style={styles.scanTitle}>
                Scan a Medication Label
              </Text>
              <Text style={styles.scanSubtitle}>
                Read the label details.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={largeText ? 26 : 21}
              color="#FFFFFF"
            />

          </TouchableOpacity>

        )}


        <View
          style={styles.notificationSettingsCard}
        >
          <View
            style={styles.notificationSettingsIcon}
          >
            <Ionicons
              name="notifications-outline"
              size={
                largeText
                  ? 25
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
            style={styles.notificationSettingsInfo}
          >
            <Text
              style={styles.notificationSettingsTitle}
            >
              Medication reminders
            </Text>

            <Text
              style={styles.notificationSettingsText}
            >
              {medicationRemindersEnabled
                ? 'On'
                : 'Off — manage in Notifications.'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.notificationSettingsButton}
            onPress={() => {
              const parent =
                navigation?.getParent?.();

              if (
                parent?.navigate
              ) {
                parent.navigate(
                  'Settings',
                  {
                    screen:
                      'Notifications',
                  }
                );
                return;
              }

              if (
                navigation?.navigate
              ) {
                navigation.navigate(
                  'Notifications'
                );
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Open notification settings"
          >
            <Ionicons
              name="settings-outline"
              size={
                largeText
                  ? 22
                  : 18
              }
              color={
                highContrast
                  ? '#000000'
                  : '#6366F1'
              }
            />
          </TouchableOpacity>
        </View>

        {/* ======================================
            HISTORY HEADER
        ====================================== */}

        <View
          style={styles.historyHeader}
        >

          <View
            style={styles.historyHeaderText}
          >

            <Text
              style={styles.sectionTitle}
            >
              Medications
            </Text>

            <Text
              style={
                styles.historySubtitle
              }
            >
              Medication details and reminders from your caregiver.
            </Text>

          </View>


          <View
            style={styles.countBadge}
          >

            <Text
              style={styles.countText}
            >
              {medications.length}
            </Text>

          </View>

        </View>


        {/* ======================================
            LOADING
        ====================================== */}

        {loading && (

          <View
            style={styles.loadingCard}
          >

            <ActivityIndicator
              size="small"
              color={
                highContrast
                  ? '#000000'
                  : '#6366F1'
              }
            />

            <Text
              style={styles.loadingText}
            >
              Loading medications...
            </Text>

          </View>

        )}


        {/* ======================================
            EMPTY STATE
        ====================================== */}

        {!loading &&
          medications.length === 0 && (

            <View
              style={styles.emptyCard}
            >

              <View
                style={styles.emptyIcon}
              >

                <Ionicons
                  name="medical-outline"
                  size={
                    largeText
                      ? 35
                      : 29
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#818CF8'
                  }
                />

              </View>


              <Text
                style={styles.emptyTitle}
              >
                No medications yet
              </Text>


              <Text
                style={styles.emptyText}
              >
                Your caregiver will add your medication details and reminder schedule here.
              </Text>

            </View>

          )}


        {/* ======================================
            MEDICATION LIST
        ====================================== */}

        {!loading &&
          medications.map(
            (medication) => (

              <View
                key={medication.id}
                style={[
                  styles.medicationCard,
                  medication.takenToday &&
                    styles.medicationCardTaken,
                ]}
              >

                {/* TOP ROW */}

                <View
                  style={
                    styles.medicationTopRow
                  }
                >

                  <View
                    style={
                      styles.medicationIcon
                    }
                  >

                    <Ionicons
                      name="medical"
                      size={
                        largeText
                          ? 25
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
                    style={
                      styles.medicationInfo
                    }
                  >

                    <Text
                      style={
                        styles.medicationName
                      }
                    >
                      {medication.name}
                    </Text>

                    <Text
                      style={
                        styles.medicationDosage
                      }
                    >
                      {medication.dosage}
                    </Text>

                    <Text
                      style={
                        styles.medicationType
                      }
                    >
                      {medication.type ||
                        medication.medicationType ||
                        'Type not specified'}
                    </Text>

                  </View>

                </View>


                {/* FREQUENCY */}

                <View
                  style={
                    styles.frequencyInfoBox
                  }
                >

                  <Ionicons
                    name="repeat-outline"
                    size={
                      largeText
                        ? 20
                        : 16
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : '#6366F1'
                    }
                  />

                  <Text
                    style={
                      styles.frequencyInfoText
                    }
                  >
                    {medication.frequency ||
                      'As directed'}
                  </Text>

                </View>


                {/* REMINDER */}

                {medication.frequency !== 'As needed' && (
                  <View
                    style={
                      styles.medicationReminderRow
                    }
                  >
                    <View
                      style={
                        styles.medicationReminderInfo
                      }
                    >
                      <Ionicons
                        name="notifications-outline"
                        size={
                          largeText
                            ? 20
                            : 16
                        }
                        color={
                          highContrast
                            ? '#000000'
                            : '#6366F1'
                        }
                      />

                      <Text
                        style={
                          styles.medicationReminderText
                        }
                      >
                        Reminder:{' '}
                        {medication.time ||
                          '9:00 AM'}
                        {medication.frequency ===
                          'Twice daily'
                          ? ` and ${medication.secondTime || '9:00 PM'}`
                          : ''}
                      </Text>
                    </View>

                    <Switch
                      value={
                        medication.enabled !== false &&
                        medicationRemindersEnabled
                      }
                      onValueChange={() =>
                        toggleMedicationReminder(
                          medication
                        )
                      }
                      disabled={
                        !medicationRemindersEnabled
                      }
                      trackColor={{
                        false:
                          '#D1D5DB',
                        true:
                          highContrast
                            ? '#000000'
                            : '#A5B4FC',
                      }}
                      thumbColor={
                        medication.enabled !== false &&
                        medicationRemindersEnabled
                          ? highContrast
                            ? '#FFFFFF'
                            : '#5B6CFF'
                          : '#F9FAFB'
                      }
                      accessibilityRole="switch"
                      accessibilityLabel={
                        `${medication.name} medication reminder`
                      }
                      accessibilityState={{
                        checked:
                          medication.enabled !== false &&
                          medicationRemindersEnabled,
                      }}
                    />
                  </View>
                )}

                {/* INSTRUCTIONS */}

                <View
                  style={
                    styles.instructionBox
                  }
                >

                  <Ionicons
                    name="time-outline"
                    size={
                      largeText
                        ? 20
                        : 16
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : '#4B5563'
                    }
                  />

                  <Text
                    style={
                      styles.instructionText
                    }
                  >
                    {medication.instructions ||
                      medication.notes ||
                      "Follow your caregiver\'s instructions."}
                  </Text>

                </View>


                {/* LAST TAKEN */}

                {medication.lastTakenAt && (

                  <View
                    style={
                      styles.lastTakenRow
                    }
                  >

                    <Ionicons
                      name="checkmark-circle"
                      size={
                        largeText
                          ? 18
                          : 14
                      }
                      color={
                        highContrast
                          ? '#000000'
                          : '#34C759'
                      }
                    />

                    <Text
                      style={
                        styles.lastTakenText
                      }
                    >
                      Last taken{' '}
                      {formatDate(
                        medication
                          .lastTakenAt
                          .split('T')[0]
                      )}{' '}
                      at{' '}
                      {formatTime(
                        medication.lastTakenAt
                      )}
                    </Text>

                  </View>

                )}


                {/* HISTORY BUTTON */}

                <TouchableOpacity
                  style={
                    styles.historyButton
                  }
                  onPress={() =>
                    openHistory(
                      medication
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    `View dose history for ${medication.name}`
                  }
                >

                  <Ionicons
                    name="time-outline"
                    size={
                      largeText
                        ? 21
                        : 17
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : '#6366F1'
                    }
                  />

                  <Text
                    style={
                      styles.historyButtonText
                    }
                  >
                    View dose history
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={
                      largeText
                        ? 20
                        : 16
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : '#6366F1'
                    }
                  />

                </TouchableOpacity>


                {/* TAKEN BUTTON */}

                <TouchableOpacity
                  style={[
                    styles.takenButton,
                    medication.takenToday &&
                      styles.takenButtonActive,
                  ]}
                  onPress={() =>
                    toggleTaken(
                      medication
                    )
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{
                    checked:
                      !!medication.takenToday,
                  }}
                  accessibilityLabel={
                    medication.takenToday
                      ? `${medication.name} taken today`
                      : `Mark ${medication.name} as taken`
                  }
                >

                  <Ionicons
                    name={
                      medication.takenToday
                        ? 'checkmark-circle'
                        : 'checkmark-circle-outline'
                    }
                    size={
                      largeText
                        ? 24
                        : 20
                    }
                    color={
                      medication.takenToday
                        ? '#FFFFFF'
                        : highContrast
                          ? '#000000'
                          : '#5B6CFF'
                    }
                  />

                  <Text
                    style={[
                      styles.takenButtonText,
                      medication.takenToday &&
                        styles.takenButtonTextActive,
                    ]}
                  >
                    {medication.takenToday
                      ? 'Taken today'
                      : 'Mark as taken'}
                  </Text>

                </TouchableOpacity>

              </View>

            )
          )}

      </ScrollView>


      {/* ==========================================
          OCR REVIEW MODAL
      ========================================== */}

      <Modal
        visible={
          scanResultVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setScanResultVisible(
            false
          )
        }
      >

        <View
          style={styles.modalOverlay}
        >

          <View
            style={
              styles.scanResultModal
            }
          >

            <View
              style={styles.modalHeader}
            >

              <View
                style={
                  styles.modalHeaderText
                }
              >

                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Label Read
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Review the label details.
                </Text>

              </View>


              <TouchableOpacity
                style={
                  styles.modalCloseButton
                }
                onPress={() =>
                  setScanResultVisible(
                    false
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Close label review"
              >

                <Ionicons
                  name="close"
                  size={
                    largeText
                      ? 27
                      : 22
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#555555'
                  }
                />

              </TouchableOpacity>

            </View>


            {/* WARNING */}

            <View
              style={
                styles.verificationWarning
              }
            >

              <Ionicons
                name="warning-outline"
                size={
                  largeText
                    ? 24
                    : 20
                }
                color={
                  highContrast
                    ? '#000000'
                    : '#B45309'
                }
              />

              <Text
                style={
                  styles.verificationWarningText
                }
              >
                Check these results with the label or caregiver.
              </Text>

            </View>


            {/* BARCODE */}

            {barcodeData && (

              <View
                style={
                  styles.detectedBarcodeBox
                }
              >

                <Ionicons
                  name="barcode-outline"
                  size={
                    largeText
                      ? 23
                      : 18
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#6366F1'
                  }
                />

                <View
                  style={
                    styles.detectedBarcodeInfo
                  }
                >

                  <Text
                    style={
                      styles.detectedBarcodeTitle
                    }
                  >
                    Barcode detected
                  </Text>

                  <Text
                    style={
                      styles.detectedBarcodeText
                    }
                    numberOfLines={1}
                  >
                    {barcodeData.data}
                  </Text>

                </View>

              </View>

            )}


            {/* DETECTED DETAILS */}

            <View style={styles.detectedDetailsCard}>
              <Text style={styles.detectedDetailsTitle}>
                Medication details
              </Text>

              <View style={styles.detectedDetailRow}>
                <Text style={styles.detectedDetailLabel}>Medication</Text>
                <Text style={styles.detectedDetailValue}>
                  {scanDetected.name || 'Not detected'}
                </Text>
              </View>
            </View>


            {/* OCR PREVIEW */}

            <Text
              style={
                styles.ocrPreviewLabel
              }
            >
              Label text
            </Text>


            <ScrollView
              style={
                styles.ocrPreview
              }
              nestedScrollEnabled
              showsVerticalScrollIndicator={
                true
              }
            >

              <Text
                style={
                  styles.ocrPreviewText
                }
              >
                {ocrText ||
                  'No text was detected.'}
              </Text>

            </ScrollView>


            {/* ACTIONS */}

            <TouchableOpacity
              style={
                styles.useScanButton
              }
              onPress={
                useScanResults
              }
              accessibilityRole="button"
              accessibilityLabel="Close medication scan results"
            >

              <Ionicons
                name="checkmark-circle-outline"
                size={
                  largeText
                    ? 24
                    : 20
                }
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.useScanButtonText
                }
              >
                Done
              </Text>

            </TouchableOpacity>


            <TouchableOpacity
              style={
                styles.rescanButton
              }
              onPress={
                rescanMedication
              }
              accessibilityRole="button"
              accessibilityLabel="Scan medication again"
            >

              <Ionicons
                name="scan-outline"
                size={
                  largeText
                    ? 22
                    : 18
                }
                color={
                  highContrast
                    ? '#000000'
                    : '#6366F1'
                }
              />

              <Text
                style={
                  styles.rescanButtonText
                }
              >
                Scan Again
              </Text>

            </TouchableOpacity>


          </View>

        </View>

      </Modal>


      {/* ==========================================
          DOSE HISTORY MODAL
      ========================================== */}

      <Modal
        visible={
          historyVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() => {

          setHistoryVisible(
            false
          );

          setHistoryMedication(
            null
          );

        }}
      >

        <View
          style={styles.modalOverlay}
        >

          <View
            style={
              styles.historyModal
            }
          >

            <View
              style={styles.modalHeader}
            >

              <View
                style={
                  styles.historyModalTitleArea
                }
              >

                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  Dose History
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                  numberOfLines={2}
                >
                  {historyMedication?.name ||
                    'Medication'}
                </Text>

              </View>


              <TouchableOpacity
                style={
                  styles.modalCloseButton
                }
                onPress={() => {

                  setHistoryVisible(
                    false
                  );

                  setHistoryMedication(
                    null
                  );

                }}
                accessibilityRole="button"
                accessibilityLabel="Close dose history"
              >

                <Ionicons
                  name="close"
                  size={
                    largeText
                      ? 27
                      : 22
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#555555'
                  }
                />

              </TouchableOpacity>

            </View>


            {/* HISTORY */}

            <ScrollView
              style={
                styles.historyScroll
              }
              showsVerticalScrollIndicator={
                false
              }
            >

              {(
                historyMedication
                  ?.doseHistory || []
              ).length === 0 ? (

                <View
                  style={
                    styles.noHistory
                  }
                >

                  <View
                    style={
                      styles.noHistoryIcon
                    }
                  >

                    <Ionicons
                      name="time-outline"
                      size={
                        largeText
                          ? 34
                          : 27
                      }
                      color={
                        highContrast
                          ? '#000000'
                          : '#818CF8'
                      }
                    />

                  </View>


                  <Text
                    style={
                      styles.noHistoryTitle
                    }
                  >
                    No doses recorded yet
                  </Text>


                  <Text
                    style={
                      styles.noHistoryText
                    }
                  >
                    When you mark this medication as taken, the dose will appear here.
                  </Text>

                </View>

              ) : (

                [
                  ...(
                    historyMedication
                      .doseHistory || []
                  ),
                ]
                  .filter(
                    (dose) =>
                      dose.status ===
                      'taken'
                  )
                  .sort(
                    (a, b) =>
                      new Date(
                        b.timestamp
                      ) -
                      new Date(
                        a.timestamp
                      )
                  )
                  .map(
                    (dose) => (

                      <View
                        key={dose.id}
                        style={
                          styles.historyEntry
                        }
                      >

                        <View
                          style={
                            styles.historyEntryIcon
                          }
                        >

                          <Ionicons
                            name="checkmark"
                            size={
                              largeText
                                ? 22
                                : 18
                            }
                            color={
                              highContrast
                                ? '#000000'
                                : '#34C759'
                            }
                          />

                        </View>


                        <View
                          style={
                            styles.historyEntryInfo
                          }
                        >

                          <Text
                            style={
                              styles.historyEntryDate
                            }
                          >
                            {formatDate(
                              dose.date
                            )}
                          </Text>

                          <Text
                            style={
                              styles.historyEntryTime
                            }
                          >
                            Taken at{' '}
                            {formatTime(
                              dose.timestamp
                            )}
                          </Text>

                        </View>


                        <View
                          style={
                            styles.takenPill
                          }
                        >

                          <Text
                            style={
                              styles.takenPillText
                            }
                          >
                            Taken
                          </Text>

                        </View>

                      </View>

                    )
                  )

              )}

            </ScrollView>

          </View>

        </View>

      </Modal>

    </SafeAreaView>

  );

}


// ==========================================
// ACCESSIBILITY-AWARE STYLES
// ==========================================

const createStyles =
  (
    largeText,
    highContrast
  ) => {

    const textColor =
      highContrast
        ? '#000000'
        : '#333333';

    const secondaryTextColor =
      highContrast
        ? '#222222'
        : '#666666';

    const mutedTextColor =
      highContrast
        ? '#333333'
        : '#777777';

    const borderColor =
      highContrast
        ? '#000000'
        : '#E5E7EB';

    const cardBackground =
      '#FFFFFF';

    const screenBackground =
      highContrast
        ? '#FFFFFF'
        : '#FAF8F5';

    const softBackground =
      highContrast
        ? '#FFFFFF'
        : '#EEF0FF';

    const inputBackground =
      '#FFFFFF';

    const primary =
      highContrast
        ? '#000000'
        : '#6366F1';

    const accent =
      highContrast
        ? '#000000'
        : '#5B6CFF';

    const normalOrLarge =
      (
        normal,
        large
      ) =>
        largeText
          ? large
          : normal;


    return StyleSheet.create({

      // ========================================
      // MAIN
      // ========================================

      safeArea: {
        flex: 1,
        backgroundColor:
          screenBackground,
      },

      scrollView: {
        flex: 1,
      },

      content: {
        flexGrow: 1,
        padding:
          largeText
            ? 22
            : 20,
        paddingBottom:
          largeText
            ? 115
            : 100,
      },


      // ========================================
      // HEADER
      // ========================================

      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 19
            : 15,
      },

      headerTextContainer: {
        flex: 1,
      },

      headerTitle: {
        fontSize:
          normalOrLarge(
            26,
            32
          ),
        lineHeight:
          normalOrLarge(
            32,
            39
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#111827',
      },

      headerSubtitle: {
        fontSize:
          normalOrLarge(
            14,
            18
          ),
        lineHeight:
          normalOrLarge(
            20,
            26
          ),
        color:
          secondaryTextColor,
        marginTop:
          largeText
            ? 5
            : 2,
        fontWeight: '500',
      },


      // ========================================
      // TODAY
      // ========================================

      todayCard: {
        backgroundColor:
          cardBackground,
        borderRadius:
          largeText
            ? 20
            : 16,
        padding:
          largeText
            ? 18
            : 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
        marginBottom:
          largeText
            ? 16
            : 12,
      },

      todayIcon: {
        width:
          largeText
            ? 54
            : 47,
        height:
          largeText
            ? 54
            : 47,
        borderRadius:
          largeText
            ? 17
            : 24,
        backgroundColor:
          softBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight:
          largeText
            ? 14
            : 11,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      todayInfo: {
        flex: 1,
        paddingRight:
          largeText
            ? 8
            : 3,
      },

      todayTitle: {
        fontSize:
          normalOrLarge(
            15,
            20
          ),
        lineHeight:
          normalOrLarge(
            20,
            25
          ),
        fontWeight: '800',
        color:
          textColor,
      },

      todaySubtitle: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            23
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? 5
            : 3,
      },

      todayBadge: {
        minWidth:
          largeText
            ? 58
            : 45,
        height:
          largeText
            ? 58
            : 45,
        borderRadius:
          largeText
            ? 18
            : 23,
        backgroundColor:
          softBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      todayBadgeText: {
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        fontWeight: '800',
        color:
          accent,
      },


      // ========================================
      // SCAN CARD
      // ========================================

      scanCard: {
        backgroundColor:
          primary,
        borderRadius:
          largeText
            ? 20
            : 16,
        padding:
          largeText
            ? 18
            : 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 28
            : 22,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      scanIconContainer: {
        width:
          largeText
            ? 56
            : 46,
        height:
          largeText
            ? 56
            : 46,
        borderRadius:
          largeText
            ? 18
            : 23,
        backgroundColor:
          highContrast
            ? '#000000'
            : 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight:
          largeText
            ? 14
            : 11,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          '#FFFFFF',
      },

      scanInfo: {
        flex: 1,
      },

      scanTitle: {
        fontSize:
          normalOrLarge(
            15,
            20
          ),
        lineHeight:
          normalOrLarge(
            19,
            26
          ),
        fontWeight: '800',
        color: '#FFFFFF',
      },

      scanSubtitle: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            23
          ),
        color:
          '#FFFFFF',
        marginTop:
          largeText
            ? 5
            : 3,
        opacity:
          0.92,
      },


      // ========================================
      // FORM
      // ========================================

      formHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom:
          largeText
            ? 5
            : 1,
      },

      sectionTitle: {
        fontSize:
          normalOrLarge(
            18,
            22
          ),
        lineHeight:
          normalOrLarge(
            23,
            29
          ),
        fontWeight: '800',
        color:
          textColor,
        marginBottom:
          largeText
            ? 14
            : 12,
      },

      cancelEdit: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            16,
            22
          ),
        fontWeight: '800',
        color:
          accent,
        marginBottom:
          largeText
            ? 14
            : 12,
      },

      inputGroup: {
        marginBottom:
          largeText
            ? 18
            : 14,
      },

      label: {
        fontSize:
          normalOrLarge(
            13,
            17
          ),
        lineHeight:
          normalOrLarge(
            18,
            24
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#374151',
        marginBottom:
          largeText
            ? 9
            : 7,
      },

      inputWrapper: {
        minHeight:
          largeText
            ? 58
            : 48,
        backgroundColor:
          inputBackground,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
        borderRadius:
          largeText
            ? 15
            : 12,
        paddingHorizontal:
          largeText
            ? 15
            : 13,
        flexDirection: 'row',
        alignItems: 'center',
      },

      multilineWrapper: {
        alignItems: 'flex-start',
        paddingTop:
          largeText
            ? 15
            : 12,
        paddingBottom:
          largeText
            ? 15
            : 12,
        minHeight:
          largeText
            ? 86
            : 79,
      },

      multilineIcon: {
        marginTop: 2,
      },

      input: {
        flex: 1,
        paddingHorizontal:
          largeText
            ? 11
            : 9,
        paddingVertical:
          largeText
            ? 12
            : 10,
        fontSize:
          normalOrLarge(
            14,
            18
          ),
        lineHeight:
          normalOrLarge(
            20,
            25
          ),
        color:
          highContrast
            ? '#000000'
            : '#1F2937',
      },

      multilineInput: {
        minHeight:
          largeText
            ? 58
            : 55,
        textAlignVertical: 'top',
      },


      // ========================================
      // FREQUENCY
      // ========================================

      frequencyRow: {
        flexDirection: 'row',
        gap:
          largeText
            ? 9
            : 7,
      },

      frequencyButton: {
        flex: 1,
        minHeight:
          largeText
            ? 55
            : 43,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#D9DCFF',
        backgroundColor:
          '#FFFFFF',
        borderRadius:
          largeText
            ? 14
            : 11,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal:
          largeText
            ? 8
            : 6,
      },

      frequencyButtonActive: {
        backgroundColor:
          highContrast
            ? '#000000'
            : '#EEF0FF',
        borderColor:
          highContrast
            ? '#000000'
            : '#818CF8',
      },

      frequencyText: {
        fontSize:
          normalOrLarge(
            10,
            15
          ),
        lineHeight:
          normalOrLarge(
            14,
            20
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#6B7280',
        textAlign: 'center',
      },

      frequencyTextActive: {
        color:
          highContrast
            ? '#FFFFFF'
            : '#4F46E5',
      },


      // ========================================
      // SAVE
      // ========================================

      saveButton: {
        minHeight:
          largeText
            ? 58
            : 50,
        backgroundColor:
          primary,
        borderRadius:
          largeText
            ? 16
            : 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginTop:
          largeText
            ? 5
            : 3,
        marginBottom:
          largeText
            ? 34
            : 27,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      saveButtonDisabled: {
        opacity: 0.65,
      },

      saveButtonText: {
        color: '#FFFFFF',
        fontSize:
          normalOrLarge(
            15,
            19
          ),
        lineHeight:
          normalOrLarge(
            20,
            25
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 9
            : 7,
      },


      // ========================================
      // HISTORY HEADER
      // ========================================

      historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 17
            : 13,
      },

      historyHeaderText: {
        flex: 1,
        paddingRight:
          largeText
            ? 10
            : 5,
      },

      historySubtitle: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            23
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? -8
            : -7,
        maxWidth: 310,
      },

      countBadge: {
        minWidth:
          largeText
            ? 42
            : 32,
        height:
          largeText
            ? 42
            : 32,
        paddingHorizontal:
          largeText
            ? 11
            : 8,
        borderRadius:
          largeText
            ? 14
            : 16,
        backgroundColor:
          softBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      countText: {
        color:
          accent,
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        fontWeight: '800',
      },


      // ========================================
      // LOADING
      // ========================================

      loadingCard: {
        backgroundColor:
          cardBackground,
        borderRadius:
          largeText
            ? 20
            : 16,
        padding:
          largeText
            ? 32
            : 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
      },

      loadingText: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? 10
            : 8,
      },


      // ========================================
      // EMPTY
      // ========================================

      emptyCard: {
        backgroundColor:
          cardBackground,
        borderRadius:
          largeText
            ? 20
            : 16,
        padding:
          largeText
            ? 32
            : 25,
        alignItems: 'center',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
      },

      emptyIcon: {
        width:
          largeText
            ? 72
            : 60,
        height:
          largeText
            ? 72
            : 60,
        borderRadius:
          largeText
            ? 18
            : 30,
        backgroundColor:
          softBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 14
            : 11,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      emptyTitle: {
        fontSize:
          normalOrLarge(
            16,
            21
          ),
        lineHeight:
          normalOrLarge(
            21,
            27
          ),
        fontWeight: '800',
        color:
          textColor,
        textAlign: 'center',
      },

      emptyText: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            18,
            25
          ),
        color:
          mutedTextColor,
        textAlign: 'center',
        marginTop:
          largeText
            ? 8
            : 6,
      },


      // ========================================
      // MEDICATION CARD
      // ========================================

      medicationCard: {
        backgroundColor:
          cardBackground,
        borderRadius:
          largeText
            ? 20
            : 16,
        padding:
          largeText
            ? 19
            : 15,
        marginBottom:
          largeText
            ? 16
            : 12,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
      },

      medicationCardTaken: {
        borderColor:
          highContrast
            ? '#000000'
            : '#C7EFD2',
      },

      medicationTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },

      medicationIcon: {
        width:
          largeText
            ? 52
            : 43,
        height:
          largeText
            ? 52
            : 43,
        borderRadius:
          largeText
            ? 17
            : 22,
        backgroundColor:
          softBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight:
          largeText
            ? 13
            : 11,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      medicationInfo: {
        flex: 1,
        paddingRight:
          largeText
            ? 5
            : 2,
      },

      medicationName: {
        fontSize:
          normalOrLarge(
            16,
            21
          ),
        lineHeight:
          normalOrLarge(
            21,
            27
          ),
        fontWeight: '800',
        color:
          textColor,
      },

      medicationType: {
        fontSize:
          normalOrLarge(
            12,
            16
          ),
        lineHeight:
          normalOrLarge(
            17,
            22
          ),
        fontWeight: '600',
        color:
          highContrast
            ? '#000000'
            : '#6B7280',
        marginTop: 2,
      },


      medicationDosage: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        color:
          secondaryTextColor,
        marginTop:
          largeText
            ? 4
            : 3,
      },

      editButton: {
        width:
          largeText
            ? 43
            : 34,
        height:
          largeText
            ? 43
            : 34,
        borderRadius:
          largeText
            ? 14
            : 17,
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#F3F4FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft:
          largeText
            ? 5
            : 4,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      deleteButton: {
        width:
          largeText
            ? 43
            : 34,
        height:
          largeText
            ? 43
            : 34,
        borderRadius:
          largeText
            ? 14
            : 17,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft:
          largeText
            ? 4
            : 3,
      },


      // ========================================
      // FREQUENCY INFO
      // ========================================

      frequencyInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#F5F5FF',
        borderRadius:
          largeText
            ? 13
            : 10,
        paddingHorizontal:
          largeText
            ? 13
            : 10,
        paddingVertical:
          largeText
            ? 11
            : 8,
        marginTop:
          largeText
            ? 14
            : 12,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      frequencyInfoText: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            22
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#5B5BD6',
        marginLeft:
          largeText
            ? 8
            : 6,
      },


      // ========================================
      // NOTIFICATION SETTINGS
      // ========================================

      notificationSettingsCard: {
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#EEF0FF',
        borderRadius:
          largeText
            ? 18
            : 15,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#D9DCFF',
        padding:
          largeText
            ? 15
            : 12,
        flexDirection:
          'row',
        alignItems:
          'center',
        marginBottom:
          largeText
            ? 18
            : 14,
      },

      notificationSettingsIcon: {
        width:
          largeText
            ? 48
            : 40,
        height:
          largeText
            ? 48
            : 40,
        borderRadius:
          largeText
            ? 15
            : 12,
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#FFFFFF',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#D9DCFF',
        justifyContent:
          'center',
        alignItems:
          'center',
        marginRight:
          largeText
            ? 12
            : 9,
      },

      notificationSettingsInfo: {
        flex: 1,
        paddingRight:
          largeText
            ? 7
            : 4,
      },

      notificationSettingsTitle: {
        fontSize:
          normalOrLarge(
            13,
            17
          ),
        lineHeight:
          normalOrLarge(
            18,
            23
          ),
        fontWeight:
          '800',
        color:
          highContrast
            ? '#000000'
            : '#1F2937',
      },

      notificationSettingsText: {
        fontSize:
          normalOrLarge(
            10,
            15
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        color:
          highContrast
            ? '#222222'
            : '#5F6368',
        marginTop:
          largeText
            ? 3
            : 2,
      },

      notificationSettingsButton: {
        width:
          largeText
            ? 45
            : 36,
        height:
          largeText
            ? 45
            : 36,
        borderRadius:
          largeText
            ? 14
            : 11,
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#FFFFFF',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#D9DCFF',
        justifyContent:
          'center',
        alignItems:
          'center',
      },

      reminderTimeRow: {
        flexDirection:
          'row',
        gap:
          largeText
            ? 9
            : 7,
      },

      reminderTimeInputWrapper: {
        flex: 1,
      },

      helperText: {
        fontSize:
          normalOrLarge(
            10,
            15
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? 6
            : 5,
      },

      reminderToggleCard: {
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#F5F5FF',
        borderRadius:
          largeText
            ? 16
            : 13,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#E0E2FF',
        padding:
          largeText
            ? 14
            : 11,
        flexDirection:
          'row',
        alignItems:
          'center',
        marginBottom:
          largeText
            ? 18
            : 14,
      },

      reminderToggleIcon: {
        width:
          largeText
            ? 45
            : 37,
        height:
          largeText
            ? 45
            : 37,
        borderRadius:
          largeText
            ? 14
            : 11,
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#FFFFFF',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#D9DCFF',
        justifyContent:
          'center',
        alignItems:
          'center',
        marginRight:
          largeText
            ? 10
            : 8,
      },

      reminderToggleInfo: {
        flex: 1,
        paddingRight:
          largeText
            ? 7
            : 4,
      },

      reminderToggleTitle: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        fontWeight:
          '800',
        color:
          textColor,
      },

      reminderToggleText: {
        fontSize:
          normalOrLarge(
            10,
            14
          ),
        lineHeight:
          normalOrLarge(
            15,
            20
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? 3
            : 2,
      },

      // ========================================
      // MEDICATION REMINDER
      // ========================================

      medicationReminderRow: {
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#F5F5FF',
        borderRadius:
          largeText
            ? 13
            : 10,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#E0E2FF',
        paddingHorizontal:
          largeText
            ? 12
            : 9,
        paddingVertical:
          largeText
            ? 9
            : 7,
        marginTop:
          largeText
            ? 10
            : 8,
        flexDirection:
          'row',
        alignItems:
          'center',
      },

      medicationReminderInfo: {
        flex: 1,
        flexDirection:
          'row',
        alignItems:
          'center',
        paddingRight:
          largeText
            ? 8
            : 5,
      },

      medicationReminderText: {
        flex: 1,
        fontSize:
          normalOrLarge(
            10,
            15
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        fontWeight:
          '800',
        color:
          highContrast
            ? '#000000'
            : '#5B5BD6',
        marginLeft:
          largeText
            ? 8
            : 6,
      },

      // ========================================
      // INSTRUCTIONS
      // ========================================

      instructionBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#F9FAFB',
        borderRadius:
          largeText
            ? 13
            : 10,
        padding:
          largeText
            ? 13
            : 10,
        marginTop:
          largeText
            ? 10
            : 8,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      instructionText: {
        flex: 1,
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            17,
            24
          ),
        color:
          secondaryTextColor,
        marginLeft:
          largeText
            ? 9
            : 7,
      },


      // ========================================
      // LAST TAKEN
      // ========================================

      lastTakenRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop:
          largeText
            ? 11
            : 9,
      },

      lastTakenText: {
        flex: 1,
        fontSize:
          normalOrLarge(
            10,
            15
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        color:
          mutedTextColor,
        marginLeft:
          largeText
            ? 6
            : 5,
      },


      // ========================================
      // HISTORY BUTTON
      // ========================================

      historyButton: {
        minHeight:
          largeText
            ? 51
            : 40,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#E0E2FF',
        backgroundColor:
          '#FFFFFF',
        borderRadius:
          largeText
            ? 13
            : 10,
        marginTop:
          largeText
            ? 14
            : 11,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal:
          largeText
            ? 13
            : 11,
      },

      historyButtonText: {
        flex: 1,
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            22
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#6366F1',
        marginLeft:
          largeText
            ? 8
            : 6,
      },


      // ========================================
      // TAKEN
      // ========================================

      takenButton: {
        minHeight:
          largeText
            ? 55
            : 44,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#818CF8',
        backgroundColor:
          '#FFFFFF',
        borderRadius:
          largeText
            ? 14
            : 11,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginTop:
          largeText
            ? 12
            : 10,
      },

      takenButtonActive: {
        backgroundColor:
          primary,
        borderColor:
          highContrast
            ? '#000000'
            : '#6366F1',
      },

      takenButtonText: {
        color:
          highContrast
            ? '#000000'
            : '#5B6CFF',
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            18,
            24
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 8
            : 6,
      },

      takenButtonTextActive: {
        color: '#FFFFFF',
      },


      // ========================================
      // SCANNER
      // ========================================

      inlineScannerContainer: {
        marginBottom: 20,
        borderRadius: largeText ? 20 : 18,
        overflow: 'hidden',
      },

      scannerScreen: {
        height: largeText ? 620 : 560,
        backgroundColor: '#000000',
      },

      fullCamera: {
        flex: 1,
      },

      scannerTop: {
        paddingTop:
          Platform.OS === 'ios'
            ? (
                largeText
                  ? 60
                  : 55
              )
            : (
                largeText
                  ? 40
                  : 35
              ),
        paddingHorizontal:
          largeText
            ? 22
            : 20,
        flexDirection: 'row',
        alignItems: 'center',
      },

      closeScannerButton: {
        width:
          largeText
            ? 50
            : 42,
        height:
          largeText
            ? 50
            : 42,
        borderRadius:
          largeText
            ? 17
            : 21,
        backgroundColor:
          'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
      },

      scannerTitle: {
        flex: 1,
        color: '#FFFFFF',
        fontSize:
          normalOrLarge(
            19,
            25
          ),
        lineHeight:
          normalOrLarge(
            24,
            31
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 15
            : 13,
      },

      flashButton: {
        width:
          largeText
            ? 50
            : 42,
        height:
          largeText
            ? 50
            : 42,
        borderRadius:
          largeText
            ? 17
            : 21,
        backgroundColor:
          'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
      },

      scanArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal:
          largeText
            ? 32
            : 40,
      },

      scanFrame: {
        width:
          largeText
            ? 310
            : 285,
        height:
          largeText
            ? 210
            : 190,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      },

      scanCorners: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        borderRadius:
          largeText
            ? 18
            : 16,
      },

      scanIcon: {
        position: 'absolute',
        top: largeText ? 18 : 16,
      },

      scanInstruction: {
        position: 'absolute',
        left: 0,
        right: 0,
        width: '100%',
        top: largeText ? 150 : 126,
        paddingHorizontal: largeText ? 20 : 18,
        color: '#FFFFFF',
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            19,
            26
          ),
        fontWeight: '600',
        textAlign: 'center',
      },

      barcodeDetected: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor:
          highContrast
            ? '#000000'
            : 'rgba(52,199,89,0.9)',
        borderRadius:
          largeText
            ? 20
            : 18,
        paddingHorizontal:
          largeText
            ? 16
            : 13,
        paddingVertical:
          largeText
            ? 9
            : 7,
        marginTop:
          largeText
            ? 16
            : 13,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          '#FFFFFF',
      },

      barcodeDetectedText: {
        color: '#FFFFFF',
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 6
            : 5,
      },

      scannerBottom: {
        paddingHorizontal:
          largeText
            ? 28
            : 25,
        paddingBottom:
          Platform.OS === 'ios'
            ? (
                largeText
                  ? 50
                  : 45
              )
            : (
                largeText
                  ? 35
                  : 30
              ),
        alignItems: 'center',
      },

      scannerHint: {
        color: '#FFFFFF',
        opacity: 0.92,
        textAlign: 'center',
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            18,
            24
          ),
        marginBottom:
          largeText
            ? 20
            : 17,
      },

      scanButton: {
        minWidth:
          largeText
            ? 250
            : 210,
        minHeight:
          largeText
            ? 58
            : 50,
        borderRadius:
          largeText
            ? 29
            : 25,
        backgroundColor:
          primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal:
          largeText
            ? 23
            : 20,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          '#FFFFFF',
      },

      scanButtonDisabled: {
        opacity: 0.7,
      },

      scanButtonText: {
        color: '#FFFFFF',
        fontSize:
          normalOrLarge(
            14,
            18
          ),
        lineHeight:
          normalOrLarge(
            19,
            24
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 9
            : 8,
      },


      detectedDetailsCard: {
        backgroundColor: highContrast ? '#FFFFFF' : '#F7F7FB',
        borderRadius: largeText ? 17 : 15,
        padding: largeText ? 16 : 14,
        marginBottom: largeText ? 16 : 13,
        borderWidth: highContrast ? 2 : 1,
        borderColor: highContrast ? '#000000' : '#E5E7EB',
      },

      detectedDetailsTitle: {
        fontSize: normalOrLarge(15, 19),
        lineHeight: normalOrLarge(20, 25),
        fontWeight: '800',
        color: highContrast ? '#000000' : '#111827',
        marginBottom: largeText ? 10 : 8,
      },

      detectedDetailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: largeText ? 7 : 5,
      },

      detectedDetailLabel: {
        width: largeText ? 105 : 85,
        fontSize: normalOrLarge(12, 16),
        lineHeight: normalOrLarge(17, 22),
        fontWeight: '700',
        color: highContrast ? '#000000' : '#6B7280',
      },

      detectedDetailValue: {
        flex: 1,
        fontSize: normalOrLarge(13, 17),
        lineHeight: normalOrLarge(18, 24),
        fontWeight: '600',
        color: highContrast ? '#000000' : '#111827',
      },


      // ========================================
      // MODALS
      // ========================================

      modalOverlay: {
        flex: 1,
        backgroundColor:
          highContrast
            ? 'rgba(0,0,0,0.72)'
            : 'rgba(0,0,0,0.48)',
        justifyContent: 'flex-end',
      },

      scanResultModal: {
        backgroundColor:
          screenBackground,
        borderTopLeftRadius:
          largeText
            ? 26
            : 22,
        borderTopRightRadius:
          largeText
            ? 26
            : 22,
        padding:
          largeText
            ? 24
            : 20,
        paddingBottom:
          largeText
            ? 42
            : 35,
        maxHeight: '90%',
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      historyModal: {
        backgroundColor:
          screenBackground,
        borderTopLeftRadius:
          largeText
            ? 26
            : 22,
        borderTopRightRadius:
          largeText
            ? 26
            : 22,
        padding:
          largeText
            ? 24
            : 20,
        paddingBottom:
          largeText
            ? 42
            : 35,
        maxHeight: '82%',
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom:
          largeText
            ? 18
            : 15,
      },

      modalHeaderText: {
        flex: 1,
        paddingRight:
          largeText
            ? 8
            : 3,
      },

      historyModalTitleArea: {
        flex: 1,
        paddingRight:
          largeText
            ? 8
            : 3,
      },

      modalTitle: {
        fontSize:
          normalOrLarge(
            21,
            27
          ),
        lineHeight:
          normalOrLarge(
            27,
            35
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#111827',
      },

      modalSubtitle: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            17,
            24
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? 5
            : 4,
      },

      modalCloseButton: {
        width:
          largeText
            ? 46
            : 38,
        height:
          largeText
            ? 46
            : 38,
        borderRadius:
          largeText
            ? 15
            : 19,
        backgroundColor:
          '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft:
          largeText
            ? 12
            : 10,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
      },


      // ========================================
      // VERIFICATION WARNING
      // ========================================

      verificationWarning: {
        flexDirection: 'row',
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#FFF7E6',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#F4D28A',
        borderRadius:
          largeText
            ? 15
            : 12,
        padding:
          largeText
            ? 14
            : 11,
        marginBottom:
          largeText
            ? 16
            : 13,
      },

      verificationWarningText: {
        flex: 1,
        color:
          highContrast
            ? '#000000'
            : '#92400E',
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            23
          ),
        marginLeft:
          largeText
            ? 9
            : 7,
      },


      // ========================================
      // BARCODE
      // ========================================

      detectedBarcodeBox: {
        backgroundColor:
          '#FFFFFF',
        borderRadius:
          largeText
            ? 15
            : 12,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
        padding:
          largeText
            ? 14
            : 11,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 16
            : 13,
      },

      detectedBarcodeInfo: {
        flex: 1,
        marginLeft:
          largeText
            ? 10
            : 8,
      },

      detectedBarcodeTitle: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        fontWeight: '800',
        color:
          highContrast
            ? '#000000'
            : '#6366F1',
      },

      detectedBarcodeText: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            15,
            21
          ),
        color:
          secondaryTextColor,
        marginTop:
          largeText
            ? 3
            : 2,
      },


      // ========================================
      // OCR PREVIEW
      // ========================================

      ocrPreviewLabel: {
        fontSize:
          normalOrLarge(
            12,
            17
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        fontWeight: '800',
        color:
          textColor,
        marginBottom:
          largeText
            ? 9
            : 7,
      },

      ocrPreview: {
        maxHeight:
          largeText
            ? 340
            : 280,
        backgroundColor:
          '#FFFFFF',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
        borderRadius:
          largeText
            ? 15
            : 12,
        padding:
          largeText
            ? 16
            : 14,
        marginBottom:
          largeText
            ? 17
            : 14,
      },

      ocrPreviewText: {
        fontSize:
          normalOrLarge(
            16,
            21
          ),
        lineHeight:
          normalOrLarge(
            24,
            30
          ),
        color:
          highContrast
            ? '#000000'
            : '#374151',
      },


      // ========================================
      // SCAN ACTIONS
      // ========================================

      useScanButton: {
        minHeight:
          largeText
            ? 58
            : 48,
        borderRadius:
          largeText
            ? 16
            : 13,
        backgroundColor:
          primary,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          '#FFFFFF',
      },

      useScanButtonText: {
        color: '#FFFFFF',
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            18,
            24
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 9
            : 7,
      },

      rescanButton: {
        minHeight:
          largeText
            ? 56
            : 46,
        borderRadius:
          largeText
            ? 16
            : 13,
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          highContrast
            ? '#000000'
            : '#C7CBFF',
        backgroundColor:
          '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        marginTop:
          largeText
            ? 11
            : 9,
      },

      rescanButtonText: {
        color:
          highContrast
            ? '#000000'
            : '#6366F1',
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            18,
            24
          ),
        fontWeight: '800',
        marginLeft:
          largeText
            ? 9
            : 7,
      },

      enterManuallyText: {
        color:
          highContrast
            ? '#000000'
            : '#6B7280',
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            22
          ),
        fontWeight: '800',
        textAlign: 'center',
        marginTop:
          largeText
            ? 17
            : 14,
        textDecorationLine:
          'underline',
      },


      // ========================================
      // HISTORY MODAL
      // ========================================

      historyScroll: {
        marginTop: 3,
      },

      historyEntry: {
        backgroundColor:
          '#FFFFFF',
        borderWidth:
          highContrast
            ? 2
            : 1,
        borderColor:
          borderColor,
        borderRadius:
          largeText
            ? 16
            : 13,
        padding:
          largeText
            ? 15
            : 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 11
            : 9,
      },

      historyEntryIcon: {
        width:
          largeText
            ? 44
            : 36,
        height:
          largeText
            ? 44
            : 36,
        borderRadius:
          largeText
            ? 14
            : 18,
        backgroundColor:
          highContrast
            ? '#FFFFFF'
            : '#EAF8EE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight:
          largeText
            ? 12
            : 10,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      historyEntryInfo: {
        flex: 1,
      },

      historyEntryDate: {
        fontSize:
          normalOrLarge(
            13,
            18
          ),
        lineHeight:
          normalOrLarge(
            18,
            24
          ),
        fontWeight: '800',
        color:
          textColor,
      },

      historyEntryTime: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            16,
            22
          ),
        color:
          mutedTextColor,
        marginTop:
          largeText
            ? 4
            : 3,
      },

      takenPill: {
        backgroundColor:
          highContrast
            ? '#000000'
            : '#EAF8EE',
        borderRadius:
          largeText
            ? 13
            : 10,
        paddingHorizontal:
          largeText
            ? 10
            : 8,
        paddingVertical:
          largeText
            ? 7
            : 5,
        marginLeft:
          largeText
            ? 8
            : 5,
      },

      takenPillText: {
        fontSize:
          normalOrLarge(
            9,
            14
          ),
        lineHeight:
          normalOrLarge(
            13,
            19
          ),
        fontWeight: '800',
        color:
          '#FFFFFF',
      },

      noHistory: {
        alignItems: 'center',
        paddingVertical:
          largeText
            ? 44
            : 35,
        paddingHorizontal:
          largeText
            ? 25
            : 20,
      },

      noHistoryIcon: {
        width:
          largeText
            ? 70
            : 58,
        height:
          largeText
            ? 70
            : 58,
        borderRadius:
          largeText
            ? 18
            : 29,
        backgroundColor:
          softBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom:
          largeText
            ? 14
            : 11,
        borderWidth:
          highContrast
            ? 2
            : 0,
        borderColor:
          highContrast
            ? '#000000'
            : 'transparent',
      },

      noHistoryTitle: {
        fontSize:
          normalOrLarge(
            15,
            20
          ),
        lineHeight:
          normalOrLarge(
            20,
            26
          ),
        fontWeight: '800',
        color:
          textColor,
        textAlign: 'center',
      },

      noHistoryText: {
        fontSize:
          normalOrLarge(
            11,
            16
          ),
        lineHeight:
          normalOrLarge(
            17,
            23
          ),
        color:
          mutedTextColor,
        textAlign: 'center',
        marginTop:
          largeText
            ? 8
            : 6,
      },

    });

  };