import React, { useEffect, useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';

const ACCOUNTS_KEY = 'strokebuddy_accounts';

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  medicationAlerts: true,
  exerciseAlerts: true,
  messageAlerts: true,
  emergencyAlerts: true,
  caregiverSound: true,
  largeText: false,
  highContrast: false,
};

export default function CaregiverSettingsScreen({
  navigation,
  route,
}) {
  const accountId =
    route?.params?.accountId || null;

  const [account, setAccount] = useState(null);
  const [patientName, setPatientName] = useState(null);
  const [loading, setLoading] = useState(true);

  const [profilePicture, setProfilePicture] =
    useState(null);

  const [uploadingProfilePicture, setUploadingProfilePicture] =
    useState(false);

  const [notificationsEnabled, setNotificationsEnabled] =
    useState(true);

  const [medicationAlerts, setMedicationAlerts] =
    useState(true);

  const [exerciseAlerts, setExerciseAlerts] =
    useState(true);

  const [messageAlerts, setMessageAlerts] =
    useState(true);

  const [emergencyAlerts, setEmergencyAlerts] =
    useState(true);

  const [caregiverSound, setCaregiverSound] =
    useState(true);

  const [largeText, setLargeText] =
    useState(false);

  const [highContrast, setHighContrast] =
    useState(false);

  const getSettingsKey = () =>
    `strokebuddy_caregiver_settings_${
      accountId || 'default_caregiver'
    }`;

  // ==========================================
  // LOAD ACCOUNT
  // ==========================================

  const loadAccount = async () => {
    try {
      const savedAccounts =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!savedAccounts) {
        setAccount(null);
        setPatientName(null);
        setProfilePicture(null);
        return;
      }

      const accounts =
        JSON.parse(savedAccounts);

      if (!Array.isArray(accounts)) {
        setAccount(null);
        setPatientName(null);
        setProfilePicture(null);
        return;
      }

      const caregiver =
        accounts.find(
          (item) =>
            item.id === accountId &&
            item.role === 'caregiver'
        );

      if (!caregiver) {
        setAccount(null);
        setPatientName(null);
        setProfilePicture(null);
        return;
      }

      setAccount(caregiver);

      setProfilePicture(
        caregiver.profilePicture || null
      );

      if (caregiver.connectedPatientId) {
        const patient =
          accounts.find(
            (item) =>
              item.id ===
                caregiver.connectedPatientId &&
              item.role === 'patient'
          );

        if (patient) {
          setPatientName(
            patient.name || 'Patient'
          );
        } else {
          setPatientName(null);
        }
      } else {
        setPatientName(null);
      }
    } catch (error) {
      console.log(
        'Load caregiver account error:',
        error
      );

      setAccount(null);
      setPatientName(null);
      setProfilePicture(null);
    }
  };

  // ==========================================
  // PROFILE PICTURE
  // ==========================================

  const handlePickProfilePicture = async () => {
    try {
      if (!account?.id) {
        Alert.alert(
          'Account Unavailable',
          'Your caregiver account could not be loaded. Please try again.'
        );
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo Access Needed',
          'Please allow photo library access so you can choose a profile picture for your caregiver account.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });

      if (result.canceled) {
        return;
      }

      const selectedImage =
        result.assets?.[0]?.uri;

      if (!selectedImage) {
        return;
      }

      setUploadingProfilePicture(true);

      const savedAccounts =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!savedAccounts) {
        throw new Error(
          'No accounts were found.'
        );
      }

      const accounts =
        JSON.parse(savedAccounts);

      if (!Array.isArray(accounts)) {
        throw new Error(
          'Invalid account storage.'
        );
      }

      const caregiverIndex =
        accounts.findIndex(
          (item) =>
            item.id === account.id &&
            item.role === 'caregiver'
        );

      if (caregiverIndex === -1) {
        throw new Error(
          'Caregiver account not found.'
        );
      }

      accounts[caregiverIndex] = {
        ...accounts[caregiverIndex],
        profilePicture: selectedImage,
      };

      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(accounts)
      );

      setProfilePicture(selectedImage);

      setAccount(
        accounts[caregiverIndex]
      );

      Alert.alert(
        'Profile Picture Updated',
        'Your caregiver profile picture has been saved.'
      );
    } catch (error) {
      console.log(
        'Profile picture upload error:',
        error
      );

      Alert.alert(
        'Upload Failed',
        'We could not save your profile picture. Please try again.'
      );
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  // ==========================================
  // LOAD SETTINGS
  // ==========================================

  const loadCaregiverSettings = async () => {
    try {
      const saved =
        await AsyncStorage.getItem(
          getSettingsKey()
        );

      if (!saved) {
        setNotificationsEnabled(
          DEFAULT_SETTINGS.notificationsEnabled
        );

        setMedicationAlerts(
          DEFAULT_SETTINGS.medicationAlerts
        );

        setExerciseAlerts(
          DEFAULT_SETTINGS.exerciseAlerts
        );

        setMessageAlerts(
          DEFAULT_SETTINGS.messageAlerts
        );

        setEmergencyAlerts(
          DEFAULT_SETTINGS.emergencyAlerts
        );

        setCaregiverSound(
          DEFAULT_SETTINGS.caregiverSound
        );

        setLargeText(
          DEFAULT_SETTINGS.largeText
        );

        setHighContrast(
          DEFAULT_SETTINGS.highContrast
        );

        return;
      }

      const settings =
        JSON.parse(saved);

      setNotificationsEnabled(
        settings.notificationsEnabled !== false
      );

      setMedicationAlerts(
        settings.medicationAlerts !== false
      );

      setExerciseAlerts(
        settings.exerciseAlerts !== false
      );

      setMessageAlerts(
        settings.messageAlerts !== false
      );

      setEmergencyAlerts(
        settings.emergencyAlerts !== false
      );

      setCaregiverSound(
        settings.caregiverSound !== false
      );

      setLargeText(
        settings.largeText === true
      );

      setHighContrast(
        settings.highContrast === true
      );
    } catch (error) {
      console.log(
        'Load caregiver settings error:',
        error
      );
    }
  };

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);

      await Promise.all([
        loadAccount(),
        loadCaregiverSettings(),
      ]);

      setLoading(false);
    };

    initialize();
  }, [accountId]);

  // ==========================================
  // SAVE SETTINGS
  // ==========================================

  const saveCaregiverSettings = async (
    overrides = {}
  ) => {
    try {
      const settings = {
        notificationsEnabled,
        medicationAlerts,
        exerciseAlerts,
        messageAlerts,
        emergencyAlerts,
        caregiverSound,
        largeText,
        highContrast,
        ...overrides,
      };

      await AsyncStorage.setItem(
        getSettingsKey(),
        JSON.stringify(settings)
      );
    } catch (error) {
      console.log(
        'Save caregiver settings error:',
        error
      );
    }
  };

  const updateSetting = async (
    setter,
    key,
    value
  ) => {
    setter(value);

    await saveCaregiverSettings({
      [key]: value,
    });
  };

  // ==========================================
  // RELOAD WHEN SCREEN FOCUSES
  // ==========================================

  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        'focus',
        () => {
          loadAccount();
          loadCaregiverSettings();
        }
      );

    return unsubscribe;
  }, [
    navigation,
    accountId,
  ]);

  // ==========================================
  // NAVIGATION
  // ==========================================

  const navigateTo = (
    screenName
  ) => {
    navigation.navigate(
      screenName,
      {
        name:
          account?.name ||
          'Caregiver',

        role:
          'caregiver',

        email:
          account?.email ||
          '',

        accountId:
          accountId ||
          account?.id ||
          null,
      }
    );
  };

  // ==========================================
  // RESET
  // ==========================================

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Preferences',
      'Reset caregiver preferences to their default settings? Your account, patient connection, and sign-in accounts will not be changed.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setNotificationsEnabled(true);
              setMedicationAlerts(true);
              setExerciseAlerts(true);
              setMessageAlerts(true);
              setEmergencyAlerts(true);
              setCaregiverSound(true);
              setLargeText(false);
              setHighContrast(false);

              await AsyncStorage.setItem(
                getSettingsKey(),
                JSON.stringify(
                  DEFAULT_SETTINGS
                )
              );

              Alert.alert(
                'Settings Reset',
                'Your caregiver preferences have been restored. Your account and patient connection were not changed.'
              );
            } catch (error) {
              console.log(
                'Reset caregiver settings error:',
                error
              );

              Alert.alert(
                'Reset Failed',
                'We could not reset your caregiver preferences. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // ==========================================
  // HELP
  // ==========================================

  const handleHelp = () => {
    Alert.alert(
      'StrokeBuddy Help',
      'For caregiver support, check your patient connection, notification preferences, caregiver permissions, and emergency information. You can also return to these settings at any time.',
      [
        {
          text: 'OK',
        },
      ]
    );
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            const parentNavigation =
              navigation.getParent();

            if (parentNavigation) {
              parentNavigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Login',
                  },
                ],
              });
            }
          },
        },
      ]
    );
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          highContrast &&
            styles.highContrastContainer,
        ]}
        edges={['top', 'left', 'right']}
      >
        <View
          style={[
            styles.loadingContainer,
            highContrast &&
              styles.highContrastContainer,
          ]}
        >
          <ActivityIndicator
            size="large"
            color="#5B6CFF"
          />

          <Text
            style={[
              styles.loadingText,
              highContrast &&
                styles.highContrastText,
            ]}
          >
            Loading caregiver settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPatientConnected =
    !!account?.connectedPatientId &&
    !!patientName;

  const activeAlerts =
    [
      notificationsEnabled,
      notificationsEnabled &&
        medicationAlerts,
      notificationsEnabled &&
        exerciseAlerts,
      notificationsEnabled &&
        messageAlerts,
      notificationsEnabled &&
        emergencyAlerts,
    ].filter(Boolean).length;

  // ==========================================
  // MAIN SCREEN
  // ==========================================

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        highContrast &&
          styles.highContrastContainer,
      ]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        style={[
          styles.container,
          highContrast &&
            styles.highContrastContainer,
        ]}
        contentContainerStyle={[
          styles.content,
          largeText &&
            styles.contentLarge,
        ]}
        showsVerticalScrollIndicator={true}
      >

        {/* ====================================
            HEADER
        ==================================== */}

        <View
          style={[
            styles.header,
            largeText &&
              styles.headerLarge,
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              largeText &&
                styles.largeTextTitle,
            ]}
            allowFontScaling={true}
          >
            Caregiver Settings
          </Text>

          <Text
            style={[
              styles.headerSubtitle,
              largeText &&
                styles.largeTextBody,
              highContrast &&
                styles.highContrastSecondaryText,
            ]}
            allowFontScaling={true}
          >
            Manage your caregiver account,
            patient connection, alerts,
            accessibility, and preferences.
          </Text>
        </View>

        {/* ====================================
            PROFILE
        ==================================== */}

        <View
          style={[
            styles.profileCard,
            largeText &&
              styles.profileCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
        >
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={
              handlePickProfilePicture
            }
            activeOpacity={0.8}
            disabled={
              uploadingProfilePicture
            }
          >
            <View
              style={[
                styles.avatar,
                largeText &&
                  styles.avatarLarge,
                highContrast &&
                  styles.highContrastIconCircle,
              ]}
            >
              {uploadingProfilePicture ? (
                <ActivityIndicator
                  size="small"
                  color="#5B6CFF"
                />
              ) : profilePicture ? (
                <Image
                  source={{
                    uri: profilePicture,
                  }}
                  style={[
                    styles.avatarImage,
                    largeText &&
                      styles.avatarImageLarge,
                  ]}
                />
              ) : (
                <Ionicons
                  name="person"
                  size={
                    largeText
                      ? 30
                      : 25
                  }
                  color="#5B6CFF"
                />
              )}

              {!uploadingProfilePicture && (
                <View
                  style={[
                    styles.cameraBadge,
                    highContrast &&
                      styles.highContrastCameraBadge,
                  ]}
                >
                  <Ionicons
                    name="camera"
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </View>

            <Text
              style={[
                styles.changePhotoText,
                largeText &&
                  styles.changePhotoTextLarge,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              {profilePicture
                ? 'Change'
                : 'Add photo'}
            </Text>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text
              style={[
                styles.profileName,
                largeText &&
                  styles.largeTextName,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              {account?.name ||
                'Caregiver'}
            </Text>

            <Text
              style={[
                styles.profileEmail,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              {account?.email ||
                'No email available'}
            </Text>

            <View
              style={[
                styles.syncBadge,
                isPatientConnected
                  ? styles.syncBadgeActive
                  : styles.syncBadgeInactive,
                highContrast &&
                  styles.highContrastBadge,
              ]}
            >
              <View
                style={[
                  styles.syncDot,
                  isPatientConnected
                    ? styles.syncDotActive
                    : styles.syncDotInactive,
                  highContrast &&
                    styles.highContrastStatusDot,
                ]}
              />

              <Text
                style={[
                  styles.syncText,
                  isPatientConnected
                    ? styles.syncTextActive
                    : styles.syncTextInactive,
                  highContrast &&
                    styles.highContrastText,
                ]}
                allowFontScaling={true}
              >
                {isPatientConnected
                  ? 'Caregiver Sync Active'
                  : 'No Patient Connected'}
              </Text>
            </View>
          </View>
        </View>

        {/* ====================================
            ACCOUNT & SIGN-IN
        ==================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.largeTextSectionTitle,
            highContrast &&
              styles.highContrastText,
          ]}
          allowFontScaling={true}
        >
          Account & Sign-In
        </Text>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverAccount'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="person-circle-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Account & Sign-In
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Manage your account and connect
              Google or Apple sign-in.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            PATIENT CONNECTION
        ==================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.largeTextSectionTitle,
            highContrast &&
              styles.highContrastText,
          ]}
          allowFontScaling={true}
        >
          Patient Connection
        </Text>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverConnection'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="people-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Patient Connection
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              {isPatientConnected
                ? `Connected to ${patientName}. Manage your patient connection.`
                : 'Connect to a patient using their 6-digit connection code.'}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            NOTIFICATIONS
        ==================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.largeTextSectionTitle,
            highContrast &&
              styles.highContrastText,
          ]}
          allowFontScaling={true}
        >
          Notifications & Alerts
        </Text>

        <TouchableOpacity
          style={[
            styles.summaryCard,
            largeText &&
              styles.summaryCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverNotifications'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.summaryIcon,
              largeText &&
                styles.summaryIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={
                largeText
                  ? 30
                  : 23
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.summaryInfo}>
            <Text
              style={[
                styles.summaryTitle,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Notifications & Alerts
            </Text>

            <Text
              style={[
                styles.summaryDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              {notificationsEnabled
                ? `${activeAlerts} alert categories active`
                : 'Caregiver notifications are turned off'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              notificationsEnabled
                ? styles.statusBadgeOn
                : styles.statusBadgeOff,
              highContrast &&
                styles.highContrastSmallBadge,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                notificationsEnabled
                  ? styles.statusBadgeTextOn
                  : styles.statusBadgeTextOff,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              {notificationsEnabled
                ? 'ON'
                : 'OFF'}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            ACCESSIBILITY
        ==================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.largeTextSectionTitle,
            highContrast &&
              styles.highContrastText,
          ]}
          allowFontScaling={true}
        >
          Accessibility
        </Text>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverAccessibility'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="accessibility-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Accessibility
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Customize text size and contrast
              for caregiver use.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            CAREGIVER EXPERIENCE
        ==================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.largeTextSectionTitle,
            highContrast &&
              styles.highContrastText,
          ]}
          allowFontScaling={true}
        >
          Caregiver Experience
        </Text>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverExperience'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="heart-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Caregiver Experience
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Manage sounds and caregiver-focused
              experience preferences.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            CAREGIVER TOOLS
        ==================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText &&
              styles.largeTextSectionTitle,
            highContrast &&
              styles.highContrastText,
          ]}
          allowFontScaling={true}
        >
          Caregiver Tools
        </Text>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo('Permissions')
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Caregiver Permissions
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Manage what information and alerts
              caregiver access is allowed to use.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverEmergency'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="call-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Emergency Information
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              {isPatientConnected
                ? `Review emergency information for ${patientName}.`
                : 'Connect a patient to review their emergency information.'}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={() =>
            navigateTo(
              'CaregiverPrivacyData'
            )
          }
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Privacy & Data
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Review caregiver data and privacy
              controls.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            HELP
        ==================================== */}

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={handleHelp}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="help-circle-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Help & Support
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Get guidance for common caregiver
              features.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            RESET
        ==================================== */}

        <TouchableOpacity
          style={[
            styles.menuCard,
            largeText &&
              styles.menuCardLarge,
            highContrast &&
              styles.highContrastCard,
          ]}
          onPress={handleResetSettings}
          activeOpacity={0.75}
        >
          <View
            style={[
              styles.menuIcon,
              largeText &&
                styles.menuIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={
                largeText
                  ? 29
                  : 22
              }
              color={
                highContrast
                  ? '#000000'
                  : '#5B6CFF'
              }
            />
          </View>

          <View style={styles.menuInfo}>
            <Text
              style={[
                styles.menuText,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              Reset Preferences
            </Text>

            <Text
              style={[
                styles.menuDescription,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              Restore caregiver preferences to
              their safe defaults.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              largeText
                ? 27
                : 20
            }
            color={
              highContrast
                ? '#000000'
                : '#9CA3AF'
            }
          />
        </TouchableOpacity>

        {/* ====================================
            ACCOUNT STATUS
        ==================================== */}

        <View
          style={[
            styles.statusCardLarge,
            largeText &&
              styles.statusCardLargeText,
            isPatientConnected
              ? styles.statusConnected
              : styles.statusDisconnected,
            highContrast &&
              styles.highContrastStatusCard,
          ]}
        >
          <View
            style={[
              styles.statusLargeIcon,
              largeText &&
                styles.statusLargeIconLarge,
              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name={
                isPatientConnected
                  ? 'shield-checkmark'
                  : 'shield-outline'
              }
              size={
                largeText
                  ? 30
                  : 22
              }
              color={
                isPatientConnected
                  ? '#10B981'
                  : '#6B7280'
              }
            />
          </View>

          <View style={styles.statusInfo}>
            <Text
              style={[
                styles.statusTitle,
                !isPatientConnected &&
                  styles.statusTitleDisconnected,
                largeText &&
                  styles.largeTextMenu,
                highContrast &&
                  styles.highContrastText,
              ]}
              allowFontScaling={true}
            >
              {isPatientConnected
                ? 'Caregiver access is active'
                : 'No patient connected'}
            </Text>

            <Text
              style={[
                styles.statusSubtitle,
                largeText &&
                  styles.largeTextBody,
                highContrast &&
                  styles.highContrastSecondaryText,
              ]}
              allowFontScaling={true}
            >
              {isPatientConnected
                ? `You are currently connected to ${patientName}'s account.`
                : 'Connect a patient to begin sharing recovery information.'}
            </Text>
          </View>
        </View>

        {/* ====================================
            LOG OUT
        ==================================== */}

        <TouchableOpacity
          style={[
            styles.logoutButton,
            largeText && styles.logoutButtonLarge,
            highContrast && styles.highContrastLogout,
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.logoutText,
              largeText && styles.largeTextMenu,
            ]}
            allowFontScaling={true}
          >
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  // ========================================
  // SAFE AREA
  // ========================================

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  highContrastContainer: {
    backgroundColor: '#FFFFFF',
  },

  // ========================================
  // MAIN CONTAINER
  // ========================================

  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  content: {
    paddingHorizontal: 20,

    // SafeAreaView now handles the actual
    // iPhone top inset.
    // This controls the visual spacing
    // below the safe-area boundary.
    paddingTop: 32,

    paddingBottom: 100,
  },

  contentLarge: {
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 120,
  },

  // ========================================
  // LOADING
  // ========================================

  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 19,
    color: '#777777',
    textAlign: 'center',
  },

  // ========================================
  // HEADER
  // ========================================

  header: {
    marginBottom: 15,
  },

  headerLarge: {
    marginBottom: 20,
  },

  // BLACK ONLY
  headerTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#000000',
  },

  largeTextTitle: {
    fontSize: 34,
    lineHeight: 42,
  },

  headerSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: '#777777',
    marginTop: 2,
    maxWidth: 390,
  },

  largeTextBody: {
    fontSize: 15,
    lineHeight: 22,
  },

  // ========================================
  // PROFILE
  // ========================================

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileCardLarge: {
    paddingVertical: 19,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 25,
  },

  highContrastCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111827',
    borderWidth: 2,
  },

  avatarTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },

  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  avatarImageLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#5B6CFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  highContrastCameraBadge: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },

  changePhotoText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: '#5B6CFF',
    marginTop: 4,
  },

  changePhotoTextLarge: {
    fontSize: 13,
    lineHeight: 18,
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#333333',
  },

  largeTextName: {
    fontSize: 21,
    lineHeight: 29,
  },

  profileEmail: {
    fontSize: 12,
    lineHeight: 17,
    color: '#777777',
    marginTop: 3,
    marginBottom: 7,
  },

  // ========================================
  // SYNC
  // ========================================

  syncBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },

  syncBadgeActive: {
    backgroundColor: '#ECFDF5',
  },

  syncBadgeInactive: {
    backgroundColor: '#F3F4F6',
  },

  highContrastBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },

  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },

  syncDotActive: {
    backgroundColor: '#34C759',
  },

  syncDotInactive: {
    backgroundColor: '#9CA3AF',
  },

  highContrastStatusDot: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
  },

  syncText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },

  syncTextActive: {
    color: '#247A3D',
  },

  syncTextInactive: {
    color: '#777777',
  },

  // ========================================
  // SECTION TITLES
  // ========================================

  sectionTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 11,
    marginTop: 3,
  },

  largeTextSectionTitle: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 12,
  },

  // ========================================
  // MENU CARDS
  // ========================================

  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  menuCardLarge: {
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 17,
    marginBottom: 13,
  },

  menuIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  menuIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    marginRight: 14,
  },

  menuInfo: {
    flex: 1,
    paddingRight: 8,
  },

  menuText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#333333',
  },

  largeTextMenu: {
    fontSize: 18,
    lineHeight: 25,
  },

  menuDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#777777',
    marginTop: 3,
  },

  // ========================================
  // NOTIFICATION SUMMARY
  // ========================================

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  summaryCardLarge: {
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 17,
    marginBottom: 13,
  },

  summaryIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  summaryIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    marginRight: 14,
  },

  summaryInfo: {
    flex: 1,
    paddingRight: 7,
  },

  summaryTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#333333',
  },

  summaryDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#777777',
    marginTop: 3,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 9,
  },

  statusBadgeOn: {
    backgroundColor: '#ECFDF5',
  },

  statusBadgeOff: {
    backgroundColor: '#F3F4F6',
  },

  highContrastSmallBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },

  statusBadgeText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
  },

  statusBadgeTextOn: {
    color: '#059669',
  },

  statusBadgeTextOff: {
    color: '#777777',
  },

  // ========================================
  // STATUS CARD
  // ========================================

  statusCardLarge: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },

  statusCardLargeText: {
    paddingVertical: 19,
    paddingHorizontal: 17,
    borderRadius: 18,
    marginTop: 15,
  },

  highContrastStatusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  statusConnected: {
    backgroundColor: '#ECFDF5',
  },

  statusDisconnected: {
    backgroundColor: '#F3F4F6',
  },

  statusLargeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  statusLargeIconLarge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginRight: 14,
  },

  statusInfo: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#065F46',
  },

  statusTitleDisconnected: {
    color: '#333333',
  },

  statusSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: '#777777',
    marginTop: 3,
  },

  // ========================================
  // LOGOUT
  // ========================================

  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },

  logoutButtonLarge: {
    paddingVertical: 15,
    borderRadius: 16,
  },

  highContrastLogout: {
    backgroundColor: '#000000',
  },

  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    marginLeft: 7,
  },

  // ========================================
  // HIGH CONTRAST
  // ========================================

  highContrastText: {
    color: '#000000',
  },

  highContrastSecondaryText: {
    color: '#1F2937',
  },
});