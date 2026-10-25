import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const ACCOUNTS_KEY = 'strokebuddy_accounts';

const getMedicationStorageKey = (patientId) =>
  `strokebuddy_medications_${patientId || 'default_patient'}`;

const getMedicationHistoryKey = (patientId) =>
  `strokebuddy_medication_history_${patientId || 'default_patient'}`;

const CAREGIVER_SETTINGS_PREFIX = 'strokebuddy_caregiver_settings_';

const MEDICATION_DATA_VERSION = 3;

const EMPTY_FORM = {
  name: '',
  type: '',
  dosage: '',
  dosesPerDay: '1',
  frequency: 'Once daily',
  schedule: '',
  instructions: '',
  notes: '',
};

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every morning',
  'Every evening',
  'As needed',
  'Custom',
];

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatDateTime(value) {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function normalizeDoseHistory(doseHistory) {
  if (!Array.isArray(doseHistory)) {
    return [];
  }

  return doseHistory.filter(Boolean).map((dose) => ({
    ...dose,
    id: dose?.id || makeId(),
  }));
}

function normalizeMedication(medication) {
  const doseHistory = normalizeDoseHistory(medication?.doseHistory);

  return {
    id: medication?.id || makeId(),
    name: medication?.name || '',
    type: medication?.type || '',
    dosage: medication?.dosage || '',
    dosesPerDay: String(medication?.dosesPerDay || '1'),
    frequency: medication?.frequency || 'Once daily',
    schedule: medication?.schedule || '',
    instructions: medication?.instructions || '',
    notes: medication?.notes || '',
    active:
      medication?.active === undefined
        ? true
        : Boolean(medication.active),
    createdAt:
      medication?.createdAt || new Date().toISOString(),
    updatedAt:
      medication?.updatedAt || new Date().toISOString(),
    lastTakenAt: medication?.lastTakenAt || null,
    lastTakenDate: medication?.lastTakenDate || null,
    takenToday:
      medication?.takenToday === undefined
        ? doseHistory.some((dose) => isToday(dose?.timestamp))
        : Boolean(medication.takenToday),
    doseHistory,
  };
}

function getTodayDoseCount(medication) {
  if (!Array.isArray(medication?.doseHistory)) {
    return 0;
  }

  return medication.doseHistory.filter((dose) =>
    isToday(dose?.timestamp)
  ).length;
}

function getDoseTarget(medication) {
  const parsed = Number.parseInt(
    medication?.dosesPerDay,
    10
  );

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function getMedicationStatus(medication) {
  const taken = getTodayDoseCount(medication);
  const target = getDoseTarget(medication);

  if (taken >= target) {
    return 'Complete';
  }

  if (taken > 0) {
    return `${taken}/${target} today`;
  }

  return 'Not taken today';
}

function normalizeMedicationEnvelope(parsed) {
  if (Array.isArray(parsed)) {
    const medications = parsed.map(normalizeMedication);

    return {
      version: MEDICATION_DATA_VERSION,
      medications,
      notes: [],
      doseHistory: medications.flatMap((medication) =>
        Array.isArray(medication.doseHistory)
          ? medication.doseHistory.map((dose) => ({
              ...dose,
              medicationId: medication.id,
              medicationName: medication.name,
            }))
          : []
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.medications)
  ) {
    const medications = parsed.medications.map(
      normalizeMedication
    );

    const existingTopLevelHistory = Array.isArray(
      parsed.doseHistory
    )
      ? parsed.doseHistory
      : [];

    return {
      ...parsed,
      version: parsed.version || MEDICATION_DATA_VERSION,
      medications,
      notes: Array.isArray(parsed.notes)
        ? parsed.notes
        : [],
      doseHistory: existingTopLevelHistory,
      updatedAt: parsed.updatedAt || null,
    };
  }

  return {
    version: MEDICATION_DATA_VERSION,
    medications: [],
    notes: [],
    doseHistory: [],
    updatedAt: null,
  };
}

export default function CaregiverMedsScreen({
  route,
  navigation,
}) {
  const routeAccountId =
    route?.params?.accountId || null;

  const routePatientId =
    route?.params?.patientId || null;

  const routePatientName =
    route?.params?.patientName || null;

  const [caregiver, setCaregiver] = useState(null);
  const [patient, setPatient] = useState(null);

  const [medications, setMedications] = useState([]);
  const [history, setHistory] = useState([]);

  const [medicationEnvelope, setMedicationEnvelope] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] =
    useState(false);

  const [editingMedicationId, setEditingMedicationId] =
    useState(null);

  const [selectedMedication, setSelectedMedication] =
    useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const resolvedPatientId =
    patient?.id || routePatientId || null;

  const medicationStorageKey =
    getMedicationStorageKey(resolvedPatientId);

  const historyStorageKey =
    getMedicationHistoryKey(resolvedPatientId);

  const loadAccessibilitySettings = useCallback(
    async (accountId) => {
      if (!accountId) {
        setLargeText(false);
        setHighContrast(false);
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(
          `${CAREGIVER_SETTINGS_PREFIX}${accountId}`
        );

        if (!raw) {
          setLargeText(false);
          setHighContrast(false);
          return;
        }

        const settings = JSON.parse(raw);

        setLargeText(Boolean(settings?.largeText));
        setHighContrast(Boolean(settings?.highContrast));
      } catch (error) {
        console.log(
          'Unable to load caregiver accessibility settings:',
          error
        );
      }
    },
    []
  );

  const resolveConnectedPatient = useCallback(
    async (accounts, caregiverAccountId) => {
      if (!Array.isArray(accounts)) {
        return {
          caregiverAccount: null,
          patientAccount: null,
        };
      }

      const caregiverAccount =
        accounts.find(
          (account) =>
            account?.id === caregiverAccountId &&
            account?.role === 'caregiver'
        ) || null;

      let connectedPatientId =
        caregiverAccount?.connectedPatientId ||
        caregiverAccount?.patientId ||
        routePatientId ||
        null;

      let patientAccount = null;

      if (connectedPatientId) {
        patientAccount =
          accounts.find(
            (account) =>
              account?.id === connectedPatientId &&
              account?.role === 'patient'
          ) || null;
      }

      /*
       * Compatibility fallback for older caregiver records.
       */
      if (!patientAccount && caregiverAccountId) {
        patientAccount =
          accounts.find(
            (account) =>
              account?.role === 'patient' &&
              (
                account?.connectedCaregiverId ===
                  caregiverAccountId ||
                account?.caregiverId === caregiverAccountId
              )
          ) || null;
      }

      /*
       * If navigation supplied an explicit patientId,
       * only use it when that account is actually a patient.
       */
      if (routePatientId && !patientAccount) {
        const routePatient =
          accounts.find(
            (account) =>
              account?.id === routePatientId &&
              account?.role === 'patient'
          ) || null;

        if (routePatient) {
          patientAccount = routePatient;
        }
      }

      return {
        caregiverAccount,
        patientAccount,
      };
    },
    [routePatientId]
  );

  const loadMedicationData = useCallback(
    async (patientId) => {
      if (!patientId) {
        setMedications([]);
        setHistory([]);
        setMedicationEnvelope(null);
        return;
      }

      try {
        const [
          medicationsRaw,
          historyRaw,
        ] = await Promise.all([
          AsyncStorage.getItem(
            getMedicationStorageKey(patientId)
          ),
          AsyncStorage.getItem(
            getMedicationHistoryKey(patientId)
          ),
        ]);

        let loadedEnvelope = {
          version: MEDICATION_DATA_VERSION,
          medications: [],
          notes: [],
          doseHistory: [],
          updatedAt: null,
        };

        if (medicationsRaw) {
          try {
            loadedEnvelope =
              normalizeMedicationEnvelope(
                JSON.parse(medicationsRaw)
              );
          } catch (error) {
            console.log(
              'Medication data could not be parsed:',
              error
            );
          }
        }

        let loadedHistory = [];

        if (historyRaw) {
          try {
            const parsedHistory =
              JSON.parse(historyRaw);

            if (Array.isArray(parsedHistory)) {
              loadedHistory = parsedHistory;
            }
          } catch (error) {
            console.log(
              'Medication history could not be parsed:',
              error
            );
          }
        }

        setMedicationEnvelope(loadedEnvelope);
        setMedications(
          loadedEnvelope.medications.map(
            normalizeMedication
          )
        );
        setHistory(loadedHistory);
      } catch (error) {
        console.log(
          'Unable to load medication data:',
          error
        );

        Alert.alert(
          'Unable to load medications',
          'StrokeBuddy could not load the patient medication records right now.'
        );
      }
    },
    []
  );

  /*
   * Save the complete shared medication envelope.
   *
   * Important:
   * - Keeps version 3 structure.
   * - Preserves notes.
   * - Preserves top-level doseHistory.
   * - Preserves all medication metadata.
   * - Keeps the patient-specific storage key.
   */
  const saveMedicationRecord = useCallback(
    async (
      patientId,
      updatedMedications,
      additionalTopLevelDoseHistory
    ) => {
      if (!patientId) {
        return;
      }

      const key = getMedicationStorageKey(patientId);

      try {
        const existingRaw =
          await AsyncStorage.getItem(key);

        let existingEnvelope = {
          version: MEDICATION_DATA_VERSION,
          medications: [],
          notes: [],
          doseHistory: [],
          updatedAt: null,
        };

        if (existingRaw) {
          try {
            existingEnvelope =
              normalizeMedicationEnvelope(
                JSON.parse(existingRaw)
              );
          } catch (parseError) {
            console.log(
              'Existing medication envelope could not be parsed:',
              parseError
            );
          }
        }

        const currentTopLevelHistory =
          Array.isArray(
            existingEnvelope.doseHistory
          )
            ? existingEnvelope.doseHistory
            : [];

        const addedTopLevelHistory =
          Array.isArray(
            additionalTopLevelDoseHistory
          )
            ? additionalTopLevelDoseHistory
            : [];

        const combinedTopLevelHistory = [
          ...currentTopLevelHistory,
          ...addedTopLevelHistory,
        ].slice(-1000);

        const updatedRecord = {
          ...existingEnvelope,
          version: MEDICATION_DATA_VERSION,
          medications:
            updatedMedications.map(
              normalizeMedication
            ),
          notes: Array.isArray(
            existingEnvelope.notes
          )
            ? existingEnvelope.notes
            : [],
          doseHistory:
            combinedTopLevelHistory,
          updatedAt:
            new Date().toISOString(),
        };

        await AsyncStorage.setItem(
          key,
          JSON.stringify(updatedRecord)
        );

        setMedicationEnvelope(
          updatedRecord
        );
      } catch (error) {
        console.log(
          'Unable to save medication record:',
          error
        );

        throw error;
      }
    },
    []
  );

  const saveManagementHistory = useCallback(
    async (patientId, historyEntry) => {
      if (!patientId) {
        return [];
      }

      const key =
        getMedicationHistoryKey(patientId);

      const currentHistory = Array.isArray(history)
        ? history
        : [];

      const updatedHistory = [
        historyEntry,
        ...currentHistory,
      ].slice(0, 500);

      await AsyncStorage.setItem(
        key,
        JSON.stringify(updatedHistory)
      );

      setHistory(updatedHistory);

      return updatedHistory;
    },
    [history]
  );

  const loadScreen = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const rawAccounts =
          await AsyncStorage.getItem(
            ACCOUNTS_KEY
          );

        let accounts = [];

        if (rawAccounts) {
          try {
            const parsed =
              JSON.parse(rawAccounts);

            if (Array.isArray(parsed)) {
              accounts = parsed;
            }
          } catch (error) {
            console.log(
              'Accounts could not be parsed:',
              error
            );
          }
        }

        const caregiverAccountId =
          routeAccountId;

        const {
          caregiverAccount,
          patientAccount,
        } =
          await resolveConnectedPatient(
            accounts,
            caregiverAccountId
          );

        setCaregiver(caregiverAccount);

        if (patientAccount) {
          setPatient(patientAccount);

          await Promise.all([
            loadMedicationData(
              patientAccount.id
            ),
            loadAccessibilitySettings(
              caregiverAccount?.id ||
                caregiverAccountId
            ),
          ]);
        } else {
          setPatient(null);
          setMedications([]);
          setHistory([]);
          setMedicationEnvelope(null);

          await loadAccessibilitySettings(
            caregiverAccount?.id ||
              caregiverAccountId
          );
        }
      } catch (error) {
        console.log(
          'Unable to load caregiver medication screen:',
          error
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [
      loadAccessibilitySettings,
      loadMedicationData,
      resolveConnectedPatient,
      routeAccountId,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      loadScreen(true);
    }, [loadScreen])
  );

  /*
   * Refresh only the currently connected patient's
   * medication record while this screen is active.
   */
  useEffect(() => {
    if (!resolvedPatientId) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadMedicationData(
        resolvedPatientId
      );
    }, 5000);

    return () =>
      clearInterval(interval);
  }, [
    loadMedicationData,
    resolvedPatientId,
  ]);

  const refresh = async () => {
    setRefreshing(true);

    try {
      await loadScreen(false);
    } finally {
      setRefreshing(false);
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openAddMedication = () => {
    if (!resolvedPatientId) {
      Alert.alert(
        'No Patient Connected',
        'Connect a patient in Caregiver Settings before adding medications.'
      );
      return;
    }

    setEditingMedicationId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEditMedication = (
    medication
  ) => {
    setEditingMedicationId(
      medication.id
    );

    setForm({
      name: medication.name || '',
      type: medication.type || '',
      dosage: medication.dosage || '',
      dosesPerDay: String(
        medication.dosesPerDay || '1'
      ),
      frequency:
        medication.frequency ||
        'Once daily',
      schedule:
        medication.schedule || '',
      instructions:
        medication.instructions || '',
      notes:
        medication.notes || '',
    });

    setModalVisible(true);
  };

  const saveMedication = async () => {
    if (!resolvedPatientId) {
      Alert.alert(
        'No Patient Connected',
        'Connect a patient before managing medications.'
      );
      return;
    }

    const cleanName =
      form.name.trim();

    if (!cleanName) {
      Alert.alert(
        'Medication name required',
        'Please enter the medication name.'
      );
      return;
    }

    const cleanDosage =
      form.dosage.trim();

    if (!cleanDosage) {
      Alert.alert(
        'Dosage required',
        'Please enter the prescribed dosage.'
      );
      return;
    }

    const parsedDosesPerDay =
      Number.parseInt(
        form.dosesPerDay,
        10
      );

    const safeDosesPerDay =
      Number.isFinite(
        parsedDosesPerDay
      ) &&
      parsedDosesPerDay > 0
        ? parsedDosesPerDay
        : 1;

    try {
      const now =
        new Date().toISOString();

      const cleanType =
        form.type.trim();

      let updatedMedications = [
        ...medications,
      ];

      let savedMedicationId =
        editingMedicationId;

      if (editingMedicationId) {
        updatedMedications =
          updatedMedications.map(
            (medication) => {
              if (
                medication.id !==
                editingMedicationId
              ) {
                return medication;
              }

              return normalizeMedication({
                ...medication,
                name: cleanName,
                type: cleanType,
                dosage: cleanDosage,
                dosesPerDay:
                  String(
                    safeDosesPerDay
                  ),
                frequency:
                  form.frequency.trim() ||
                  'Once daily',
                schedule:
                  form.schedule.trim(),
                instructions:
                  form.instructions.trim(),
                notes:
                  form.notes.trim(),
                updatedAt: now,
              });
            }
          );
      } else {
        const newMedication =
          normalizeMedication({
            id: makeId(),
            name: cleanName,
            type: cleanType,
            dosage: cleanDosage,
            dosesPerDay:
              String(
                safeDosesPerDay
              ),
            frequency:
              form.frequency.trim() ||
              'Once daily',
            schedule:
              form.schedule.trim(),
            instructions:
              form.instructions.trim(),
            notes:
              form.notes.trim(),
            active: true,
            createdAt: now,
            updatedAt: now,
            lastTakenAt: null,
            lastTakenDate: null,
            takenToday: false,
            doseHistory: [],
          });

        savedMedicationId =
          newMedication.id;

        updatedMedications = [
          newMedication,
          ...updatedMedications,
        ];
      }

      /*
       * Medication-management changes do NOT alter
       * dose history.
       */
      await saveMedicationRecord(
        resolvedPatientId,
        updatedMedications,
        []
      );

      const historyEntry = {
        id: makeId(),
        patientId:
          resolvedPatientId,
        patientName:
          patient?.name ||
          routePatientName ||
          'Patient',
        caregiverId:
          caregiver?.id ||
          routeAccountId ||
          null,
        caregiverName:
          caregiver?.name ||
          'Caregiver',
        medicationId:
          savedMedicationId,
        medicationName:
          cleanName,
        action:
          editingMedicationId
            ? 'updated'
            : 'added',
        timestamp: now,
      };

      await saveManagementHistory(
        resolvedPatientId,
        historyEntry
      );

      setMedications(
        updatedMedications
      );

      setModalVisible(false);
      setEditingMedicationId(null);
      setForm(EMPTY_FORM);

      Alert.alert(
        editingMedicationId
          ? 'Medication Updated'
          : 'Medication Added',
        `${cleanName} is now saved to ${
          patient?.name ||
          'the patient'
        }'s medication record.`
      );
    } catch (error) {
      console.log(
        'Unable to save medication:',
        error
      );

      Alert.alert(
        'Unable to save',
        'The medication could not be saved. Please try again.'
      );
    }
  };

  const deleteMedication = (
    medication
  ) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to remove ${
        medication.name
      } from ${
        patient?.name ||
        'the patient'
      }'s medication list?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!resolvedPatientId) {
              return;
            }

            try {
              const updatedMedications =
                medications.filter(
                  (item) =>
                    item.id !==
                    medication.id
                );

              /*
               * Keep existing top-level dose history.
               * Deleting the medication does not erase
               * historical dose records.
               */
              await saveMedicationRecord(
                resolvedPatientId,
                updatedMedications,
                []
              );

              const now =
                new Date().toISOString();

              const historyEntry = {
                id: makeId(),
                patientId:
                  resolvedPatientId,
                patientName:
                  patient?.name ||
                  routePatientName ||
                  'Patient',
                caregiverId:
                  caregiver?.id ||
                  routeAccountId ||
                  null,
                caregiverName:
                  caregiver?.name ||
                  'Caregiver',
                medicationId:
                  medication.id,
                medicationName:
                  medication.name,
                action: 'deleted',
                timestamp: now,
              };

              await saveManagementHistory(
                resolvedPatientId,
                historyEntry
              );

              setMedications(
                updatedMedications
              );

              if (
                selectedMedication?.id ===
                medication.id
              ) {
                setSelectedMedication(
                  null
                );
                setHistoryModalVisible(
                  false
                );
              }
            } catch (error) {
              console.log(
                'Unable to delete medication:',
                error
              );

              Alert.alert(
                'Unable to delete',
                'The medication could not be removed.'
              );
            }
          },
        },
      ]
    );
  };

  const toggleMedicationActive =
    async (medication) => {
      if (!resolvedPatientId) {
        return;
      }

      try {
        const now =
          new Date().toISOString();

        const newActiveState =
          !medication.active;

        const updatedMedications =
          medications.map(
            (item) =>
              item.id ===
              medication.id
                ? normalizeMedication({
                    ...item,
                    active:
                      newActiveState,
                    updatedAt: now,
                  })
                : item
          );

        await saveMedicationRecord(
          resolvedPatientId,
          updatedMedications,
          []
        );

        const historyEntry = {
          id: makeId(),
          patientId:
            resolvedPatientId,
          patientName:
            patient?.name ||
            routePatientName ||
            'Patient',
          caregiverId:
            caregiver?.id ||
            routeAccountId ||
            null,
          caregiverName:
            caregiver?.name ||
            'Caregiver',
          medicationId:
            medication.id,
          medicationName:
            medication.name,
          action:
            newActiveState
              ? 'activated'
              : 'deactivated',
          timestamp: now,
        };

        await saveManagementHistory(
          resolvedPatientId,
          historyEntry
        );

        setMedications(
          updatedMedications
        );
      } catch (error) {
        console.log(
          'Unable to update medication status:',
          error
        );

        Alert.alert(
          'Unable to update',
          'The medication status could not be changed.'
        );
      }
    };

  const recordDose = async (
    medication
  ) => {
    if (!resolvedPatientId) {
      return;
    }

    try {
      const now =
        new Date().toISOString();

      const doseEntry = {
        id: makeId(),
        medicationId:
          medication.id,
        medicationName:
          medication.name,
        timestamp: now,
        recordedBy: 'caregiver',
        caregiverId:
          caregiver?.id ||
          routeAccountId ||
          null,
        caregiverName:
          caregiver?.name ||
          'Caregiver',
      };

      const updatedMedications =
        medications.map(
          (item) => {
            if (
              item.id !==
              medication.id
            ) {
              return item;
            }

            const updatedDoseHistory = [
              ...(Array.isArray(
                item.doseHistory
              )
                ? item.doseHistory
                : []),
              doseEntry,
            ];

            return normalizeMedication({
              ...item,
              lastTakenAt: now,
              lastTakenDate: now,
              takenToday: true,
              doseHistory:
                updatedDoseHistory,
              updatedAt: now,
            });
          }
        );

      /*
       * The same dose is stored:
       *
       * 1. inside medication.doseHistory
       * 2. inside envelope.doseHistory
       *
       * This keeps caregiver and patient medication
       * history compatible.
       */
      await saveMedicationRecord(
        resolvedPatientId,
        updatedMedications,
        [doseEntry]
      );

      const historyEntry = {
        id: makeId(),
        patientId:
          resolvedPatientId,
        patientName:
          patient?.name ||
          routePatientName ||
          'Patient',
        caregiverId:
          caregiver?.id ||
          routeAccountId ||
          null,
        caregiverName:
          caregiver?.name ||
          'Caregiver',
        medicationId:
          medication.id,
        medicationName:
          medication.name,
        action:
          'dose_recorded',
        timestamp: now,
        relatedDoseId:
          doseEntry.id,
      };

      await saveManagementHistory(
        resolvedPatientId,
        historyEntry
      );

      setMedications(
        updatedMedications
      );
    } catch (error) {
      console.log(
        'Unable to record dose:',
        error
      );

      Alert.alert(
        'Unable to record dose',
        'The dose could not be recorded.'
      );
    }
  };

  const undoLatestDose = (
    medication
  ) => {
    if (!resolvedPatientId) {
      return;
    }

    const doseHistory =
      Array.isArray(
        medication.doseHistory
      )
        ? medication.doseHistory
        : [];

    if (doseHistory.length === 0) {
      Alert.alert(
        'No dose history',
        'There is no recorded dose to undo.'
      );
      return;
    }

    const latestDose =
      doseHistory[
        doseHistory.length - 1
      ];

    Alert.alert(
      'Undo Latest Dose',
      `Remove the most recent dose record for ${medication.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedDoseHistory =
                doseHistory.slice(
                  0,
                  -1
                );

              const latestRemainingDose =
                updatedDoseHistory.length >
                0
                  ? updatedDoseHistory[
                      updatedDoseHistory.length -
                        1
                    ]
                  : null;

              const updatedMedication =
                normalizeMedication({
                  ...medication,
                  doseHistory:
                    updatedDoseHistory,
                  lastTakenAt:
                    latestRemainingDose
                      ?.timestamp ||
                    null,
                  lastTakenDate:
                    latestRemainingDose
                      ?.timestamp ||
                    null,
                  takenToday:
                    updatedDoseHistory.some(
                      (dose) =>
                        isToday(
                          dose?.timestamp
                        )
                    ),
                  updatedAt:
                    new Date().toISOString(),
                });

              const updatedMedications =
                medications.map(
                  (item) =>
                    item.id ===
                    medication.id
                      ? updatedMedication
                      : item
                );

              /*
               * Remove the specific dose from the
               * aggregate top-level history rather than
               * deleting unrelated history.
               */
              const existingTopLevelHistory =
                Array.isArray(
                  medicationEnvelope?.doseHistory
                )
                  ? medicationEnvelope.doseHistory
                  : [];

              const updatedTopLevelHistory =
                latestDose?.id
                  ? existingTopLevelHistory.filter(
                      (entry) =>
                        entry?.id !==
                        latestDose.id
                    )
                  : existingTopLevelHistory;

              /*
               * saveMedicationRecord normally appends
               * additional history. Here we need to
               * replace the aggregate history exactly.
               */
              const key =
                getMedicationStorageKey(
                  resolvedPatientId
                );

              const existingRaw =
                await AsyncStorage.getItem(
                  key
                );

              let existingEnvelope =
                normalizeMedicationEnvelope(
                  existingRaw
                    ? JSON.parse(
                        existingRaw
                      )
                    : null
                );

              const updatedEnvelope = {
                ...existingEnvelope,
                version:
                  MEDICATION_DATA_VERSION,
                medications:
                  updatedMedications.map(
                    normalizeMedication
                  ),
                notes:
                  Array.isArray(
                    existingEnvelope.notes
                  )
                    ? existingEnvelope.notes
                    : [],
                doseHistory:
                  updatedTopLevelHistory,
                updatedAt:
                  new Date().toISOString(),
              };

              await AsyncStorage.setItem(
                key,
                JSON.stringify(
                  updatedEnvelope
                )
              );

              setMedicationEnvelope(
                updatedEnvelope
              );

              const historyEntry = {
                id: makeId(),
                patientId:
                  resolvedPatientId,
                patientName:
                  patient?.name ||
                  routePatientName ||
                  'Patient',
                caregiverId:
                  caregiver?.id ||
                  routeAccountId ||
                  null,
                caregiverName:
                  caregiver?.name ||
                  'Caregiver',
                medicationId:
                  medication.id,
                medicationName:
                  medication.name,
                action:
                  'dose_undone',
                timestamp:
                  new Date().toISOString(),
                relatedDoseId:
                  latestDose?.id ||
                  null,
              };

              await saveManagementHistory(
                resolvedPatientId,
                historyEntry
              );

              setMedications(
                updatedMedications
              );
            } catch (error) {
              console.log(
                'Unable to undo dose:',
                error
              );

              Alert.alert(
                'Unable to undo dose',
                'The dose record could not be removed.'
              );
            }
          },
        },
      ]
    );
  };

  const openMedicationHistory = (
    medication
  ) => {
    setSelectedMedication(
      medication
    );
    setHistoryModalVisible(true);
  };

  const callPatient = async () => {
    if (!patient) {
      Alert.alert(
        'No Patient Connected',
        'Connect a patient before trying to call them.'
      );
      return;
    }

    const rawPhone =
      patient?.phone ||
      patient?.phoneNumber ||
      patient?.mobile ||
      patient?.mobileNumber ||
      patient?.contactNumber ||
      patient?.telephone ||
      patient?.phone_number ||
      '';

    const phone = String(rawPhone).trim();

    if (!phone) {
      Alert.alert(
        'No Phone Number',
        `${patient?.name || 'The patient'} does not have a phone number saved to their account.`
      );
      return;
    }

    // Keep digits and an optional leading + for international numbers.
    const cleanedPhone = phone.replace(/[^\d+]/g, '');

    if (!cleanedPhone || cleanedPhone.replace(/\+/g, '').length < 7) {
      Alert.alert(
        'Invalid Phone Number',
        `The phone number saved for ${patient?.name || 'the patient'} does not appear to be valid.`
      );
      return;
    }

    const phoneUrl = `tel:${cleanedPhone}`;

    try {
      const supported = await Linking.canOpenURL(phoneUrl);

      if (!supported) {
        Alert.alert(
          'Calling Unavailable',
          'This device cannot place phone calls. If you are testing in the iOS Simulator, test this button on a physical iPhone.'
        );
        return;
      }

      await Linking.openURL(phoneUrl);
    } catch (error) {
      console.log('Unable to call patient:', error);

      Alert.alert(
        'Unable to Call',
        'StrokeBuddy could not open the phone app on this device.'
      );
    }
  };

  const visibleMedications =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return medications
        .filter((medication) =>
          showInactive
            ? true
            : medication.active
        )
        .filter((medication) => {
          if (!query) {
            return true;
          }

          return (
            medication.name
              .toLowerCase()
              .includes(query) ||
            medication.type
              .toLowerCase()
              .includes(query) ||
            medication.dosage
              .toLowerCase()
              .includes(query) ||
            medication.frequency
              .toLowerCase()
              .includes(query) ||
            medication.instructions
              .toLowerCase()
              .includes(query)
          );
        });
    }, [
      medications,
      search,
      showInactive,
    ]);

  const activeCount =
    medications.filter(
      (medication) =>
        medication.active
    ).length;

  const todayCompletedCount =
    medications.filter(
      (medication) => {
        if (!medication.active) {
          return false;
        }

        return (
          getTodayDoseCount(
            medication
          ) >=
          getDoseTarget(
            medication
          )
        );
      }
    ).length;

  const selectedMedicationHistory =
    useMemo(() => {
      if (!selectedMedication) {
        return [];
      }

      const medicationDoseHistory =
        Array.isArray(
          selectedMedication.doseHistory
        )
          ? selectedMedication.doseHistory
          : [];

      const managementHistory =
        history.filter(
          (entry) =>
            entry.medicationId ===
            selectedMedication.id
        );

      const doses =
        medicationDoseHistory.map(
          (dose) => ({
            id:
              dose.id ||
              makeId(),
            type: 'dose',
            action:
              'Dose recorded',
            timestamp:
              dose.timestamp,
            recordedBy:
              dose.caregiverName ||
              dose.recordedBy ||
              'Caregiver',
          })
        );

      const management =
        managementHistory.map(
          (entry) => ({
            id: entry.id,
            type: 'management',
            action:
              entry.action,
            timestamp:
              entry.timestamp,
            recordedBy:
              entry.caregiverName ||
              'Caregiver',
          })
        );

      return [
        ...doses,
        ...management,
      ].sort(
        (a, b) =>
          new Date(
            b.timestamp
          ).getTime() -
          new Date(
            a.timestamp
          ).getTime()
      );
    }, [
      history,
      selectedMedication,
    ]);

  const textColor = highContrast
    ? '#000000'
    : '#222222';

  const secondaryTextColor =
    highContrast
      ? '#111111'
      : '#666666';

  const borderColor = highContrast
    ? '#000000'
    : '#E5E7EB';

  const cardBackground =
    '#FFFFFF';

  const inputBackground =
    highContrast
      ? '#FFFFFF'
      : '#F8F8FA';

  const titleSize =
    largeText ? 30 : 26;

  const headingSize =
    largeText ? 22 : 19;

  const bodySize =
    largeText ? 18 : 15;

  const smallSize =
    largeText ? 16 : 13;

  const patientDisplayName =
    patient?.name ||
    routePatientName ||
    'Patient';

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          highContrast &&
            styles.highContrastBackground,
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <Ionicons
            name="medkit-outline"
            size={42}
            color="#111111"
          />

          <Text
            allowFontScaling
            style={[
              styles.loadingText,
              {
                color: textColor,
                fontSize: bodySize,
              },
            ]}
          >
            Loading medication records...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        highContrast &&
          styles.highContrastBackground,
      ]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            largeText &&
              styles.largeContent,
          ]}
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}

          <View
            style={styles.header}
          >
            <View
              style={
                styles.headerTextContainer
              }
            >
              <Text
                allowFontScaling
                style={[
                  styles.title,
                  {
                    color: '#000000',
                    fontSize:
                      titleSize,
                  },
                ]}
              >
                Medications
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.subtitle,
                  {
                    color:
                      secondaryTextColor,
                    fontSize:
                      bodySize,
                  },
                ]}
              >
                {patient
                  ? `Managing ${patientDisplayName}'s medications`
                  : 'Patient medication management'}
              </Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Call patient"
              style={[
                styles.headerIconButton,
                {
                  borderColor,
                  backgroundColor:
                    cardBackground,
                },
              ]}
              onPress={callPatient}
            >
              <Ionicons
                name="call-outline"
                size={24}
                color="#111111"
              />
            </TouchableOpacity>
          </View>

          {/* NO PATIENT */}

          {!patient ? (
            <View
              style={[
                styles.card,
                {
                  backgroundColor:
                    cardBackground,
                  borderColor,
                },
              ]}
            >
              <View
                style={
                  styles.emptyIconCircle
                }
              >
                <Ionicons
                  name="person-outline"
                  size={30}
                  color="#5B6CFF"
                />
              </View>

              <Text
                allowFontScaling
                style={[
                  styles.cardTitle,
                  {
                    color: textColor,
                    fontSize:
                      headingSize,
                  },
                ]}
              >
                No Patient Connected
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.cardDescription,
                  {
                    color:
                      secondaryTextColor,
                    fontSize:
                      bodySize,
                  },
                ]}
              >
                Connect a patient in Caregiver Settings before viewing or managing their medications.
              </Text>

              <TouchableOpacity
                style={
                  styles.primaryButton
                }
                onPress={() =>
                  navigation.navigate(
                    'Settings'
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Open caregiver settings"
              >
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  allowFontScaling
                  style={[
                    styles.primaryButtonText,
                    {
                      fontSize:
                        bodySize,
                    },
                  ]}
                >
                  Open Settings
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* PATIENT SUMMARY */}

              <View
                style={[
                  styles.patientCard,
                  {
                    backgroundColor:
                      cardBackground,
                    borderColor,
                  },
                ]}
              >
                <View
                  style={
                    styles.patientIconCircle
                  }
                >
                  <Ionicons
                    name="person"
                    size={25}
                    color="#5B6CFF"
                  />
                </View>

                <View
                  style={
                    styles.patientInfo
                  }
                >
                  <Text
                    allowFontScaling
                    style={[
                      styles.patientName,
                      {
                        color:
                          textColor,
                        fontSize:
                          headingSize,
                      },
                    ]}
                  >
                    {patientDisplayName}
                  </Text>

                  <View
                    style={
                      styles.connectedRow
                    }
                  >
                    <View
                      style={
                        styles.connectedDot
                      }
                    />

                    <Text
                      allowFontScaling
                      style={[
                        styles.connectedText,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            smallSize,
                        },
                      ]}
                    >
                      Connected patient
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.syncBadge
                  }
                >
                  <Ionicons
                    name="sync-outline"
                    size={15}
                    color="#111111"
                  />

                  <Text
                    allowFontScaling
                    style={[
                      styles.syncText,
                      {
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Synced
                  </Text>
                </View>
              </View>

              {/* SUMMARY STATS */}

              <View
                style={
                  styles.statsRow
                }
              >
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor:
                        cardBackground,
                      borderColor,
                    },
                  ]}
                >
                  <Ionicons
                    name="medkit-outline"
                    size={23}
                    color="#111111"
                  />

                  <Text
                    allowFontScaling
                    style={[
                      styles.statNumber,
                      {
                        color:
                          textColor,
                        fontSize:
                          largeText
                            ? 27
                            : 23,
                      },
                    ]}
                  >
                    {activeCount}
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.statLabel,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Active
                  </Text>
                </View>

                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor:
                        cardBackground,
                      borderColor,
                    },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={23}
                    color="#111111"
                  />

                  <Text
                    allowFontScaling
                    style={[
                      styles.statNumber,
                      {
                        color:
                          textColor,
                        fontSize:
                          largeText
                            ? 27
                            : 23,
                      },
                    ]}
                  >
                    {
                      todayCompletedCount
                    }
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.statLabel,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Complete today
                  </Text>
                </View>
              </View>

              {/* MANAGEMENT HEADER */}

              <View
                style={
                  styles.sectionHeader
                }
              >
                <View
                  style={
                    styles.sectionHeaderText
                  }
                >
                  <Text
                    allowFontScaling
                    style={[
                      styles.sectionTitle,
                      {
                        color:
                          textColor,
                        fontSize:
                          headingSize,
                      },
                    ]}
                  >
                    Medication List
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.sectionSubtitle,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Caregiver-managed medication records
                  </Text>
                </View>

                <TouchableOpacity
                  style={
                    styles.addButton
                  }
                  onPress={
                    openAddMedication
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Add medication"
                >
                  <Ionicons
                    name="add"
                    size={23}
                    color="#FFFFFF"
                  />

                  <Text
                    allowFontScaling
                    style={[
                      styles.addButtonText,
                      {
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Add
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SEARCH */}

              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor:
                      inputBackground,
                    borderColor,
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={21}
                  color={
                    secondaryTextColor
                  }
                />

                <TextInput
                  value={search}
                  onChangeText={
                    setSearch
                  }
                  placeholder="Search medications..."
                  placeholderTextColor="#888888"
                  style={[
                    styles.searchInput,
                    {
                      color:
                        textColor,
                      fontSize:
                        bodySize,
                    },
                  ]}
                  allowFontScaling
                  returnKeyType="search"
                />

                {search.length >
                  0 && (
                  <TouchableOpacity
                    onPress={() =>
                      setSearch('')
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Clear medication search"
                  >
                    <Ionicons
                      name="close-circle"
                      size={21}
                      color="#777777"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* ACTIVE / INACTIVE FILTER */}

              <TouchableOpacity
                style={
                  styles.inactiveToggle
                }
                onPress={() =>
                  setShowInactive(
                    (current) =>
                      !current
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={
                  showInactive
                    ? 'Hide inactive medications'
                    : 'Show inactive medications'
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    showInactive &&
                      styles.checkboxSelected,
                  ]}
                >
                  {showInactive && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color="#FFFFFF"
                    />
                  )}
                </View>

                <Text
                  allowFontScaling
                  style={[
                    styles.inactiveToggleText,
                    {
                      color:
                        textColor,
                      fontSize:
                        smallSize,
                    },
                  ]}
                >
                  Show inactive medications
                </Text>
              </TouchableOpacity>

              {/* MEDICATIONS */}

              {visibleMedications.length ===
              0 ? (
                <View
                  style={[
                    styles.emptyCard,
                    {
                      backgroundColor:
                        cardBackground,
                      borderColor,
                    },
                  ]}
                >
                  <View
                    style={
                      styles.emptyIconCircle
                    }
                  >
                    <Ionicons
                      name="medkit-outline"
                      size={29}
                      color="#111111"
                    />
                  </View>

                  <Text
                    allowFontScaling
                    style={[
                      styles.emptyTitle,
                      {
                        color:
                          textColor,
                        fontSize:
                          headingSize,
                      },
                    ]}
                  >
                    {search
                      ? 'No medications found'
                      : 'No medications added'}
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.emptyDescription,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          bodySize,
                      },
                    ]}
                  >
                    {search
                      ? 'Try a different medication name or search term.'
                      : 'Add the patient’s medications here. They will be available on the patient’s Meds screen.'}
                  </Text>

                  {!search && (
                    <TouchableOpacity
                      style={
                        styles.primaryButton
                      }
                      onPress={
                        openAddMedication
                      }
                    >
                      <Ionicons
                        name="add"
                        size={21}
                        color="#FFFFFF"
                      />

                      <Text
                        allowFontScaling
                        style={[
                          styles.primaryButtonText,
                          {
                            fontSize:
                              bodySize,
                          },
                        ]}
                      >
                        Add First Medication
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                visibleMedications.map(
                  (medication) => {
                    const takenToday =
                      getTodayDoseCount(
                        medication
                      );

                    const target =
                      getDoseTarget(
                        medication
                      );

                    const completed =
                      takenToday >=
                      target;

                    return (
                      <View
                        key={
                          medication.id
                        }
                        style={[
                          styles.medicationCard,
                          {
                            backgroundColor:
                              cardBackground,
                            borderColor,
                          },
                          !medication.active &&
                            styles.inactiveCard,
                        ]}
                      >
                        {/* MEDICATION TOP */}

                        <View
                          style={
                            styles.medicationTop
                          }
                        >
                          <View
                            style={
                              styles.medicationIcon
                            }
                          >
                            <Ionicons
                              name="medical-outline"
                              size={24}
                              color="#111111"
                            />
                          </View>

                          <View
                            style={
                              styles.medicationTitleContainer
                            }
                          >
                            <View
                              style={
                                styles.nameRow
                              }
                            >
                              <Text
                                allowFontScaling
                                style={[
                                  styles.medicationName,
                                  {
                                    color:
                                      textColor,
                                    fontSize:
                                      headingSize,
                                  },
                                ]}
                              >
                                {
                                  medication.name
                                }
                              </Text>

                              {!medication.active && (
                                <View
                                  style={
                                    styles.inactiveBadge
                                  }
                                >
                                  <Text
                                    allowFontScaling
                                    style={[
                                      styles.inactiveBadgeText,
                                      {
                                        fontSize:
                                          largeText
                                            ? 13
                                            : 11,
                                      },
                                    ]}
                                  >
                                    Inactive
                                  </Text>
                                </View>
                              )}
                            </View>

                            {medication.type ? (
                              <Text
                                allowFontScaling
                                style={[
                                  styles.dosageText,
                                  {
                                    color:
                                      secondaryTextColor,
                                    fontSize:
                                      bodySize,
                                  },
                                ]}
                              >
                                {
                                  medication.type
                                }
                              </Text>
                            ) : null}

                            <Text
                              allowFontScaling
                              style={[
                                styles.dosageText,
                                {
                                  color:
                                    secondaryTextColor,
                                  fontSize:
                                    bodySize,
                                },
                              ]}
                            >
                              {
                                medication.dosage
                              }
                            </Text>
                          </View>
                        </View>

                        {/* DETAILS */}

                        <View
                          style={
                            styles.detailsContainer
                          }
                        >
                          <View
                            style={
                              styles.detailRow
                            }
                          >
                            <Ionicons
                              name="repeat-outline"
                              size={19}
                              color="#111111"
                            />

                            <Text
                              allowFontScaling
                              style={[
                                styles.detailText,
                                {
                                  color:
                                    textColor,
                                  fontSize:
                                    bodySize,
                                },
                              ]}
                            >
                              {
                                medication.frequency
                              }{' '}
                              {'  •  '}
                              {target}{' '}
                              {target ===
                              1
                                ? 'dose/day'
                                : 'doses/day'}
                            </Text>
                          </View>

                          {medication.schedule ? (
                            <View
                              style={
                                styles.detailRow
                              }
                            >
                              <Ionicons
                                name="time-outline"
                                size={19}
                                color="#111111"
                              />

                              <Text
                                allowFontScaling
                                style={[
                                  styles.detailText,
                                  {
                                    color:
                                      textColor,
                                    fontSize:
                                      bodySize,
                                  },
                                ]}
                              >
                                {
                                  medication.schedule
                                }
                              </Text>
                            </View>
                          ) : null}

                          {medication.instructions ? (
                            <View
                              style={
                                styles.detailRow
                              }
                            >
                              <Ionicons
                                name="information-circle-outline"
                                size={19}
                                color="#111111"
                              />

                              <Text
                                allowFontScaling
                                style={[
                                  styles.detailText,
                                  {
                                    color:
                                      secondaryTextColor,
                                    fontSize:
                                      bodySize,
                                  },
                                ]}
                              >
                                {
                                  medication.instructions
                                }
                              </Text>
                            </View>
                          ) : null}

                          {medication.notes ? (
                            <View
                              style={
                                styles.notesBox
                              }
                            >
                              <Text
                                allowFontScaling
                                style={[
                                  styles.notesLabel,
                                  {
                                    color:
                                      textColor,
                                    fontSize:
                                      smallSize,
                                  },
                                ]}
                              >
                                Caregiver notes
                              </Text>

                              <Text
                                allowFontScaling
                                style={[
                                  styles.notesText,
                                  {
                                    color:
                                      secondaryTextColor,
                                    fontSize:
                                      bodySize,
                                  },
                                ]}
                              >
                                {
                                  medication.notes
                                }
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* TODAY'S DOSE */}

                        <View
                          style={[
                            styles.todayDoseCard,
                            completed &&
                              styles.todayDoseComplete,
                          ]}
                        >
                          <View
                            style={
                              styles.todayDoseLeft
                            }
                          >
                            <Ionicons
                              name={
                                completed
                                  ? 'checkmark-circle'
                                  : 'ellipse-outline'
                              }
                              size={25}
                              color="#111111"
                            />

                            <View>
                              <Text
                                allowFontScaling
                                style={[
                                  styles.todayDoseTitle,
                                  {
                                    color:
                                      textColor,
                                    fontSize:
                                      bodySize,
                                  },
                                ]}
                              >
                                {getMedicationStatus(
                                  medication
                                )}
                              </Text>

                              {medication.lastTakenAt ? (
                                <Text
                                  allowFontScaling
                                  style={[
                                    styles.lastTakenText,
                                    {
                                      color:
                                        secondaryTextColor,
                                      fontSize:
                                        smallSize,
                                    },
                                  ]}
                                >
                                  Last recorded:{' '}
                                  {formatDateTime(
                                    medication.lastTakenAt
                                  )}
                                </Text>
                              ) : (
                                <Text
                                  allowFontScaling
                                  style={[
                                    styles.lastTakenText,
                                    {
                                      color:
                                        secondaryTextColor,
                                      fontSize:
                                        smallSize,
                                    },
                                  ]}
                                >
                                  No dose recorded yet
                                </Text>
                              )}
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.recordButton,
                              completed &&
                                styles.recordButtonSecondary,
                            ]}
                            onPress={() =>
                              recordDose(
                                medication
                              )
                            }
                            disabled={
                              !medication.active ||
                              completed
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Record dose for ${medication.name}`}
                          >
                            <Ionicons
                              name={
                                completed
                                  ? 'checkmark'
                                  : 'add'
                              }
                              size={18}
                              color="#FFFFFF"
                            />

                            <Text
                              allowFontScaling
                              style={[
                                styles.recordButtonText,
                                {
                                  fontSize:
                                    smallSize,
                                },
                              ]}
                            >
                              {completed
                                ? 'Complete'
                                : 'Record'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* ACTIONS */}

                        <View
                          style={
                            styles.actionRow
                          }
                        >
                          <TouchableOpacity
                            style={
                              styles.actionButton
                            }
                            onPress={() =>
                              openMedicationHistory(
                                medication
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`View history for ${medication.name}`}
                          >
                            <Ionicons
                              name="time-outline"
                              size={19}
                              color="#111111"
                            />

                            <Text
                              allowFontScaling
                              style={[
                                styles.actionButtonText,
                                {
                                  color:
                                    textColor,
                                  fontSize:
                                    smallSize,
                                },
                              ]}
                            >
                              History
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={
                              styles.actionButton
                            }
                            onPress={() =>
                              openEditMedication(
                                medication
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${medication.name}`}
                          >
                            <Ionicons
                              name="create-outline"
                              size={19}
                              color="#111111"
                            />

                            <Text
                              allowFontScaling
                              style={[
                                styles.actionButtonText,
                                {
                                  color:
                                    textColor,
                                  fontSize:
                                    smallSize,
                                },
                              ]}
                            >
                              Edit
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={
                              styles.actionButton
                            }
                            onPress={() =>
                              toggleMedicationActive(
                                medication
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={
                              medication.active
                                ? `Deactivate ${medication.name}`
                                : `Activate ${medication.name}`
                            }
                          >
                            <Ionicons
                              name={
                                medication.active
                                  ? 'pause-circle-outline'
                                  : 'play-circle-outline'
                              }
                              size={19}
                              color="#111111"
                            />

                            <Text
                              allowFontScaling
                              style={[
                                styles.actionButtonText,
                                {
                                  color:
                                    textColor,
                                  fontSize:
                                    smallSize,
                                },
                              ]}
                            >
                              {medication.active
                                ? 'Pause'
                                : 'Activate'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={
                              styles.actionButton
                            }
                            onPress={() =>
                              deleteMedication(
                                medication
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${medication.name}`}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={19}
                              color="#111111"
                            />

                            <Text
                              allowFontScaling
                              style={[
                                styles.actionButtonText,
                                {
                                  color:
                                    textColor,
                                  fontSize:
                                    smallSize,
                                },
                              ]}
                            >
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* UNDO */}

                        {Array.isArray(
                          medication.doseHistory
                        ) &&
                          medication
                            .doseHistory
                            .length >
                            0 && (
                            <TouchableOpacity
                              style={
                                styles.undoButton
                              }
                              onPress={() =>
                                undoLatestDose(
                                  medication
                                )
                              }
                            >
                              <Ionicons
                                name="arrow-undo-outline"
                                size={18}
                                color="#555555"
                              />

                              <Text
                                allowFontScaling
                                style={[
                                  styles.undoText,
                                  {
                                    fontSize:
                                      smallSize,
                                  },
                                ]}
                              >
                                Undo latest dose record
                              </Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    );
                  }
                )
              )}

              {/* CAREGIVER RESPONSIBILITY NOTE */}

              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor:
                      cardBackground,
                    borderColor,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={24}
                  color="#111111"
                />

                <View
                  style={
                    styles.infoTextContainer
                  }
                >
                  <Text
                    allowFontScaling
                    style={[
                      styles.infoTitle,
                      {
                        color:
                          textColor,
                        fontSize:
                          bodySize,
                      },
                    ]}
                  >
                    Caregiver-managed medication information
                  </Text>

                  <Text
                    allowFontScaling
                    style={[
                      styles.infoDescription,
                      {
                        color:
                          secondaryTextColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Medication names, types, dosages, schedules, and instructions entered here are saved to the connected patient's medication record. The patient's Meds screen can use these records for medication information and reminders.
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* ADD / EDIT MODAL */}

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() =>
            setModalVisible(false)
          }
        >
          <View
            style={
              styles.modalOverlay
            }
          >
            <KeyboardAvoidingView
              style={
                styles.modalKeyboard
              }
              behavior={
                Platform.OS === 'ios'
                  ? 'padding'
                  : undefined
              }
            >
              <View
                style={[
                  styles.formModal,
                  {
                    backgroundColor:
                      cardBackground,
                  },
                ]}
              >
                <View
                  style={
                    styles.modalHeader
                  }
                >
                  <View>
                    <Text
                      allowFontScaling
                      style={[
                        styles.modalTitle,
                        {
                          color:
                            textColor,
                          fontSize:
                            largeText
                              ? 25
                              : 22,
                        },
                      ]}
                    >
                      {editingMedicationId
                        ? 'Edit Medication'
                        : 'Add Medication'}
                    </Text>

                    <Text
                      allowFontScaling
                      style={[
                        styles.modalSubtitle,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            smallSize,
                        },
                      ]}
                    >
                      {patientDisplayName}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() =>
                      setModalVisible(
                        false
                      )
                    }
                    style={
                      styles.closeButton
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Close medication form"
                  >
                    <Ionicons
                      name="close"
                      size={25}
                      color="#111111"
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={
                    false
                  }
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={
                    styles.formContent
                  }
                >
                  {/* NAME */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Medication name *
                  </Text>

                  <TextInput
                    value={form.name}
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'name',
                        value
                      )
                    }
                    placeholder="Example: Aspirin"
                    placeholderTextColor="#888888"
                    style={[
                      styles.input,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  {/* TYPE */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Medication type
                  </Text>

                  <TextInput
                    value={form.type}
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'type',
                        value
                      )
                    }
                    placeholder="Example: Tablet"
                    placeholderTextColor="#888888"
                    style={[
                      styles.input,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  {/* DOSAGE */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Dosage *
                  </Text>

                  <TextInput
                    value={
                      form.dosage
                    }
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'dosage',
                        value
                      )
                    }
                    placeholder="Example: 81 mg"
                    placeholderTextColor="#888888"
                    style={[
                      styles.input,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  {/* DOSES PER DAY */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Doses per day *
                  </Text>

                  <TextInput
                    value={
                      form.dosesPerDay
                    }
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'dosesPerDay',
                        value.replace(
                          /[^0-9]/g,
                          ''
                        )
                      )
                    }
                    placeholder="1"
                    placeholderTextColor="#888888"
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  {/* FREQUENCY */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Frequency
                  </Text>

                  <View
                    style={
                      styles.frequencyGrid
                    }
                  >
                    {FREQUENCY_OPTIONS.map(
                      (option) => {
                        const selected =
                          form.frequency ===
                          option;

                        return (
                          <TouchableOpacity
                            key={
                              option
                            }
                            style={[
                              styles.frequencyOption,
                              {
                                borderColor,
                                backgroundColor:
                                  selected
                                    ? '#111111'
                                    : inputBackground,
                              },
                            ]}
                            onPress={() =>
                              updateForm(
                                'frequency',
                                option
                              )
                            }
                            accessibilityRole="button"
                            accessibilityState={{
                              selected,
                            }}
                          >
                            <Text
                              allowFontScaling
                              style={[
                                styles.frequencyText,
                                {
                                  color:
                                    selected
                                      ? '#FFFFFF'
                                      : textColor,
                                  fontSize:
                                    smallSize,
                                },
                              ]}
                            >
                              {
                                option
                              }
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>

                  {/* SCHEDULE */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Schedule / times
                  </Text>

                  <TextInput
                    value={
                      form.schedule
                    }
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'schedule',
                        value
                      )
                    }
                    placeholder="Example: 8:00 AM and 8:00 PM"
                    placeholderTextColor="#888888"
                    style={[
                      styles.input,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  {/* INSTRUCTIONS */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Instructions
                  </Text>

                  <TextInput
                    value={
                      form.instructions
                    }
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'instructions',
                        value
                      )
                    }
                    placeholder="Example: Take with food"
                    placeholderTextColor="#888888"
                    multiline
                    textAlignVertical="top"
                    style={[
                      styles.multilineInput,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  {/* NOTES */}

                  <Text
                    allowFontScaling
                    style={[
                      styles.inputLabel,
                      {
                        color:
                          textColor,
                        fontSize:
                          smallSize,
                      },
                    ]}
                  >
                    Caregiver notes
                  </Text>

                  <TextInput
                    value={
                      form.notes
                    }
                    onChangeText={(
                      value
                    ) =>
                      updateForm(
                        'notes',
                        value
                      )
                    }
                    placeholder="Optional notes about this medication"
                    placeholderTextColor="#888888"
                    multiline
                    textAlignVertical="top"
                    style={[
                      styles.multilineInput,
                      {
                        color:
                          textColor,
                        borderColor,
                        backgroundColor:
                          inputBackground,
                        fontSize:
                          bodySize,
                      },
                    ]}
                    allowFontScaling
                  />

                  <View
                    style={
                      styles.formNotice
                    }
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={20}
                      color="#111111"
                    />

                    <Text
                      allowFontScaling
                      style={[
                        styles.formNoticeText,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            smallSize,
                        },
                      ]}
                    >
                      This information is saved to the patient's medication record.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={
                      styles.saveButton
                    }
                    onPress={
                      saveMedication
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      editingMedicationId
                        ? 'Save medication changes'
                        : 'Add medication'
                    }
                  >
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color="#FFFFFF"
                    />

                    <Text
                      allowFontScaling
                      style={[
                        styles.saveButtonText,
                        {
                          fontSize:
                            bodySize,
                        },
                      ]}
                    >
                      {editingMedicationId
                        ? 'Save Changes'
                        : 'Add Medication'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.cancelButton
                    }
                    onPress={() =>
                      setModalVisible(
                        false
                      )
                    }
                  >
                    <Text
                      allowFontScaling
                      style={[
                        styles.cancelButtonText,
                        {
                          color:
                            textColor,
                          fontSize:
                            bodySize,
                        },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* MEDICATION HISTORY MODAL */}

        <Modal
          visible={
            historyModalVisible
          }
          animationType="slide"
          transparent
          onRequestClose={() =>
            setHistoryModalVisible(
              false
            )
          }
        >
          <View
            style={
              styles.modalOverlay
            }
          >
            <View
              style={[
                styles.historyModal,
                {
                  backgroundColor:
                    cardBackground,
                },
              ]}
            >
              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.historyTitleContainer
                  }
                >
                  <Text
                    allowFontScaling
                    style={[
                      styles.modalTitle,
                      {
                        color:
                          textColor,
                        fontSize:
                          largeText
                            ? 25
                            : 22,
                      },
                    ]}
                  >
                    Medication History
                  </Text>

                  {selectedMedication && (
                    <Text
                      allowFontScaling
                      style={[
                        styles.modalSubtitle,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            smallSize,
                        },
                      ]}
                    >
                      {
                        selectedMedication.name
                      }
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setHistoryModalVisible(
                      false
                    )
                  }
                  style={
                    styles.closeButton
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Close medication history"
                >
                  <Ionicons
                    name="close"
                    size={25}
                    color="#111111"
                  />
                </TouchableOpacity>
              </View>

              {selectedMedication && (
                <View
                  style={[
                    styles.historySummary,
                    {
                      borderColor,
                    },
                  ]}
                >
                  <View>
                    <Text
                      allowFontScaling
                      style={[
                        styles.historySummaryLabel,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            smallSize,
                        },
                      ]}
                    >
                      Today
                    </Text>

                    <Text
                      allowFontScaling
                      style={[
                        styles.historySummaryValue,
                        {
                          color:
                            textColor,
                          fontSize:
                            largeText
                              ? 25
                              : 21,
                        },
                      ]}
                    >
                      {
                        getTodayDoseCount(
                          selectedMedication
                        )
                      }{' '}
                      /{' '}
                      {
                        getDoseTarget(
                          selectedMedication
                        )
                      }{' '}
                      doses
                    </Text>
                  </View>

                  <View>
                    <Text
                      allowFontScaling
                      style={[
                        styles.historySummaryLabel,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            smallSize,
                        },
                      ]}
                    >
                      Last dose
                    </Text>

                    <Text
                      allowFontScaling
                      style={[
                        styles.historySummaryValue,
                        {
                          color:
                            textColor,
                          fontSize:
                            largeText
                              ? 17
                              : 15,
                        },
                      ]}
                    >
                      {selectedMedication.lastTakenAt
                        ? formatDateTime(
                            selectedMedication.lastTakenAt
                          )
                        : 'None'}
                    </Text>
                  </View>
                </View>
              )}

              <ScrollView
                style={
                  styles.historyScroll
                }
                showsVerticalScrollIndicator={
                  false
                }
              >
                {selectedMedicationHistory.length ===
                0 ? (
                  <View
                    style={
                      styles.historyEmpty
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={35}
                      color="#777777"
                    />

                    <Text
                      allowFontScaling
                      style={[
                        styles.historyEmptyTitle,
                        {
                          color:
                            textColor,
                          fontSize:
                            headingSize,
                        },
                      ]}
                    >
                      No history yet
                    </Text>

                    <Text
                      allowFontScaling
                      style={[
                        styles.historyEmptyText,
                        {
                          color:
                            secondaryTextColor,
                          fontSize:
                            bodySize,
                        },
                      ]}
                    >
                      Dose records and medication changes will appear here.
                    </Text>
                  </View>
                ) : (
                  selectedMedicationHistory.map(
                    (entry) => (
                      <View
                        key={
                          entry.id
                        }
                        style={[
                          styles.historyItem,
                          {
                            borderColor,
                          },
                        ]}
                      >
                        <View
                          style={
                            styles.historyIconCircle
                          }
                        >
                          <Ionicons
                            name={
                              entry.type ===
                              'dose'
                                ? 'checkmark'
                                : 'document-text-outline'
                            }
                            size={19}
                            color="#111111"
                          />
                        </View>

                        <View
                          style={
                            styles.historyItemContent
                          }
                        >
                          <Text
                            allowFontScaling
                            style={[
                              styles.historyItemTitle,
                              {
                                color:
                                  textColor,
                                fontSize:
                                  bodySize,
                              },
                            ]}
                          >
                            {entry.action ===
                            'dose_recorded'
                              ? 'Dose recorded'
                              : entry.action ===
                                'dose_undone'
                              ? 'Dose record undone'
                              : entry.action ===
                                'updated'
                              ? 'Medication updated'
                              : entry.action ===
                                'added'
                              ? 'Medication added'
                              : entry.action ===
                                'activated'
                              ? 'Medication activated'
                              : entry.action ===
                                'deactivated'
                              ? 'Medication deactivated'
                              : entry.action ===
                                'deleted'
                              ? 'Medication deleted'
                              : entry.action}
                          </Text>

                          <Text
                            allowFontScaling
                            style={[
                              styles.historyItemMeta,
                              {
                                color:
                                  secondaryTextColor,
                                fontSize:
                                  smallSize,
                              },
                            ]}
                          >
                            {formatDateTime(
                              entry.timestamp
                            )}
                          </Text>

                          <Text
                            allowFontScaling
                            style={[
                              styles.historyItemMeta,
                              {
                                color:
                                  secondaryTextColor,
                                fontSize:
                                  smallSize,
                              },
                            ]}
                          >
                            Recorded by{' '}
                            {
                              entry.recordedBy
                            }
                          </Text>
                        </View>
                      </View>
                    )
                  )
                )}
              </ScrollView>

              <TouchableOpacity
                style={
                  styles.cancelButton
                }
                onPress={() =>
                  setHistoryModalVisible(
                    false
                  )
                }
              >
                <Text
                  allowFontScaling
                  style={[
                    styles.cancelButtonText,
                    {
                      color:
                        textColor,
                      fontSize:
                        bodySize,
                    },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ========================================
  // SCREEN
  // ========================================

  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7FB',
  },

  highContrastBackground: {
    backgroundColor: '#FFFFFF',
  },

  flex: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 110,
  },

  largeContent: {
    paddingBottom: 130,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F7FB',
  },

  loadingText: {
    marginTop: 14,
    color: '#374151',
    fontWeight: '600',
  },

  // ========================================
  // HEADER
  // ========================================

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 14,
  },

  title: {
    color: '#111827',
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: '#6B7280',
    marginTop: 5,
    lineHeight: 22,
  },

  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },

  // ========================================
  // GENERAL CARDS
  // ========================================

  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 22,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
  },

  cardTitle: {
    color: '#111827',
    fontWeight: '800',
    marginTop: 15,
  },

  cardDescription: {
    color: '#6B7280',
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 18,
  },

  // ========================================
  // PRIMARY BUTTONS
  // ========================================

  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ========================================
  // EMPTY STATE
  // ========================================

  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 23,
    alignItems: 'flex-start',
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
  },

  emptyTitle: {
    color: '#111827',
    fontWeight: '800',
    marginTop: 15,
  },

  emptyDescription: {
    color: '#6B7280',
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 18,
  },

  // ========================================
  // PATIENT CONNECTION CARD
  // ========================================

  patientCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },

  patientIconCircle: {
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
    color: '#111827',
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
    color: '#6B7280',
    fontWeight: '500',
  },

  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },

  syncText: {
    color: '#4F46E5',
    fontWeight: '700',
  },

  // ========================================
  // STAT CARDS
  // ========================================

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25,
  },

  statCard: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 17,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },

  statNumber: {
    color: '#111827',
    fontWeight: '800',
    marginTop: 6,
  },

  statLabel: {
    color: '#6B7280',
    fontWeight: '500',
  },

  // ========================================
  // SECTION HEADER
  // ========================================

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  sectionHeaderText: {
    flex: 1,
    paddingRight: 12,
  },

  sectionTitle: {
    color: '#111827',
    fontWeight: '800',
  },

  sectionSubtitle: {
    color: '#6B7280',
    marginTop: 4,
  },

  addButton: {
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ========================================
  // SEARCH
  // ========================================

  searchContainer: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    backgroundColor: '#FFFFFF',
  },

  searchInput: {
    flex: 1,
    marginLeft: 9,
    paddingVertical: 9,
    color: '#111827',
  },

  // ========================================
  // INACTIVE FILTER
  // ========================================

  inactiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    marginBottom: 12,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    backgroundColor: '#FFFFFF',
  },

  checkboxSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },

  inactiveToggleText: {
    color: '#374151',
    fontWeight: '600',
  },

  // ========================================
  // MEDICATION CARDS
  // ========================================

  medicationCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    padding: 17,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },

  inactiveCard: {
    opacity: 0.72,
  },

  medicationTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  medicationIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  medicationTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  medicationName: {
    color: '#111827',
    fontWeight: '800',
    marginRight: 8,
  },

  inactiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },

  inactiveBadgeText: {
    color: '#6B7280',
    fontWeight: '700',
  },

  dosageText: {
    color: '#6B7280',
    marginTop: 3,
  },

  // ========================================
  // MEDICATION DETAILS
  // ========================================

  detailsContainer: {
    marginTop: 17,
    gap: 9,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },

  detailText: {
    flex: 1,
    color: '#4B5563',
    lineHeight: 22,
  },

  notesBox: {
    marginTop: 3,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F7FB',
  },

  notesLabel: {
    color: '#111827',
    fontWeight: '800',
    marginBottom: 3,
  },

  notesText: {
    color: '#6B7280',
    lineHeight: 21,
  },

  // ========================================
  // TODAY'S DOSE
  // ========================================

  todayDoseCard: {
    marginTop: 17,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  todayDoseComplete: {
    backgroundColor: '#ECFDF3',
  },

  todayDoseLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  todayDoseTitle: {
    color: '#111827',
    fontWeight: '800',
  },

  lastTakenText: {
    color: '#6B7280',
    marginTop: 2,
  },

  recordButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  recordButtonSecondary: {
    backgroundColor: '#6B7280',
  },

  recordButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // ========================================
  // ACTION ROW
  // ========================================

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  actionButton: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },

  actionButtonText: {
    color: '#6366F1',
    fontWeight: '700',
  },

  undoButton: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },

  undoText: {
    color: '#6B7280',
    fontWeight: '600',
  },

  // ========================================
  // INFO CARD
  // ========================================

  infoCard: {
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 17,
    padding: 17,
    marginTop: 3,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F8F9FF',
  },

  infoTextContainer: {
    flex: 1,
  },

  infoTitle: {
    color: '#111827',
    fontWeight: '800',
  },

  infoDescription: {
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 4,
  },

  // ========================================
  // MODAL
  // ========================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(17, 24, 39, 0.38)',
    justifyContent: 'flex-end',
  },

  modalKeyboard: {
    width: '100%',
    maxHeight: '94%',
  },

  formModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom:
      Platform.OS === 'ios'
        ? 28
        : 20,
    maxHeight: '94%',
    backgroundColor: '#FFFFFF',
  },

  historyModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom:
      Platform.OS === 'ios'
        ? 28
        : 20,
    height: '82%',
    backgroundColor: '#FFFFFF',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 13,
  },

  modalTitle: {
    color: '#111827',
    fontWeight: '800',
  },

  modalSubtitle: {
    color: '#6B7280',
    marginTop: 3,
  },

  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  formContent: {
    paddingBottom: 30,
  },

  // ========================================
  // FORM
  // ========================================

  inputLabel: {
    color: '#111827',
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 7,
  },

  input: {
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },

  multilineInput: {
    minHeight: 100,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },

  frequencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  frequencyOption: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  frequencyText: {
    color: '#374151',
    fontWeight: '700',
  },

  // ========================================
  // FORM NOTICE
  // ========================================

  formNotice: {
    marginTop: 17,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F7FB',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },

  formNoticeText: {
    flex: 1,
    color: '#6B7280',
    lineHeight: 19,
  },

  // ========================================
  // FORM BUTTONS
  // ========================================

  saveButton: {
    minHeight: 53,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  cancelButton: {
    minHeight: 48,
    borderRadius: 14,
    marginTop: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },

  cancelButtonText: {
    color: '#374151',
    fontWeight: '800',
  },

  // ========================================
  // HISTORY
  // ========================================

  historyTitleContainer: {
    flex: 1,
  },

  historySummary: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    backgroundColor: '#FFFFFF',
  },

  historySummaryLabel: {
    color: '#6B7280',
    fontWeight: '600',
  },

  historySummaryValue: {
    color: '#111827',
    fontWeight: '800',
    marginTop: 3,
  },

  historyScroll: {
    flex: 1,
  },

  historyEmpty: {
    alignItems: 'center',
    paddingVertical: 45,
    paddingHorizontal: 20,
  },

  historyEmptyTitle: {
    color: '#111827',
    fontWeight: '800',
    marginTop: 12,
  },

  historyEmptyText: {
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 5,
  },

  historyItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
  },

  historyIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyItemContent: {
    flex: 1,
  },

  historyItemTitle: {
    color: '#111827',
    fontWeight: '800',
  },

  historyItemMeta: {
    color: '#6B7280',
    marginTop: 2,
  },
});