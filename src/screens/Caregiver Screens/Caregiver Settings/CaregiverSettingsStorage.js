import AsyncStorage from '@react-native-async-storage/async-storage';


// ==========================================
// STORAGE KEYS
// ==========================================

export const ACCOUNTS_KEY = 'strokebuddy_accounts';

export const DEFAULT_CAREGIVER_SETTINGS = {
  notificationsEnabled: true,
  medicationAlerts: true,
  exerciseAlerts: true,
  messageAlerts: true,
  emergencyAlerts: true,

  caregiverSound: true,

  recoveryUpdates: true,
  medicationActivity: true,
  exerciseActivity: true,
  patientMessages: true,
};


// ==========================================
// GET SETTINGS KEY
// ==========================================

export const getCaregiverSettingsKey = (
  accountId
) => {
  return `strokebuddy_caregiver_settings_${
    accountId || 'default_caregiver'
  }`;
};


// ==========================================
// LOAD CAREGIVER SETTINGS
// ==========================================

export const loadCaregiverSettings = async (
  accountId
) => {

  try {

    const key =
      getCaregiverSettingsKey(accountId);

    const saved =
      await AsyncStorage.getItem(key);

    if (!saved) {
      return {
        ...DEFAULT_CAREGIVER_SETTINGS,
      };
    }

    const parsed =
      JSON.parse(saved);

    return {
      ...DEFAULT_CAREGIVER_SETTINGS,
      ...(parsed || {}),
    };

  } catch (error) {

    console.log(
      'Load caregiver settings error:',
      error
    );

    return {
      ...DEFAULT_CAREGIVER_SETTINGS,
    };

  }

};


// ==========================================
// WRITE QUEUE
// ==========================================

/*
 * Updating one setting is "read the whole record, change one field, write the
 * whole record back". If two updates run at the same time (for example, the
 * user flips two switches quickly), both read the SAME old record and the
 * second write silently erases the first change.
 *
 * Every write goes through this queue so they run strictly one after another.
 * A failed write never blocks the writes queued behind it.
 */

let writeQueue = Promise.resolve();

const enqueueWrite = (task) => {

  const result =
    writeQueue.then(task);

  writeQueue =
    result.catch(() => {});

  return result;

};


// ==========================================
// SAVE CAREGIVER SETTINGS
// ==========================================

const writeCaregiverSettings = async (
  accountId,
  settings
) => {

  const key =
    getCaregiverSettingsKey(accountId);

  const mergedSettings = {
    ...DEFAULT_CAREGIVER_SETTINGS,
    ...(settings || {}),
  };

  await AsyncStorage.setItem(
    key,
    JSON.stringify(mergedSettings)
  );

  return mergedSettings;

};

export const saveCaregiverSettings = (
  accountId,
  settings
) => {

  return enqueueWrite(() =>
    writeCaregiverSettings(
      accountId,
      settings
    )
  );

};


// ==========================================
// UPDATE ONE SETTING
// ==========================================

export const updateCaregiverSetting = (
  accountId,
  settingName,
  value
) => {

  return enqueueWrite(async () => {

    const current =
      await loadCaregiverSettings(accountId);

    const updated = {
      ...current,
      [settingName]: value === true,
    };

    await writeCaregiverSettings(
      accountId,
      updated
    );

    return updated;

  });

};


// ==========================================
// RESET SETTINGS
// ==========================================

export const resetCaregiverSettings = async (
  accountId
) => {

  const defaults = {
    ...DEFAULT_CAREGIVER_SETTINGS,
  };

  await saveCaregiverSettings(
    accountId,
    defaults
  );

  return defaults;

};


// ==========================================
// LOAD ACCOUNT
// ==========================================

export const loadCaregiverAccount = async (
  accountId
) => {

  try {

    const savedAccounts =
      await AsyncStorage.getItem(
        ACCOUNTS_KEY
      );

    if (!savedAccounts) {
      return null;
    }

    const accounts =
      JSON.parse(savedAccounts);

    if (!Array.isArray(accounts)) {
      return null;
    }

    return (
      accounts.find(
        (item) =>
          item.id === accountId &&
          item.role === 'caregiver'
      ) || null
    );

  } catch (error) {

    console.log(
      'Load caregiver account error:',
      error
    );

    return null;

  }

};


// ==========================================
// LOAD ALL ACCOUNTS
// ==========================================

export const loadAccounts = async () => {

  try {

    const savedAccounts =
      await AsyncStorage.getItem(
        ACCOUNTS_KEY
      );

    if (!savedAccounts) {
      return [];
    }

    const accounts =
      JSON.parse(savedAccounts);

    return Array.isArray(accounts)
      ? accounts
      : [];

  } catch (error) {

    console.log(
      'Load accounts error:',
      error
    );

    return [];

  }

};


// ==========================================
// SAVE ALL ACCOUNTS
// ==========================================

export const saveAccounts = async (
  accounts
) => {

  await AsyncStorage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify(accounts)
  );

};