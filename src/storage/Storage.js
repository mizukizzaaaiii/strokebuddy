import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER: '@strokebuddy_user',
  MEDICATIONS: '@strokebuddy_medications',
  EMERGENCY_CONTACTS: '@strokebuddy_emergency_contacts',
  PT_PROGRESS: '@strokebuddy_pt_progress',
  VOICE_MESSAGES: '@strokebuddy_voice_messages',
};

// -------------------------
// Generic helpers
// -------------------------

async function getData(key, defaultValue) {
  try {
    const value = await AsyncStorage.getItem(key);

    if (value === null) {
      return defaultValue;
    }

    return JSON.parse(value);
  } catch (error) {
    console.log(`Storage read error (${key}):`, error);
    return defaultValue;
  }
}

async function saveData(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.log(`Storage save error (${key}):`, error);
    return false;
  }
}

async function removeData(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.log(`Storage delete error (${key}):`, error);
    return false;
  }
}

// -------------------------
// User
// -------------------------

export async function getUser() {
  return getData(KEYS.USER, null);
}

export async function saveUser(user) {
  return saveData(KEYS.USER, user);
}

export async function clearUser() {
  return removeData(KEYS.USER);
}

// -------------------------
// Medications
// -------------------------

export async function getMedications() {
  return getData(KEYS.MEDICATIONS, []);
}

export async function saveMedications(medications) {
  return saveData(KEYS.MEDICATIONS, medications);
}

export async function addMedication(medication) {
  const medications = await getMedications();

  const newMedication = {
    ...medication,
    id: Date.now().toString(),
  };

  medications.push(newMedication);

  await saveMedications(medications);

  return newMedication;
}

export async function deleteMedication(id) {
  const medications = await getMedications();

  const updated = medications.filter(
    (medication) => medication.id !== id
  );

  return saveMedications(updated);
}

// -------------------------
// Emergency Contacts
// -------------------------

export async function getEmergencyContacts() {
  return getData(KEYS.EMERGENCY_CONTACTS, []);
}

export async function saveEmergencyContacts(contacts) {
  return saveData(KEYS.EMERGENCY_CONTACTS, contacts);
}

export async function addEmergencyContact(contact) {
  const contacts = await getEmergencyContacts();

  const newContact = {
    ...contact,
    id: Date.now().toString(),
  };

  contacts.push(newContact);

  await saveEmergencyContacts(contacts);

  return newContact;
}

export async function deleteEmergencyContact(id) {
  const contacts = await getEmergencyContacts();

  const updated = contacts.filter(
    (contact) => contact.id !== id
  );

  return saveEmergencyContacts(updated);
}

// -------------------------
// PT Progress
// -------------------------

const DEFAULT_PT_PROGRESS = {
  totalSessions: 0,
  totalExercises: 0,
  totalReps: 0,
  currentStreak: 0,
  bestStreak: 0,
  recoveryProgress: 0,
  lastExerciseDate: null,
};

export async function getPTProgress() {
  return getData(KEYS.PT_PROGRESS, DEFAULT_PT_PROGRESS);
}

export async function savePTProgress(progress) {
  return saveData(KEYS.PT_PROGRESS, progress);
}

export async function updatePTProgress(updates) {
  const current = await getPTProgress();

  const updated = {
    ...current,
    ...updates,
  };

  await savePTProgress(updated);

  return updated;
}

// -------------------------
// Voice Messages
// -------------------------

export async function getVoiceMessages() {
  return getData(KEYS.VOICE_MESSAGES, []);
}

export async function saveVoiceMessages(messages) {
  return saveData(KEYS.VOICE_MESSAGES, messages);
}

export async function addVoiceMessage(message) {
  const messages = await getVoiceMessages();

  const newMessage = {
    ...message,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };

  messages.unshift(newMessage);

  await saveVoiceMessages(messages);

  return newMessage;
}

export async function deleteVoiceMessage(id) {
  const messages = await getVoiceMessages();

  const updated = messages.filter(
    (message) => message.id !== id
  );

  return saveVoiceMessages(updated);
}