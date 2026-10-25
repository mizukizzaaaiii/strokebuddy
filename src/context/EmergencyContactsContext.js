import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  getEmergencyContacts,
  saveEmergencyContacts,
} from '../storage/Storage';


// ==========================================
// CONTEXT
// ==========================================

const EmergencyContactsContext =
  createContext(null);


// ==========================================
// DEFAULT CONTACTS
// ==========================================
//
// IMPORTANT:
// New patients should NOT automatically receive
// a fake/demo emergency contact.
//
// An empty array means the patient has not
// configured an emergency contact yet.
//

const DEFAULT_CONTACTS = [];


// ==========================================
// PROVIDER
// ==========================================

export function EmergencyContactsProvider({
  children,
}) {

  const [
    contacts,
    setContacts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ==========================================
  // LOAD CONTACTS
  // ==========================================

  useEffect(() => {

    loadContacts();

  }, []);


  const loadContacts = async () => {

    try {

      const savedContacts =
        await getEmergencyContacts();


      // ========================================
      // USE SAVED CONTACTS
      // ========================================

      if (
        Array.isArray(savedContacts) &&
        savedContacts.length > 0
      ) {

        setContacts(savedContacts);

      }

      // ========================================
      // NO CONTACTS YET
      // ========================================

      else {

        setContacts(
          DEFAULT_CONTACTS
        );

      }

    } catch (error) {

      console.log(
        'Error loading emergency contacts:',
        error
      );

      setContacts(
        DEFAULT_CONTACTS
      );

    } finally {

      setLoading(false);

    }

  };


  // ==========================================
  // PRIMARY CONTACT
  // ==========================================

  const primaryContact =
    contacts.find(
      (contact) =>
        contact.primary === true
    ) || null;


  // ==========================================
  // ADD CONTACT
  // ==========================================

  const addContact = async (
    newContact
  ) => {

    try {

      const currentContacts =
        await getEmergencyContacts() || [];


      let updatedContacts;


      // ========================================
      // NEW CONTACT IS PRIMARY
      // ========================================

      if (newContact.primary) {

        updatedContacts = [

          ...currentContacts.map(
            (contact) => ({
              ...contact,
              primary: false,
            })
          ),

          newContact,

        ];

      }

      // ========================================
      // NEW CONTACT IS NOT PRIMARY
      // ========================================

      else {

        updatedContacts = [

          ...currentContacts,

          newContact,

        ];

      }


      // ========================================
      // SAVE
      // ========================================

      await saveEmergencyContacts(
        updatedContacts
      );


      // ========================================
      // UPDATE STATE
      // ========================================

      setContacts(
        updatedContacts
      );

    } catch (error) {

      console.log(
        'Add emergency contact error:',
        error
      );

      throw error;

    }

  };


  // ==========================================
  // DELETE CONTACT
  // ==========================================

  const deleteContact = async (
    id
  ) => {

    try {

      const currentContacts =
        await getEmergencyContacts() || [];


      const deletedContact =
        currentContacts.find(
          (contact) =>
            contact.id === id
        );


      let updatedContacts =
        currentContacts.filter(
          (contact) =>
            contact.id !== id
        );


      // ========================================
      // IF PRIMARY WAS DELETED
      // ========================================
      //
      // Automatically make the first remaining
      // contact primary.
      //

      if (
        deletedContact?.primary &&
        updatedContacts.length > 0
      ) {

        updatedContacts =
          updatedContacts.map(
            (contact, index) => ({
              ...contact,
              primary: index === 0,
            })
          );

      }


      // ========================================
      // SAVE
      // ========================================

      await saveEmergencyContacts(
        updatedContacts
      );


      // ========================================
      // UPDATE STATE
      // ========================================

      setContacts(
        updatedContacts
      );

    } catch (error) {

      console.log(
        'Delete emergency contact error:',
        error
      );

      throw error;

    }

  };


  // ==========================================
  // MAKE PRIMARY
  // ==========================================

  const makePrimary = async (
    id
  ) => {

    try {

      const currentContacts =
        await getEmergencyContacts() || [];


      const contactExists =
        currentContacts.some(
          (contact) =>
            contact.id === id
        );


      if (!contactExists) {

        return;

      }


      // ========================================
      // ONLY ONE PRIMARY CONTACT
      // ========================================

      const updatedContacts =
        currentContacts.map(
          (contact) => ({
            ...contact,

            primary:
              contact.id === id,

          })
        );


      // ========================================
      // SAVE
      // ========================================

      await saveEmergencyContacts(
        updatedContacts
      );


      // ========================================
      // UPDATE STATE
      // ========================================

      setContacts(
        updatedContacts
      );

    } catch (error) {

      console.log(
        'Make primary contact error:',
        error
      );

      throw error;

    }

  };


  // ==========================================
  // CONTEXT
  // ==========================================

  return (

    <EmergencyContactsContext.Provider
      value={{
        contacts,

        primaryContact,

        addContact,

        deleteContact,

        makePrimary,

        loading,
      }}
    >

      {children}

    </EmergencyContactsContext.Provider>

  );

}


// ==========================================
// HOOK
// ==========================================

export function useEmergencyContacts() {

  const context =
    useContext(
      EmergencyContactsContext
    );


  if (!context) {

    throw new Error(
      'useEmergencyContacts must be used inside EmergencyContactsProvider'
    );

  }


  return context;

}