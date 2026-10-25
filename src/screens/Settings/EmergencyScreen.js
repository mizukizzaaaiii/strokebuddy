import React, {
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Linking,
  Switch,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useEmergencyContacts,
} from '../../context/EmergencyContactsContext';

import {
  useAccessibility,
} from '../../context/AccessibilityContext';


// ---------------------------------------------------------
// Main screen
// ---------------------------------------------------------

export default function EmergencyScreen({
  navigation,
}) {
  const {
    contacts,
    addContact,
    deleteContact,
    makePrimary,
  } = useEmergencyContacts();

  const {
    largeText,
    highContrast,
  } = useAccessibility();


  // -------------------------------------------------------
  // Font helper
  // -------------------------------------------------------

  const font = (
    normal,
    large
  ) =>
    largeText
      ? large
      : normal;


  // -------------------------------------------------------
  // Add form state
  // -------------------------------------------------------

  const [
    showAddForm,
    setShowAddForm,
  ] = useState(false);

  const [
    name,
    setName,
  ] = useState('');

  const [
    relationship,
    setRelationship,
  ] = useState('');

  const [
    phone,
    setPhone,
  ] = useState('');

  const [
    primary,
    setPrimary,
  ] = useState(false);

  const [
    hasAccount,
    setHasAccount,
  ] = useState(false);

  const [
    account,
    setAccount,
  ] = useState('');


  // -------------------------------------------------------
  // Reset form
  // -------------------------------------------------------

  const resetForm = () => {
    setName('');
    setRelationship('');
    setPhone('');
    setPrimary(false);
    setHasAccount(false);
    setAccount('');
  };


  // -------------------------------------------------------
  // Add new contact
  // -------------------------------------------------------

  const addNewContact = () => {
    if (
      !name.trim() ||
      !relationship.trim() ||
      !phone.trim()
    ) {
      Alert.alert(
        'Missing Information',
        'Please enter the contact name, relationship, and phone number.'
      );

      return;
    }


    if (
      hasAccount &&
      !account.trim()
    ) {
      Alert.alert(
        'Missing Information',
        'Please enter their StrokeBuddy account.'
      );

      return;
    }


    const newContact = {
      id: Date.now().toString(),
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      primary,
      hasAccount,
      account: hasAccount
        ? account.trim()
        : '',
    };


    addContact(
      newContact
    );


    resetForm();

    setShowAddForm(
      false
    );


    Alert.alert(
      'Contact Added',
      `${newContact.name} was added to your emergency contacts.`
    );
  };


  // -------------------------------------------------------
  // Call contact
  // -------------------------------------------------------

  const callContact = (
    contact
  ) => {
    Alert.alert(
      `Call ${contact.name}?`,
      `${contact.relationship}\n${contact.phone}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(
              `tel:${contact.phone}`
            );
          },
        },
      ]
    );
  };


  // -------------------------------------------------------
  // Remove contact
  // -------------------------------------------------------

  const removeContact = (
    contact
  ) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name} from your emergency contacts?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Remove',
          style: 'destructive',

          onPress: () =>
            deleteContact(
              contact.id
            ),
        },
      ]
    );
  };


  // -------------------------------------------------------
  // Set primary contact
  // -------------------------------------------------------

  const setPrimaryContact = (
    contact
  ) => {
    makePrimary(
      contact.id
    );


    Alert.alert(
      'Primary Caregiver Updated',
      `${contact.name} is now your primary caregiver.`
    );
  };


  // -------------------------------------------------------
  // Call 911
  // -------------------------------------------------------

  const call911 = () => {
    Alert.alert(
      'Emergency Services',
      'Only use this for a real emergency. Would you like to call 911?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },

        {
          text: 'Call 911',
          style: 'destructive',

          onPress: () =>
            Linking.openURL(
              'tel:911'
            ),
        },
      ]
    );
  };


  // -------------------------------------------------------
  // Phone number formatting
  // -------------------------------------------------------

  const handlePhoneChange = (
    text
  ) => {
    const numbers =
      text
        .replace(/\D/g, '')
        .slice(0, 10);

    let formatted =
      numbers;


    if (
      numbers.length > 6
    ) {
      formatted =
        `(${numbers.slice(
          0,
          3
        )}) ${numbers.slice(
          3,
          6
        )}-${numbers.slice(
          6
        )}`;
    } else if (
      numbers.length > 3
    ) {
      formatted =
        `(${numbers.slice(
          0,
          3
        )}) ${numbers.slice(
          3
        )}`;
    } else if (
      numbers.length > 0
    ) {
      formatted =
        `(${numbers}`;
    }


    setPhone(
      formatted
    );
  };


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

        {/* -------------------------------------------------
            Header
        ------------------------------------------------- */}

        <View
          style={
            styles.header
          }
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
              Emergency Contacts
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
              People you can quickly contact when you need help.
            </Text>

          </View>

        </View>


        {/* -------------------------------------------------
            Emergency Services
        ------------------------------------------------- */}

        <TouchableOpacity
          style={[
            styles.sosCard,

            highContrast &&
              styles.highContrastSosCard,
          ]}
          onPress={
            call911
          }
          activeOpacity={0.8}
        >

          <View
            style={[
              styles.sosIcon,

              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={
                largeText
                  ? 27
                  : 23
              }
              color={
                highContrast
                  ? '#000000'
                  : '#E11D48'
              }
            />
          </View>


          <View
            style={
              styles.sosInfo
            }
          >

            <Text
              style={[
                styles.sosTitle,

                {
                  fontSize:
                    font(15, 19),

                  lineHeight:
                    font(20, 25),

                  color:
                    highContrast
                      ? '#000000'
                      : '#9F1239',
                },
              ]}
            >
              Emergency Services
            </Text>


            <Text
              style={[
                styles.sosSub,

                {
                  fontSize:
                    font(11, 15),

                  lineHeight:
                    font(17, 21),

                  color:
                    highContrast
                      ? '#000000'
                      : '#BE123C',
                },
              ]}
            >
              Call 911 for a real emergency
            </Text>

          </View>


          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 24
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#E11D48'
            }
          />

        </TouchableOpacity>


        {/* -------------------------------------------------
            Contacts section
        ------------------------------------------------- */}

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
          Your Contacts
        </Text>


        {/* -------------------------------------------------
            Empty state
        ------------------------------------------------- */}

        {contacts.length === 0 && (
          <View
            style={[
              styles.emptyCard,

              highContrast &&
                styles.highContrastCard,
            ]}
          >

            <View
              style={[
                styles.emptyIcon,

                highContrast &&
                  styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="people-outline"
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


            <Text
              style={[
                styles.emptyTitle,

                {
                  fontSize:
                    font(16, 20),

                  lineHeight:
                    font(21, 26),

                  color:
                    highContrast
                      ? '#000000'
                      : '#111827',
                },
              ]}
            >
              No emergency contacts yet
            </Text>


            <Text
              style={[
                styles.emptyDescription,

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
              Add someone you trust so you can quickly reach them when you need help.
            </Text>

          </View>
        )}


        {/* -------------------------------------------------
            Contact cards
        ------------------------------------------------- */}

        {contacts.map(
          (contact) => (
            <View
              key={
                contact.id
              }
              style={[
                styles.card,

                highContrast &&
                  styles.highContrastCard,
              ]}
            >

              <View
                style={
                  styles.cardTop
                }
              >

                {/* Person icon */}

                <View
                  style={[
                    styles.personIcon,

                    highContrast &&
                      styles.highContrastIconCircle,
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={
                      largeText
                        ? 24
                        : 20
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : '#5B6CFF'
                    }
                  />
                </View>


                {/* Contact information */}

                <View
                  style={
                    styles.contactInfo
                  }
                >

                  <View
                    style={
                      styles.nameRow
                    }
                  >

                    <Text
                      style={[
                        styles.name,

                        {
                          fontSize:
                            font(16, 20),

                          lineHeight:
                            font(21, 26),

                          color:
                            highContrast
                              ? '#000000'
                              : '#111827',
                        },
                      ]}
                    >
                      {contact.name}
                    </Text>


                    {contact.primary && (
                      <View
                        style={[
                          styles.primaryBadge,

                          highContrast &&
                            styles.highContrastBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.primaryText,

                            {
                              fontSize:
                                font(9, 13),

                              lineHeight:
                                font(12, 17),

                              color:
                                highContrast
                                  ? '#000000'
                                  : '#5B6CFF',
                            },
                          ]}
                        >
                          Primary
                        </Text>
                      </View>
                    )}

                  </View>


                  <Text
                    style={[
                      styles.sub,

                      {
                        fontSize:
                          font(12, 16),

                        lineHeight:
                          font(17, 21),

                        color:
                          highContrast
                            ? '#000000'
                            : '#6B7280',
                      },
                    ]}
                  >
                    {contact.relationship}
                  </Text>


                  <Text
                    style={[
                      styles.phone,

                      {
                        fontSize:
                          font(12, 16),

                        lineHeight:
                          font(17, 21),

                        color:
                          highContrast
                            ? '#000000'
                            : '#6B7280',
                      },
                    ]}
                  >
                    {contact.phone}
                  </Text>


                  {contact.hasAccount && (
                    <View
                      style={
                        styles.accountRow
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
                            : '#4F8A5B'
                        }
                      />

                      <Text
                        style={[
                          styles.accountText,

                          {
                            fontSize:
                              font(11, 15),

                            lineHeight:
                              font(16, 20),

                            color:
                              highContrast
                                ? '#000000'
                                : '#4F8A5B',
                          },
                        ]}
                      >
                        StrokeBuddy caregiver
                      </Text>

                    </View>
                  )}

                </View>

              </View>


              {/* -------------------------------------------------
                  Action buttons
              ------------------------------------------------- */}

              <View
                style={[
                  styles.actionsRow,

                  highContrast &&
                    styles.highContrastDivider,
                ]}
              >

                <TouchableOpacity
                  style={[
                    styles.callButton,

                    highContrast &&
                      styles.highContrastPrimaryButton,
                  ]}
                  onPress={() =>
                    callContact(
                      contact
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="call-outline"
                    size={
                      largeText
                        ? 21
                        : 18
                    }
                    color="#FFFFFF"
                  />

                  <Text
                    style={[
                      styles.callText,

                      {
                        fontSize:
                          font(12, 16),

                        lineHeight:
                          font(16, 21),
                      },
                    ]}
                  >
                    Call
                  </Text>

                </TouchableOpacity>


                {!contact.primary && (
                  <TouchableOpacity
                    style={
                      styles.secondaryButton
                    }
                    onPress={() =>
                      setPrimaryContact(
                        contact
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.secondaryText,

                        {
                          fontSize:
                            font(11, 15),

                          lineHeight:
                            font(16, 20),

                          color:
                            highContrast
                              ? '#000000'
                              : '#5B6CFF',
                        },
                      ]}
                    >
                      Make Primary
                    </Text>
                  </TouchableOpacity>
                )}


                <TouchableOpacity
                  style={
                    styles.deleteButton
                  }
                  onPress={() =>
                    removeContact(
                      contact
                    )
                  }
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name="trash-outline"
                    size={
                      largeText
                        ? 22
                        : 18
                    }
                    color={
                      highContrast
                        ? '#000000'
                        : '#9CA3AF'
                    }
                  />
                </TouchableOpacity>

              </View>

            </View>
          )
        )}


        {/* -------------------------------------------------
            Add button
        ------------------------------------------------- */}

        {!showAddForm && (
          <TouchableOpacity
            style={[
              styles.addBtn,

              highContrast &&
                styles.highContrastAddButton,
            ]}
            onPress={() =>
              setShowAddForm(
                true
              )
            }
            activeOpacity={0.8}
          >

            <Ionicons
              name="add"
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


            <Text
              style={[
                styles.addBtnText,

                {
                  fontSize:
                    font(14, 18),

                  lineHeight:
                    font(19, 24),

                  color:
                    highContrast
                      ? '#000000'
                      : '#5B6CFF',
                },
              ]}
            >
              Add New Contact
            </Text>

          </TouchableOpacity>
        )}


        {/* -------------------------------------------------
            Add form
        ------------------------------------------------- */}

        {showAddForm && (
          <View
            style={[
              styles.formCard,

              highContrast &&
                styles.highContrastCard,
            ]}
          >

            {/* Form header */}

            <View
              style={
                styles.formHeader
              }
            >

              <Text
                style={[
                  styles.formTitle,

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
                New Emergency Contact
              </Text>


              <TouchableOpacity
                onPress={() => {
                  resetForm();

                  setShowAddForm(
                    false
                  );
                }}
              >
                <Ionicons
                  name="close"
                  size={
                    largeText
                      ? 27
                      : 23
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#6B7280'
                  }
                />
              </TouchableOpacity>

            </View>


            {/* Name */}

            <Text
              style={[
                styles.label,

                {
                  fontSize:
                    font(13, 17),

                  lineHeight:
                    font(18, 22),

                  color:
                    highContrast
                      ? '#000000'
                      : '#374151',
                },
              ]}
            >
              Name
            </Text>


            <TextInput
              style={[
                styles.input,

                {
                  fontSize:
                    font(14, 18),

                  lineHeight:
                    font(19, 24),

                  color:
                    highContrast
                      ? '#000000'
                      : '#1F2937',
                },

                highContrast &&
                  styles.highContrastInput,
              ]}
              placeholder="e.g. Jane Doe"
              placeholderTextColor={
                highContrast
                  ? '#000000'
                  : '#9CA3AF'
              }
              value={
                name
              }
              onChangeText={
                setName
              }
              autoCapitalize="words"
            />


            {/* Relationship */}

            <Text
              style={[
                styles.label,

                {
                  fontSize:
                    font(13, 17),

                  lineHeight:
                    font(18, 22),

                  color:
                    highContrast
                      ? '#000000'
                      : '#374151',
                },
              ]}
            >
              Relationship
            </Text>


            <TextInput
              style={[
                styles.input,

                {
                  fontSize:
                    font(14, 18),

                  lineHeight:
                    font(19, 24),

                  color:
                    highContrast
                      ? '#000000'
                      : '#1F2937',
                },

                highContrast &&
                  styles.highContrastInput,
              ]}
              placeholder="e.g. Daughter"
              placeholderTextColor={
                highContrast
                  ? '#000000'
                  : '#9CA3AF'
              }
              value={
                relationship
              }
              onChangeText={
                setRelationship
              }
              autoCapitalize="words"
            />


            {/* Phone */}

            <Text
              style={[
                styles.label,

                {
                  fontSize:
                    font(13, 17),

                  lineHeight:
                    font(18, 22),

                  color:
                    highContrast
                      ? '#000000'
                      : '#374151',
                },
              ]}
            >
              Phone Number
            </Text>


            <TextInput
              style={[
                styles.input,

                {
                  fontSize:
                    font(14, 18),

                  lineHeight:
                    font(19, 24),

                  color:
                    highContrast
                      ? '#000000'
                      : '#1F2937',
                },

                highContrast &&
                  styles.highContrastInput,
              ]}
              placeholder="e.g. (555) 123-4567"
              placeholderTextColor={
                highContrast
                  ? '#000000'
                  : '#9CA3AF'
              }
              keyboardType="phone-pad"
              value={
                phone
              }
              onChangeText={
                handlePhoneChange
              }
            />


            {/* Primary switch */}

            <View
              style={
                styles.switchRow
              }
            >

              <View
                style={
                  styles.switchInfo
                }
              >

                <Text
                  style={[
                    styles.switchTitle,

                    {
                      fontSize:
                        font(13, 17),

                      lineHeight:
                        font(18, 22),

                      color:
                        highContrast
                          ? '#000000'
                          : '#374151',
                    },
                  ]}
                >
                  Primary Caregiver
                </Text>


                <Text
                  style={[
                    styles.switchSub,

                    {
                      fontSize:
                        font(11, 15),

                      lineHeight:
                        font(16, 20),

                      color:
                        highContrast
                          ? '#000000'
                          : '#6B7280',
                    },
                  ]}
                >
                  Only one contact can be primary.
                </Text>

              </View>


              <Switch
                value={
                  primary
                }
                onValueChange={
                  setPrimary
                }
                trackColor={{
                  false:
                    '#D1D5DB',

                  true:
                    '#A5B4FC',
                }}
                thumbColor={
                  primary
                    ? '#5B6CFF'
                    : '#F9FAFB'
                }
                ios_backgroundColor="#D1D5DB"
              />

            </View>


            {/* StrokeBuddy account switch */}

            <View
              style={
                styles.switchRow
              }
            >

              <View
                style={
                  styles.switchInfo
                }
              >

                <Text
                  style={[
                    styles.switchTitle,

                    {
                      fontSize:
                        font(13, 17),

                      lineHeight:
                        font(18, 22),

                      color:
                        highContrast
                          ? '#000000'
                          : '#374151',
                    },
                  ]}
                >
                  StrokeBuddy Account
                </Text>


                <Text
                  style={[
                    styles.switchSub,

                    {
                      fontSize:
                        font(11, 15),

                      lineHeight:
                        font(16, 20),

                      color:
                        highContrast
                          ? '#000000'
                          : '#6B7280',
                    },
                  ]}
                >
                  Does this person have a caregiver account?
                </Text>

              </View>


              <Switch
                value={
                  hasAccount
                }
                onValueChange={
                  setHasAccount
                }
                trackColor={{
                  false:
                    '#D1D5DB',

                  true:
                    '#A5B4FC',
                }}
                thumbColor={
                  hasAccount
                    ? '#5B6CFF'
                    : '#F9FAFB'
                }
                ios_backgroundColor="#D1D5DB"
              />

            </View>


            {/* StrokeBuddy account */}

            {hasAccount && (
              <>
                <Text
                  style={[
                    styles.label,

                    {
                      fontSize:
                        font(13, 17),

                      lineHeight:
                        font(18, 22),

                      color:
                        highContrast
                          ? '#000000'
                          : '#374151',
                    },
                  ]}
                >
                  StrokeBuddy Account
                </Text>


                <TextInput
                  style={[
                    styles.input,

                    {
                      fontSize:
                        font(14, 18),

                      lineHeight:
                        font(19, 24),

                      color:
                        highContrast
                          ? '#000000'
                          : '#1F2937',
                    },

                    highContrast &&
                      styles.highContrastInput,
                  ]}
                  placeholder="e.g. caregiver@email.com"
                  placeholderTextColor={
                    highContrast
                      ? '#000000'
                      : '#9CA3AF'
                  }
                  value={
                    account
                  }
                  onChangeText={
                    setAccount
                  }
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  keyboardType="email-address"
                />
              </>
            )}


            {/* Save */}

            <TouchableOpacity
              style={[
                styles.saveButton,

                highContrast &&
                  styles.highContrastPrimaryButton,
              ]}
              onPress={
                addNewContact
              }
              activeOpacity={0.8}
            >

              <Text
                style={[
                  styles.saveButtonText,

                  {
                    fontSize:
                      font(14, 18),

                    lineHeight:
                      font(19, 24),
                  },
                ]}
              >
                ✓ Save Contact
              </Text>

            </TouchableOpacity>

          </View>
        )}


        {/* -------------------------------------------------
            Information card
        ------------------------------------------------- */}

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
                styles.highContrastIconCircle,
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
              Keep important contacts available
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
              Your emergency contacts can be called quickly from StrokeBuddy. For a life-threatening emergency, call 911.
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

  // -------------------------------------------------------
  // Background
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // Header
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // Emergency Services card
  // -------------------------------------------------------

  sosCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FDA4AF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },

  highContrastSosCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  sosIcon: {
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

  sosInfo: {
    flex: 1,
  },

  sosTitle: {
    fontWeight: '800',
    marginBottom: 3,
  },

  sosSub: {
    fontWeight: '500',
  },


  // -------------------------------------------------------
  // Section
  // -------------------------------------------------------

  sectionTitle: {
    fontWeight: '800',
    marginTop: 3,
    marginBottom: 12,
  },


  // -------------------------------------------------------
  // Empty state
  // -------------------------------------------------------

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },

  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  emptyTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },

  emptyDescription: {
    fontWeight: '500',
    textAlign: 'center',
  },


  // -------------------------------------------------------
  // Contact cards
  // -------------------------------------------------------

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
  },

  personIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  contactInfo: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  name: {
    fontWeight: '800',
  },

  primaryBadge: {
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    marginLeft: 7,
  },

  highContrastBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },

  primaryText: {
    fontWeight: '800',
  },

  sub: {
    fontWeight: '500',
    marginTop: 3,
  },

  phone: {
    fontWeight: '500',
    marginTop: 2,
  },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  accountText: {
    fontWeight: '700',
    marginLeft: 4,
  },


  // -------------------------------------------------------
  // Actions
  // -------------------------------------------------------

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  highContrastDivider: {
    borderTopColor: '#000000',
  },

  callButton: {
    backgroundColor: '#5B6CFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  highContrastPrimaryButton: {
    backgroundColor: '#000000',
  },

  callText: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 5,
  },

  secondaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  secondaryText: {
    fontWeight: '700',
  },

  deleteButton: {
    marginLeft: 'auto',
    padding: 9,
  },


  // -------------------------------------------------------
  // Add button
  // -------------------------------------------------------

  addBtn: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#5B6CFF',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 15,
  },

  highContrastAddButton: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  addBtnText: {
    fontWeight: '800',
    marginLeft: 6,
  },


  // -------------------------------------------------------
  // Form
  // -------------------------------------------------------

  formCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 15,
  },

  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  formTitle: {
    fontWeight: '800',
    flex: 1,
    paddingRight: 10,
  },

  label: {
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 5,
  },

  input: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 11,
  },

  highContrastInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },


  // -------------------------------------------------------
  // Switches
  // -------------------------------------------------------

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },

  switchInfo: {
    flex: 1,
    paddingRight: 10,
  },

  switchTitle: {
    fontWeight: '700',
  },

  switchSub: {
    fontWeight: '500',
    marginTop: 3,
  },


  // -------------------------------------------------------
  // Save button
  // -------------------------------------------------------

  saveButton: {
    backgroundColor: '#5B6CFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 9,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },


  // -------------------------------------------------------
  // Information card
  // -------------------------------------------------------

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    marginTop: 5,
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