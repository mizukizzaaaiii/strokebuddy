import React, { useCallback, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  RefreshControl,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect } from '@react-navigation/native';

// ==========================================
// STORAGE
// ==========================================

const ACCOUNTS_KEY = 'strokebuddy_accounts';

const MESSAGES_KEY = 'strokebuddy_messages';

// ==========================================
// CAREGIVER HOME SCREEN
// ==========================================

export default function CaregiverHomeScreen({ navigation, route }) {
  const { name, email, accountId } = route?.params || {};

  // ==========================================
  // STATE
  // ==========================================

  const [account, setAccount] = useState(null);

  const [patient, setPatient] = useState(null);

  const [requests, setRequests] = useState([]);

  const [refreshing, setRefreshing] = useState(false);

  const [largeText, setLargeText] = useState(false);

  const [highContrast, setHighContrast] = useState(false);

  // ==========================================
  // ASYNC LOAD GUARD
  // ==========================================

  /*
   * Multiple async operations can overlap when:
   *
   * - Home receives focus
   * - pull-to-refresh is used
   * - the caregiver connection changes
   *
   * Without a guard, an older load can finish after
   * a newer load and overwrite the screen with stale
   * caregiver/patient information.
   */

  const loadGenerationRef = useRef(0);

  // ==========================================
  // LOAD CAREGIVER ACCESSIBILITY SETTINGS
  // ==========================================

  const loadAccessibilitySettings = async (generation = null) => {
    try {
      const storageKey = `strokebuddy_caregiver_settings_${
        accountId || 'default_caregiver'
      }`;

      const saved = await AsyncStorage.getItem(storageKey);

      if (generation !== null && generation !== loadGenerationRef.current) {
        return;
      }

      if (!saved) {
        setLargeText(false);
        setHighContrast(false);

        return;
      }

      const settings = JSON.parse(saved);

      if (generation !== null && generation !== loadGenerationRef.current) {
        return;
      }

      setLargeText(settings?.largeText === true);

      setHighContrast(settings?.highContrast === true);
    } catch (error) {
      console.log('Caregiver accessibility load error:', error);

      if (generation === null || generation === loadGenerationRef.current) {
        setLargeText(false);
        setHighContrast(false);
      }
    }
  };

  // ==========================================
  // FIND CONNECTED PATIENT
  // ==========================================

  const findConnectedPatient = (accounts, caregiver) => {
    if (!Array.isArray(accounts) || !caregiver) {
      return null;
    }

    // PRIMARY CONNECTION
    if (caregiver.connectedPatientId) {
      const connectedPatient = accounts.find(
        (item) =>
          item?.id === caregiver.connectedPatientId && item?.role === 'patient'
      );

      if (connectedPatient) {
        return connectedPatient;
      }
    }

    // LEGACY FALLBACK
    if (caregiver.patientId) {
      const legacyPatient = accounts.find(
        (item) => item?.id === caregiver.patientId && item?.role === 'patient'
      );

      if (legacyPatient) {
        return legacyPatient;
      }
    }

    // PATIENT-SIDE CONNECTION FALLBACK
    const fallbackPatient = accounts.find(
      (item) =>
        item?.role === 'patient' && item?.connectedCaregiverId === caregiver.id
    );

    return fallbackPatient || null;
  };

  // ==========================================
  // LOAD LIVE REQUESTS
  // ==========================================

  const loadRequests = async (
    caregiverId,
    connectedPatientId = null,
    generation = null
  ) => {
    try {
      if (!caregiverId) {
        if (generation === null || generation === loadGenerationRef.current) {
          setRequests([]);
        }

        return;
      }

      const savedMessages = await AsyncStorage.getItem(MESSAGES_KEY);

      let messages = [];

      if (savedMessages) {
        try {
          messages = JSON.parse(savedMessages);
        } catch (error) {
          console.log('Caregiver request JSON parse error:', error);

          messages = [];
        }
      }

      if (generation !== null && generation !== loadGenerationRef.current) {
        return;
      }

      if (!Array.isArray(messages)) {
        setRequests([]);

        return;
      }

      // ONLY REQUESTS FOR THIS CAREGIVER
      const caregiverRequests = messages
        .filter((message) => {
          if (message?.caregiverId !== caregiverId) {
            return false;
          }

          if (message?.sender !== 'patient') {
            return false;
          }

          if (message?.type !== 'quick') {
            return false;
          }

          /*
           * If the message contains a patientId, require it to match the
           * currently connected patient. Older messages without patientId
           * remain compatible and are allowed because the existing
           * architecture historically identified requests by caregiverId.
           */
          if (
            connectedPatientId &&
            message?.patientId &&
            message.patientId !== connectedPatientId
          ) {
            return false;
          }

          return true;
        })
        .sort(
          (a, b) =>
            new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0)
        );

      if (generation !== null && generation !== loadGenerationRef.current) {
        return;
      }

      setRequests(caregiverRequests.slice(0, 8));
    } catch (error) {
      console.log('Caregiver request load error:', error);

      if (generation === null || generation === loadGenerationRef.current) {
        setRequests([]);
      }
    }
  };

  // ==========================================
  // LOAD HOME DATA
  // ==========================================

  const loadHomeData = async () => {
    const generation = ++loadGenerationRef.current;

    try {
      await loadAccessibilitySettings(generation);

      // LOAD ACCOUNTS
      const savedAccounts = await AsyncStorage.getItem(ACCOUNTS_KEY);

      let accounts = [];

      if (savedAccounts) {
        try {
          accounts = JSON.parse(savedAccounts);
        } catch (error) {
          console.log('Caregiver accounts JSON parse error:', error);

          accounts = [];
        }
      }

      if (generation !== loadGenerationRef.current) {
        return;
      }

      if (!Array.isArray(accounts)) {
        setAccount(null);
        setPatient(null);
        setRequests([]);

        return;
      }

      // FIND CURRENT CAREGIVER
      const caregiver = accounts.find(
        (item) => item?.id === accountId && item?.role === 'caregiver'
      );

      if (generation !== loadGenerationRef.current) {
        return;
      }

      if (!caregiver) {
        setAccount(null);
        setPatient(null);
        setRequests([]);

        return;
      }

      setAccount(caregiver);

      // FIND CONNECTED PATIENT
      const connectedPatient = findConnectedPatient(accounts, caregiver);

      if (generation !== loadGenerationRef.current) {
        return;
      }

      setPatient(connectedPatient || null);

      // LOAD PATIENT REQUESTS
      await loadRequests(
        caregiver.id,
        connectedPatient?.id || null,
        generation
      );
    } catch (error) {
      console.log('Caregiver Home data load error:', error);
    }
  };

  // ==========================================
  // RELOAD WHEN HOME GETS FOCUS
  // ==========================================

  useFocusEffect(
    useCallback(() => {
      let active = true;

      loadHomeData();

      // CHECK FOR NEW REQUESTS PERIODICALLY
      const interval = setInterval(() => {
        if (active && accountId) {
          /*
           * Use the patient currently associated with this Home instance
           * when filtering quick requests.
           */
          loadRequests(accountId, patient?.id || null);
        }
      }, 3000);

      return () => {
        active = false;

        clearInterval(interval);

        /*
         * Invalidate any in-flight Home load so stale async results cannot
         * overwrite the next screen state.
         */
        loadGenerationRef.current += 1;
      };
    }, [accountId, patient?.id])
  );

  // ==========================================
  // PULL TO REFRESH
  // ==========================================

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadHomeData();
    } finally {
      setRefreshing(false);
    }
  };

  // ==========================================
  // NAVIGATION
  // ==========================================

  const openMedsScreen = () => {
    navigation.navigate('Meds');
  };

  const openMessagesScreen = () => {
    navigation.navigate('Voice');
  };

  const openPTScreen = () => {
    navigation.navigate('PT Progress');
  };

  const openSettings = () => {
    navigation.navigate('Settings');
  };

  // ==========================================
  // CALL PATIENT
  // ==========================================

  const callPatient = () => {
    if (!patient?.phone) {
      Alert.alert(
        'No Patient Phone Number',
        'This patient does not have a phone number saved to their account.'
      );

      return;
    }

    Alert.alert(`Call ${patient.name || 'Patient'}?`, patient.phone, [
      {
        text: 'Cancel',
        style: 'cancel',
      },

      {
        text: 'Call',

        onPress: async () => {
          try {
            await Linking.openURL(`tel:${patient.phone}`);
          } catch (error) {
            Alert.alert(
              'Unable to Call',
              'Your device could not start the phone call.'
            );
          }
        },
      },
    ]);
  };

  // ==========================================
  // FORMAT REQUEST TIME
  // ==========================================

  const formatRequestTime = (timestamp) => {
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
  };

  // ==========================================
  // DISPLAY NAMES + COLORS
  // ==========================================

  const displayCaregiverName = name || account?.name || 'Caregiver';

  const displayPatientName = patient?.name || 'Patient';

  const textColor = highContrast ? '#000000' : '#333333';

  const secondaryTextColor = highContrast ? '#1F2937' : '#777777';

  const primaryColor = highContrast ? '#000000' : '#5B6CFF';

  const iconColor = highContrast ? '#000000' : '#4B5563';

  const requestCount = requests.length;

  // ==========================================
  // UI
  // ==========================================

  return (
    <SafeAreaView
      style={[styles.safeArea, highContrast && styles.highContrastBackground]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.container,
          largeText && styles.containerLarge,
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ==================================
            HEADER
        ================================== */}

        <View style={[styles.headerRow, largeText && styles.headerRowLarge]}>
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.brandTitle,
                largeText && styles.brandTitleLarge,
                { color: primaryColor },
              ]}
              allowFontScaling={true}
            >
              StrokeBuddy
            </Text>

            <Text
              style={[
                styles.welcomeText,
                largeText && styles.welcomeTextLarge,
                { color: secondaryTextColor },
              ]}
              allowFontScaling={true}
            >
              Welcome back, {displayCaregiverName}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.headerVoiceButton,
              largeText && styles.headerVoiceButtonLarge,
              highContrast && styles.highContrastButton,
            ]}
            onPress={openMessagesScreen}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open patient messages"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={largeText ? 29 : 22}
              color={highContrast ? '#FFFFFF' : '#5B6CFF'}
            />
          </TouchableOpacity>
        </View>

        {/* ==================================
            PATIENT STATUS
        ================================== */}

        <View
          style={[
            styles.patientCard,
            largeText && styles.patientCardLarge,
            highContrast && styles.highContrastCard,
          ]}
        >
          <View
            style={[
              styles.patientIcon,
              largeText && styles.patientIconLarge,
              highContrast && styles.highContrastIconCircle,
            ]}
          >
            <Ionicons
              name="person"
              size={largeText ? 30 : 23}
              color={highContrast ? '#000000' : '#5B6CFF'}
            />
          </View>

          <View style={styles.patientInfo}>
            <Text
              style={[
                styles.patientTitle,
                largeText && styles.patientTitleLarge,
                { color: textColor },
              ]}
              allowFontScaling={true}
            >
              {patient ? displayPatientName : 'No Patient Connected'}
            </Text>

            <Text
              style={[
                styles.patientSubtitle,
                largeText && styles.patientSubtitleLarge,
                { color: secondaryTextColor },
              ]}
              allowFontScaling={true}
            >
              {patient ? 'Connected patient' : 'Connect a patient in Settings'}
            </Text>

            {patient && (
              <View style={styles.patientStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    highContrast && styles.highContrastStatusDot,
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    largeText && styles.statusTextLarge,
                    { color: highContrast ? '#000000' : '#247A3D' },
                  ]}
                  allowFontScaling={true}
                >
                  Patient connection active
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ==================================
            LIVE PATIENT REQUESTS
        ================================== */}

        {patient && (
          <View
            style={[
              styles.requestsSection,
              largeText && styles.requestsSectionLarge,
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderText}>
                <Text
                  style={[
                    styles.sectionTitle,
                    largeText && styles.sectionTitleLarge,
                    { color: textColor },
                  ]}
                  allowFontScaling={true}
                >
                  Live Patient Requests
                </Text>

                <Text
                  style={[
                    styles.sectionSubtitle,
                    largeText && styles.sectionSubtitleLarge,
                    { color: secondaryTextColor },
                  ]}
                  allowFontScaling={true}
                >
                  Quick requests from {displayPatientName}
                </Text>
              </View>

              {requestCount > 0 && (
                <View
                  style={[
                    styles.requestBadge,
                    highContrast && styles.highContrastBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.requestBadgeText,
                      highContrast && styles.highContrastBadgeText,
                    ]}
                    allowFontScaling={true}
                  >
                    {requestCount}
                  </Text>
                </View>
              )}
            </View>

            {requestCount === 0 ? (
              <View
                style={[
                  styles.noRequestsCard,
                  largeText && styles.noRequestsCardLarge,
                  highContrast && styles.highContrastCard,
                ]}
              >
                <View
                  style={[
                    styles.noRequestsIcon,
                    largeText && styles.noRequestsIconLarge,
                    highContrast && styles.highContrastIconCircle,
                  ]}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={largeText ? 29 : 22}
                    color={highContrast ? '#000000' : '#6366F1'}
                  />
                </View>

                <View style={styles.noRequestsInfo}>
                  <Text
                    style={[
                      styles.noRequestsTitle,
                      largeText && styles.noRequestsTitleLarge,
                      { color: textColor },
                    ]}
                    allowFontScaling={true}
                  >
                    No new requests
                  </Text>

                  <Text
                    style={[
                      styles.noRequestsText,
                      largeText && styles.noRequestsTextLarge,
                      { color: secondaryTextColor },
                    ]}
                    allowFontScaling={true}
                  >
                    Patient quick requests will appear here.
                  </Text>
                </View>
              </View>
            ) : (
              requests.map((request) => (
                <TouchableOpacity
                  key={
                    request.id ||
                    `${request.timestamp || ''}-${request.text || ''}`
                  }
                  style={[
                    styles.requestCard,
                    largeText && styles.requestCardLarge,
                    highContrast && styles.highContrastCard,
                  ]}
                  onPress={openMessagesScreen}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.requestIcon,
                      largeText && styles.requestIconLarge,
                      highContrast && styles.highContrastIconCircle,
                    ]}
                  >
                    <Ionicons
                      name="alert-circle-outline"
                      size={largeText ? 28 : 22}
                      color={highContrast ? '#000000' : '#5B6CFF'}
                    />
                  </View>

                  <View style={styles.requestInfo}>
                    <Text
                      style={[
                        styles.requestTitle,
                        largeText && styles.requestTitleLarge,
                        { color: textColor },
                      ]}
                      allowFontScaling={true}
                    >
                      {request.text || 'Patient needs help'}
                    </Text>

                    <Text
                      style={[
                        styles.requestTime,
                        largeText && styles.requestTimeLarge,
                        { color: secondaryTextColor },
                      ]}
                      allowFontScaling={true}
                    >
                      {formatRequestTime(request.timestamp)}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={largeText ? 27 : 20}
                    color={highContrast ? '#000000' : '#9CA3AF'}
                  />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ==================================
            QUICK ACTIONS
        ================================== */}

        <Text
          style={[
            styles.sectionTitle,
            largeText && styles.sectionTitleLarge,
            { color: textColor },
          ]}
          allowFontScaling={true}
        >
          Quick Actions
        </Text>

        <Text
          style={[
            styles.sectionSubtitle,
            largeText && styles.sectionSubtitleLarge,
            { color: secondaryTextColor },
          ]}
          allowFontScaling={true}
        >
          Quickly access your patient’s care tools.
        </Text>

        <View style={[styles.grid, largeText && styles.gridLarge]}>
          {/* MEDICATIONS */}

          <TouchableOpacity
            style={[
              styles.tile,
              largeText && styles.tileLarge,
              styles.medsTile,
              highContrast && styles.highContrastTile,
            ]}
            onPress={openMedsScreen}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Patient medications"
          >
            <View
              style={[
                styles.tileIconCircle,
                largeText && styles.tileIconCircleLarge,
                highContrast && styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="medical-outline"
                size={largeText ? 35 : 27}
                color={iconColor}
              />
            </View>

            <Text
              style={[
                styles.tileText,
                largeText && styles.tileTextLarge,
                { color: textColor },
              ]}
              allowFontScaling={true}
            >
              Medications
            </Text>
          </TouchableOpacity>

          {/* MESSAGES */}

          <TouchableOpacity
            style={[
              styles.tile,
              largeText && styles.tileLarge,
              styles.messageTile,
              highContrast && styles.highContrastTile,
            ]}
            onPress={openMessagesScreen}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Patient messages"
          >
            <View
              style={[
                styles.tileIconCircle,
                largeText && styles.tileIconCircleLarge,
                highContrast && styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={largeText ? 35 : 27}
                color={iconColor}
              />
            </View>

            <Text
              style={[
                styles.tileText,
                largeText && styles.tileTextLarge,
                { color: textColor },
              ]}
              allowFontScaling={true}
            >
              Messages
            </Text>
          </TouchableOpacity>

          {/* PT PROGRESS */}

          <TouchableOpacity
            style={[
              styles.tile,
              largeText && styles.tileLarge,
              styles.ptTile,
              highContrast && styles.highContrastTile,
            ]}
            onPress={openPTScreen}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Physical therapy progress"
          >
            <View
              style={[
                styles.tileIconCircle,
                largeText && styles.tileIconCircleLarge,
                highContrast && styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="fitness-outline"
                size={largeText ? 35 : 27}
                color={iconColor}
              />
            </View>

            <Text
              style={[
                styles.tileText,
                largeText && styles.tileTextLarge,
                { color: textColor },
              ]}
              allowFontScaling={true}
            >
              PT Progress
            </Text>
          </TouchableOpacity>

          {/* CALL PATIENT */}

          <TouchableOpacity
            style={[
              styles.tile,
              largeText && styles.tileLarge,
              styles.callTile,
              highContrast && styles.highContrastTile,
            ]}
            onPress={callPatient}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Call patient"
          >
            <View
              style={[
                styles.tileIconCircle,
                largeText && styles.tileIconCircleLarge,
                highContrast && styles.highContrastIconCircle,
              ]}
            >
              <Ionicons
                name="call-outline"
                size={largeText ? 35 : 27}
                color={iconColor}
              />
            </View>

            <Text
              style={[
                styles.tileText,
                largeText && styles.tileTextLarge,
                { color: textColor },
              ]}
              allowFontScaling={true}
            >
              Call Patient
            </Text>
          </TouchableOpacity>
        </View>

        {/* ==================================
            PATIENT CARE CARD
        ================================== */}

        {patient && (
          <TouchableOpacity
            style={[
              styles.patientCareButton,
              largeText && styles.patientCareButtonLarge,
              highContrast && styles.highContrastCard,
            ]}
            onPress={openMedsScreen}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.patientCareIcon,
                largeText && styles.patientCareIconLarge,
                highContrast && styles.highContrastButton,
              ]}
            >
              <Ionicons
                name="heart-outline"
                size={largeText ? 30 : 23}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.patientCareInfo}>
              <Text
                style={[
                  styles.patientCareTitle,
                  largeText && styles.patientCareTitleLarge,
                  { color: textColor },
                ]}
                allowFontScaling={true}
              >
                Manage {displayPatientName}'s Care
              </Text>

              <Text
                style={[
                  styles.patientCareSubtitle,
                  largeText && styles.patientCareSubtitleLarge,
                  { color: secondaryTextColor },
                ]}
                allowFontScaling={true}
              >
                Review medications, records, and care information
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={largeText ? 29 : 22}
              color={highContrast ? '#000000' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}

        {/* ==================================
            NO PATIENT CONNECTED
        ================================== */}

        {!patient && (
          <TouchableOpacity
            style={[
              styles.connectButton,
              largeText && styles.connectButtonLarge,
              highContrast && styles.highContrastCard,
            ]}
            onPress={openSettings}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.connectIcon,
                largeText && styles.connectIconLarge,
                highContrast && styles.highContrastButton,
              ]}
            >
              <Ionicons
                name="link-outline"
                size={largeText ? 30 : 23}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.connectInfo}>
              <Text
                style={[
                  styles.connectTitle,
                  largeText && styles.connectTitleLarge,
                  { color: textColor },
                ]}
                allowFontScaling={true}
              >
                Connect a Patient
              </Text>

              <Text
                style={[
                  styles.connectSubtitle,
                  largeText && styles.connectSubtitleLarge,
                  { color: secondaryTextColor },
                ]}
                allowFontScaling={true}
              >
                Connect through Caregiver Settings to begin managing patient
                care.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={largeText ? 29 : 22}
              color={highContrast ? '#000000' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  highContrastBackground: {
    backgroundColor: '#FFFFFF',
  },

  scrollView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100,
  },

  containerLarge: {
    padding: 22,
    paddingBottom: 120,
  },

  // ========================================
  // HEADER
  // ========================================

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  headerRowLarge: {
    marginBottom: 20,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  brandTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },

  brandTitleLarge: {
    fontSize: 34,
    lineHeight: 42,
  },

  welcomeText: {
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },

  welcomeTextLarge: {
    fontSize: 19,
    lineHeight: 27,
    marginTop: 5,
  },

  headerVoiceButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9DCFF',
  },

  headerVoiceButtonLarge: {
    width: 55,
    height: 55,
    borderRadius: 28,
  },

  // ========================================
  // GENERAL
  // ========================================

  highContrastButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },

  highContrastCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#111827',
    borderWidth: 2,
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  // ========================================
  // PATIENT STATUS
  // ========================================

  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  patientCardLarge: {
    paddingVertical: 19,
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 17,
  },

  patientIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  patientIconLarge: {
    width: 57,
    height: 57,
    borderRadius: 29,
    marginRight: 14,
  },

  patientInfo: {
    flex: 1,
  },

  patientTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },

  patientTitleLarge: {
    fontSize: 21,
    lineHeight: 29,
  },

  patientSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  patientSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },

  patientStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#34C759',
    marginRight: 6,
  },

  highContrastStatusDot: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
  },

  statusText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },

  statusTextLarge: {
    fontSize: 13,
    lineHeight: 19,
  },

  // ========================================
  // SECTIONS
  // ========================================

  requestsSection: {
    marginBottom: 8,
  },

  requestsSectionLarge: {
    marginBottom: 10,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  sectionHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  sectionTitleLarge: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 6,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },

  sectionSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
  },

  requestBadge: {
    minWidth: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#5B6CFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  highContrastBadge: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },

  requestBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  highContrastBadgeText: {
    color: '#FFFFFF',
  },

  // ========================================
  // REQUESTS
  // ========================================

  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  requestCardLarge: {
    paddingVertical: 17,
    paddingHorizontal: 16,
    borderRadius: 17,
    marginBottom: 13,
  },

  requestIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  requestIconLarge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    marginRight: 14,
  },

  requestInfo: {
    flex: 1,
  },

  requestTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },

  requestTitleLarge: {
    fontSize: 18,
    lineHeight: 25,
  },

  requestTime: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },

  requestTimeLarge: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  noRequestsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },

  noRequestsCardLarge: {
    paddingVertical: 18,
    paddingHorizontal: 17,
    borderRadius: 17,
    marginBottom: 21,
  },

  noRequestsIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 11,
  },

  noRequestsIconLarge: {
    width: 55,
    height: 55,
    borderRadius: 18,
    marginRight: 14,
  },

  noRequestsInfo: {
    flex: 1,
  },

  noRequestsTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },

  noRequestsTitleLarge: {
    fontSize: 18,
    lineHeight: 25,
  },

  noRequestsText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  noRequestsTextLarge: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },

  // ========================================
  // QUICK ACTION GRID
  // ========================================

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  gridLarge: {
    marginTop: 2,
  },

  tile: {
    width: '47%',
    height: 105,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  tileLarge: {
    height: 135,
    borderRadius: 18,
    marginBottom: 15,
  },

  highContrastTile: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
  },

  medsTile: {
    backgroundColor: '#DCD2FF',
  },

  messageTile: {
    backgroundColor: '#C8F2F6',
  },

  ptTile: {
    backgroundColor: '#FFF1C8',
  },

  callTile: {
    backgroundColor: '#FFC8D5',
  },

  tileIconCircle: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  tileIconCircleLarge: {
    width: 57,
    height: 57,
    borderRadius: 29,
  },

  tileText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 'bold',
    marginTop: 7,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  tileTextLarge: {
    fontSize: 18,
    lineHeight: 25,
    marginTop: 9,
    paddingHorizontal: 7,
  },

  // ========================================
  // PATIENT CARE BUTTON
  // ========================================

  patientCareButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  patientCareButtonLarge: {
    paddingVertical: 20,
    paddingHorizontal: 17,
    borderRadius: 18,
    marginTop: 4,
  },

  patientCareIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#818CF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  patientCareIconLarge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginRight: 14,
  },

  patientCareInfo: {
    flex: 1,
    paddingRight: 6,
  },

  patientCareTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },

  patientCareTitleLarge: {
    fontSize: 19,
    lineHeight: 26,
  },

  patientCareSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  patientCareSubtitleLarge: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },

  // ========================================
  // CONNECT BUTTON
  // ========================================

  connectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  connectButtonLarge: {
    paddingVertical: 20,
    paddingHorizontal: 17,
    borderRadius: 18,
    marginTop: 4,
  },

  connectIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#818CF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  connectIconLarge: {
    width: 55,
    height: 55,
    borderRadius: 28,
    marginRight: 14,
  },

  connectInfo: {
    flex: 1,
    paddingRight: 6,
  },

  connectTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },

  connectTitleLarge: {
    fontSize: 19,
    lineHeight: 26,
  },

  connectSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  connectSubtitleLarge: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
});