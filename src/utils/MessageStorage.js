import AsyncStorage from '@react-native-async-storage/async-storage';


// ==========================================
// STROKEBUDDY MESSAGE STORAGE
// ==========================================

const MESSAGES_KEY = 'strokebuddy_messages';


// ==========================================
// GET ALL MESSAGES
// ==========================================

export const getMessages = async () => {

  try {

    const savedMessages =
      await AsyncStorage.getItem(
        MESSAGES_KEY
      );

    return savedMessages
      ? JSON.parse(savedMessages)
      : [];

  } catch (error) {

    console.log(
      'Get messages error:',
      error
    );

    return [];

  }

};


// ==========================================
// SAVE ALL MESSAGES
// ==========================================

export const saveMessages = async (
  messages
) => {

  try {

    await AsyncStorage.setItem(
      MESSAGES_KEY,
      JSON.stringify(messages)
    );

  } catch (error) {

    console.log(
      'Save messages error:',
      error
    );

  }

};


// ==========================================
// SEND MESSAGE
// ==========================================

export const sendMessage = async ({
  patientId,
  caregiverId,
  senderId,
  senderRole,
  text,
  type = 'text',
}) => {

  if (
    !patientId ||
    !senderId ||
    !text?.trim()
  ) {

    return null;

  }


  const messages =
    await getMessages();


  const newMessage = {

    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`,

    patientId,

    caregiverId:
      caregiverId || null,

    senderId,

    senderRole,

    text:
      text.trim(),

    type,

    createdAt:
      new Date().toISOString(),

    read: false,

  };


  const updatedMessages = [

    ...messages,

    newMessage,

  ];


  await saveMessages(
    updatedMessages
  );


  return newMessage;

};


// ==========================================
// GET MESSAGES FOR PATIENT
// ==========================================

export const getPatientMessages = async (
  patientId
) => {

  if (!patientId) {
    return [];
  }


  const messages =
    await getMessages();


  return messages.filter(
    (message) =>
      message.patientId === patientId
  );

};


// ==========================================
// GET MESSAGES FOR CAREGIVER
// ==========================================

export const getCaregiverMessages = async (
  caregiverId
) => {

  if (!caregiverId) {
    return [];
  }


  const messages =
    await getMessages();


  return messages.filter(
    (message) =>
      message.caregiverId === caregiverId
  );

};


// ==========================================
// MARK MESSAGE AS READ
// ==========================================

export const markMessageAsRead = async (
  messageId
) => {

  const messages =
    await getMessages();


  const updatedMessages =
    messages.map(
      (message) => {

        if (
          message.id === messageId
        ) {

          return {
            ...message,
            read: true,
          };

        }

        return message;

      }
    );


  await saveMessages(
    updatedMessages
  );

};


// ==========================================
// MARK ALL MESSAGES AS READ
// ==========================================

export const markMessagesAsRead = async ({
  patientId,
  caregiverId,
}) => {

  const messages =
    await getMessages();


  const updatedMessages =
    messages.map(
      (message) => {

        const matchesPatient =
          !patientId ||
          message.patientId === patientId;

        const matchesCaregiver =
          !caregiverId ||
          message.caregiverId === caregiverId;


        if (
          matchesPatient &&
          matchesCaregiver
        ) {

          return {
            ...message,
            read: true,
          };

        }


        return message;

      }
    );


  await saveMessages(
    updatedMessages
  );

};


// ==========================================
// DELETE ALL MESSAGES
// ==========================================

export const clearMessages = async () => {

  try {

    await AsyncStorage.removeItem(
      MESSAGES_KEY
    );

  } catch (error) {

    console.log(
      'Clear messages error:',
      error
    );

  }

};