import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Location from 'expo-location';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  useAccessibility,
} from '../../context/AccessibilityContext';


// ==========================================
// GENERATE UNIQUE 6-DIGIT CONNECTION CODE
// ==========================================

const generateUniqueConnectionCode = (
  accounts
) => {

  let code;
  let exists = true;

  while (exists) {

    code =
      Math.floor(
        100000 +
        Math.random() * 900000
      ).toString();

    exists =
      accounts.some(
        (item) =>
          item.connectionCode === code
      );

  }

  return code;

};


// ==========================================
// ENSURE PATIENT HAS CONNECTION CODE
// ==========================================

const ensurePatientConnectionCode = async (
  accounts,
  patient
) => {

  if (!patient) {
    return null;
  }


  if (
    patient.connectionCode &&
    /^\d{6}$/.test(
      String(patient.connectionCode)
    )
  ) {

    return String(
      patient.connectionCode
    );

  }


  const newCode =
    generateUniqueConnectionCode(
      accounts
    );


  const patientIndex =
    accounts.findIndex(
      (item) =>
        item.id === patient.id
    );


  if (patientIndex === -1) {
    return null;
  }


  accounts[patientIndex] = {
    ...accounts[patientIndex],
    connectionCode: newCode,
  };


  await AsyncStorage.setItem(
    'strokebuddy_accounts',
    JSON.stringify(accounts)
  );


  return newCode;

};


// ==========================================
// CAREGIVER SETTINGS SCREEN
// ==========================================

export default function CaregiverScreen({
  navigation,
  route,
}) {

  // ========================================
  // ROUTE DATA
  // ========================================

  const accountId =
    route?.params?.accountId ||
    null;

  const patientEmail =
    route?.params?.email ||
    null;


  // ========================================
  // ACCESSIBILITY
  // ========================================

  const {
    largeText,
    highContrast,
  } = useAccessibility();


  const font = (
    normal,
    large
  ) =>
    largeText
      ? large
      : normal;


  // ========================================
  // STATE
  // ========================================

  const [
    shareLogs,
    setShareLogs,
  ] = useState(true);

  const [
    shareLocation,
    setShareLocation,
  ] = useState(false);

  const [
    caregiver,
    setCaregiver,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    connectionCode,
    setConnectionCode,
  ] = useState(null);

  const [
    locationUpdating,
    setLocationUpdating,
  ] = useState(false);

  const [
    lastLocationUpdate,
    setLastLocationUpdate,
  ] = useState(null);


  // ========================================
  // STORAGE KEYS
  // ========================================

  const shareLogsKey =
    `strokebuddy_share_activity_logs_${
      accountId || 'default_patient'
    }`;

  const shareLocationKey =
    `strokebuddy_share_location_${
      accountId || 'default_patient'
    }`;

  const patientLocationKey =
    `strokebuddy_patient_location_${
      accountId || 'default_patient'
    }`;


  // ========================================
  // SAVE PATIENT LOCATION
  // ========================================

  const savePatientLocation =
    useCallback(
      async (location) => {

        if (!location) {
          return;
        }


        const locationData = {

          latitude:
            location.coords.latitude,

          longitude:
            location.coords.longitude,

          accuracy:
            location.coords.accuracy ?? null,

          altitude:
            location.coords.altitude ?? null,

          heading:
            location.coords.heading ?? null,

          speed:
            location.coords.speed ?? null,

          timestamp:
            location.timestamp ||
            Date.now(),

          updatedAt:
            new Date().toISOString(),

        };


        try {

          await AsyncStorage.setItem(
            patientLocationKey,
            JSON.stringify(locationData)
          );


          setLastLocationUpdate(
            locationData.updatedAt
          );

        } catch (error) {

          console.log(
            'Patient location save error:',
            error
          );

        }

      },
      [
        patientLocationKey,
      ]
    );


  // ========================================
  // START LOCATION TRACKING
  // ========================================

  const startLocationTracking =
    useCallback(
      async () => {

        try {

          setLocationUpdating(true);


          const permission =
            await Location.requestForegroundPermissionsAsync();


          if (
            permission.status !==
            Location.PermissionStatus.GRANTED
          ) {

            setLocationUpdating(false);

            setShareLocation(false);

            await AsyncStorage.setItem(
              shareLocationKey,
              'false'
            );


            Alert.alert(
              'Location Permission Needed',
              'StrokeBuddy needs location permission to share your location with your connected caregiver. You can enable location permission later in your device settings.',
              [
                {
                  text: 'OK',
                },
              ]
            );

            return false;

          }


          // --------------------------------
          // GET LOCATION IMMEDIATELY
          // --------------------------------

          const currentLocation =
            await Location.getCurrentPositionAsync({
              accuracy:
                Location.Accuracy.Balanced,
            });


          await savePatientLocation(
            currentLocation
          );


          return true;

        } catch (error) {

          console.log(
            'Location tracking start error:',
            error
          );


          setLocationUpdating(false);


          Alert.alert(
            'Unable to Share Location',
            'StrokeBuddy could not access your location right now. Please check your device location settings and try again.',
            [
              {
                text: 'OK',
              },
            ]
          );


          return false;

        }

      },
      [
        savePatientLocation,
        shareLocationKey,
      ]
    );


  // ========================================
  // LOAD CAREGIVER + SETTINGS
  // ========================================

  const loadCaregiverConnection =
    useCallback(
      async () => {

        setLoading(true);

        try {

          // --------------------------------
          // LOAD ACCOUNTS
          // --------------------------------

          const savedAccounts =
            await AsyncStorage.getItem(
              'strokebuddy_accounts'
            );


          const accounts =
            savedAccounts
              ? JSON.parse(savedAccounts)
              : [];


          // --------------------------------
          // FIND PATIENT
          // --------------------------------

          let patient = null;


          if (accountId) {

            patient =
              accounts.find(
                (item) =>
                  item.id === accountId
              ) || null;

          }


          if (
            !patient &&
            patientEmail
          ) {

            patient =
              accounts.find(
                (item) =>
                  item.email ===
                    patientEmail &&
                  item.role ===
                    'patient'
              ) || null;

          }


          // --------------------------------
          // CONNECTION CODE
          // --------------------------------

          if (patient) {

            const patientCode =
              await ensurePatientConnectionCode(
                accounts,
                patient
              );


            setConnectionCode(
              patientCode
            );

          } else {

            setConnectionCode(null);

          }


          // --------------------------------
          // FIND CONNECTED CAREGIVER
          // --------------------------------

          let connectedCaregiver =
            null;


          if (
            patient &&
            patient.connectedCaregiverId
          ) {

            connectedCaregiver =
              accounts.find(
                (item) =>
                  item.id ===
                    patient.connectedCaregiverId &&
                  item.role ===
                    'caregiver'
              ) || null;

          }


          // --------------------------------
          // FALLBACK
          // --------------------------------

          if (
            !connectedCaregiver &&
            patient
          ) {

            connectedCaregiver =
              accounts.find(
                (item) =>
                  item.role ===
                    'caregiver' &&
                  (
                    item.connectedPatientId ===
                      patient.id ||
                    item.patientId ===
                      patient.id
                  )
              ) || null;

          }


          // --------------------------------
          // LEGACY CONNECTION
          // --------------------------------

          if (!connectedCaregiver) {

            const savedConnection =
              await AsyncStorage.getItem(
                'strokebuddy_caregiver_connection'
              );


            if (savedConnection) {

              const connection =
                JSON.parse(
                  savedConnection
                );


              if (
                !patientEmail ||
                connection.patientEmail ===
                  patientEmail
              ) {

                connectedCaregiver =
                  connection.caregiver ||
                  null;

              }

            }

          }


          setCaregiver(
            connectedCaregiver
          );


          // --------------------------------
          // ACTIVITY LOG SETTING
          // --------------------------------

          const savedShareLogs =
            await AsyncStorage.getItem(
              shareLogsKey
            );


          if (
            savedShareLogs !== null
          ) {

            setShareLogs(
              savedShareLogs ===
                'true'
            );

          } else {

            setShareLogs(true);

          }


          // --------------------------------
          // LOCATION SETTING
          // --------------------------------

          const savedShareLocation =
            await AsyncStorage.getItem(
              shareLocationKey
            );


          if (
            savedShareLocation !== null
          ) {

            setShareLocation(
              savedShareLocation ===
                'true'
            );

          } else {

            setShareLocation(false);

          }


          // --------------------------------
          // LAST SAVED LOCATION
          // --------------------------------

          const savedLocation =
            await AsyncStorage.getItem(
              patientLocationKey
            );


          if (savedLocation) {

            try {

              const location =
                JSON.parse(
                  savedLocation
                );


              setLastLocationUpdate(
                location.updatedAt ||
                  null
              );

            } catch (error) {

              console.log(
                'Location parse error:',
                error
              );

            }

          }

        } catch (error) {

          console.log(
            'Error loading caregiver settings:',
            error
          );

        } finally {

          setLoading(false);

        }

      },
      [
        accountId,
        patientEmail,
        shareLogsKey,
        shareLocationKey,
        patientLocationKey,
      ]
    );


  // ========================================
  // INITIAL LOAD
  // ========================================

  useEffect(() => {

    loadCaregiverConnection();

  }, [
    loadCaregiverConnection,
  ]);


  // ========================================
  // RELOAD WHEN SCREEN RETURNS
  // ========================================

  useFocusEffect(
    useCallback(() => {

      loadCaregiverConnection();

    }, [
      loadCaregiverConnection,
    ])
  );


  // ========================================
  // SHARE ACTIVITY LOGS
  // ========================================

  const handleShareLogsChange =
    async (value) => {

      setShareLogs(value);

      try {

        await AsyncStorage.setItem(
          shareLogsKey,
          String(value)
        );

      } catch (error) {

        console.log(
          'Share activity logs save error:',
          error
        );

      }

    };


  // ========================================
  // SHARE LOCATION
  // ========================================

  const handleShareLocationChange =
    async (value) => {

      // ------------------------------------
      // TURN OFF
      // ------------------------------------

      if (!value) {

        setShareLocation(false);

        setLocationUpdating(false);

        try {

          await AsyncStorage.setItem(
            shareLocationKey,
            'false'
          );

        } catch (error) {

          console.log(
            'Share location save error:',
            error
          );

        }

        return;

      }


      // ------------------------------------
      // TURN ON
      // ------------------------------------

      setShareLocation(true);

      try {

        await AsyncStorage.setItem(
          shareLocationKey,
          'true'
        );

      } catch (error) {

        console.log(
          'Share location setting error:',
          error
        );

      }


      await startLocationTracking();

    };


  // ========================================
  // CONTINUOUS FOREGROUND LOCATION WATCH
  // ========================================

  useEffect(() => {

    let subscription = null;

    const watchLocation =
      async () => {

        if (!shareLocation) {
          return;
        }


        try {

          const permission =
            await Location.getForegroundPermissionsAsync();


          if (
            permission.status !==
            Location.PermissionStatus.GRANTED
          ) {

            setLocationUpdating(false);

            return;

          }


          subscription =
            await Location.watchPositionAsync(

              {
                accuracy:
                  Location.Accuracy.Balanced,

                timeInterval:
                  60000,

                distanceInterval:
                  25,

              },

              async (location) => {

                await savePatientLocation(
                  location
                );

              }

            );


          setLocationUpdating(true);

        } catch (error) {

          console.log(
            'Location watcher error:',
            error
          );

          setLocationUpdating(false);

        }

      };


    watchLocation();


    return () => {

      if (subscription) {

        subscription.remove();

      }

      setLocationUpdating(false);

    };

  }, [
    shareLocation,
    savePatientLocation,
  ]);


  // ========================================
  // DISCONNECT CAREGIVER
  // ========================================

  const handleDisconnect =
    () => {

      Alert.alert(

        'Disconnect Caregiver',

        caregiver
          ? `Are you sure you want to disconnect ${caregiver.name}?`
          : 'Are you sure you want to disconnect your caregiver?',

        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Disconnect',
            style: 'destructive',

            onPress:
              async () => {

                try {

                  const savedAccounts =
                    await AsyncStorage.getItem(
                      'strokebuddy_accounts'
                    );


                  const accounts =
                    savedAccounts
                      ? JSON.parse(
                          savedAccounts
                        )
                      : [];


                  let patientIndex =
                    -1;


                  if (accountId) {

                    patientIndex =
                      accounts.findIndex(
                        (item) =>
                          item.id ===
                          accountId
                      );

                  }


                  if (
                    patientIndex === -1 &&
                    patientEmail
                  ) {

                    patientIndex =
                      accounts.findIndex(
                        (item) =>
                          item.email ===
                            patientEmail &&
                          item.role ===
                            'patient'
                      );

                  }


                  if (
                    patientIndex !== -1
                  ) {

                    const patient =
                      accounts[
                        patientIndex
                      ];


                    const caregiverId =
                      caregiver?.id ||
                      patient.connectedCaregiverId ||
                      null;


                    accounts[
                      patientIndex
                    ] = {

                      ...patient,

                      connectedCaregiverId:
                        null,

                    };


                    if (caregiverId) {

                      const caregiverIndex =
                        accounts.findIndex(
                          (item) =>
                            item.id ===
                              caregiverId &&
                            item.role ===
                              'caregiver'
                        );


                      if (
                        caregiverIndex !==
                        -1
                      ) {

                        accounts[
                          caregiverIndex
                        ] = {

                          ...accounts[
                            caregiverIndex
                          ],

                          connectedPatientId:
                            null,

                          patientId:
                            null,

                        };

                      }

                    }


                    await AsyncStorage.setItem(
                      'strokebuddy_accounts',
                      JSON.stringify(
                        accounts
                      )
                    );

                  }


                  await AsyncStorage.removeItem(
                    'strokebuddy_caregiver_connection'
                  );


                  setCaregiver(null);


                  Alert.alert(
                    'Caregiver Disconnected',
                    'Your caregiver connection has been removed.'
                  );


                } catch (error) {

                  console.log(
                    'Disconnect caregiver error:',
                    error
                  );


                  Alert.alert(
                    'Unable to Disconnect',
                    'We could not remove the caregiver connection. Please try again.'
                  );

                }

              },

          },

        ]

      );

    };


  // ========================================
  // CONNECT CAREGIVER
  // ========================================

  const handleConnect =
    () => {

      Alert.alert(

        'Connect a Caregiver',

        'Give your caregiver the 6-digit connection code shown above. They can enter it from their Caregiver Settings screen.',

        [
          {
            text: 'OK',
          },
        ]

      );

    };


  // ========================================
  // FORMAT LOCATION TIME
  // ========================================

  const formatLocationTime =
    (timestamp) => {

      if (!timestamp) {
        return 'Not updated yet';
      }


      try {

        return new Date(
          timestamp
        ).toLocaleString();

      } catch (error) {

        return 'Recently updated';

      }

    };


  // ========================================
  // UI
  // ========================================

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

        {/* ==================================
            HEADER
        ================================== */}

        <View
          style={styles.header}
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
                styles.title,

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
              Caregiver
            </Text>


            <Text
              style={[
                styles.subtitle,

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
              Manage who can support you through StrokeBuddy.
            </Text>

          </View>

        </View>


        {/* ==================================
            CAREGIVER CONNECTION
        ================================== */}

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
          Caregiver Connection
        </Text>


        {loading ? (

          <View
            style={[
              styles.connectionCard,

              highContrast &&
                styles.highContrastCard,
            ]}
          >

            <View
              style={
                styles.loadingContainer
              }
            >

              <Ionicons
                name="sync-outline"
                size={
                  largeText
                    ? 28
                    : 24
                }
                color={
                  highContrast
                    ? '#000000'
                    : '#5B6CFF'
                }
              />


              <Text
                style={[
                  styles.loadingText,

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
                Checking connection...
              </Text>

            </View>

          </View>

        ) : caregiver ? (

          <View
            style={[
              styles.connectionCard,

              highContrast &&
                styles.highContrastCard,
            ]}
          >

            {/* CAREGIVER INFO */}

            <View
              style={styles.connectionTop}
            >

              <View
                style={[
                  styles.personIcon,

                  highContrast &&
                    styles.highContrastIconCircle,
                ]}
              >

                <Ionicons
                  name="person-outline"
                  size={
                    largeText
                      ? 28
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
                style={
                  styles.caregiverInfo
                }
              >

                <Text
                  style={[
                    styles.caregiverName,

                    {
                      fontSize:
                        font(17, 21),

                      lineHeight:
                        font(22, 28),

                      color:
                        highContrast
                          ? '#000000'
                          : '#111827',
                    },
                  ]}
                >
                  {caregiver.name}
                </Text>


                {caregiver.email ? (

                  <Text
                    style={[
                      styles.caregiverEmail,

                      {
                        fontSize:
                          font(12, 16),

                        lineHeight:
                          font(17, 22),

                        color:
                          highContrast
                            ? '#000000'
                            : '#6B7280',
                      },
                    ]}
                  >
                    {caregiver.email}
                  </Text>

                ) : null}


                <View
                  style={[
                    styles.connectedBadge,

                    highContrast &&
                      styles.highContrastBadge,
                  ]}
                >

                  <View
                    style={[
                      styles.connectedDot,

                      highContrast &&
                        styles.highContrastDot,
                    ]}
                  />


                  <Text
                    style={[
                      styles.connectedText,

                      {
                        fontSize:
                          font(10, 14),

                        color:
                          highContrast
                            ? '#000000'
                            : '#059669',
                      },
                    ]}
                  >
                    Connected
                  </Text>

                </View>

              </View>

            </View>


            {/* ==================================
                CONNECTION CODE
            ================================== */}

            <View
              style={[
                styles.codeCard,

                highContrast &&
                  styles.highContrastCodeCard,
              ]}
            >

              <View
                style={[
                  styles.codeIcon,

                  highContrast &&
                    styles.highContrastIconCircle,
                ]}
              >

                <Ionicons
                  name="key-outline"
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
                style={styles.codeInfo}
              >

                <Text
                  style={[
                    styles.codeLabel,

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
                  Your Caregiver Connection Code
                </Text>


                <Text
                  style={[
                    styles.codeValue,

                    {
                      fontSize:
                        font(27, 34),

                      lineHeight:
                        font(34, 43),

                      color:
                        highContrast
                          ? '#000000'
                          : '#111827',
                    },
                  ]}
                  selectable={true}
                >
                  {connectionCode ||
                    '------'}
                </Text>


                <Text
                  style={[
                    styles.codeDescription,

                    {
                      fontSize:
                        font(11, 15),

                      lineHeight:
                        font(16, 21),

                      color:
                        highContrast
                          ? '#000000'
                          : '#6B7280',
                    },
                  ]}
                >
                  Give this 6-digit code to your caregiver so they can connect to your account.
                </Text>

              </View>

            </View>


            {/* DISCONNECT */}

            <TouchableOpacity
              style={[
                styles.disconnectButton,

                highContrast &&
                  styles.highContrastDisconnect,
              ]}
              onPress={
                handleDisconnect
              }
              activeOpacity={0.8}
            >

              <Ionicons
                name="unlink-outline"
                size={
                  largeText
                    ? 21
                    : 18
                }
                color={
                  highContrast
                    ? '#000000'
                    : '#DC2626'
                }
              />


              <Text
                style={[
                  styles.disconnectText,

                  {
                    fontSize:
                      font(13, 17),

                    color:
                      highContrast
                        ? '#000000'
                        : '#DC2626',
                  },
                ]}
              >
                Disconnect Caregiver
              </Text>

            </TouchableOpacity>

          </View>

        ) : (

          <View
            style={[
              styles.connectionCard,

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
                    ? 31
                    : 28
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
                    font(17, 22),

                  lineHeight:
                    font(23, 29),

                  color:
                    highContrast
                      ? '#000000'
                      : '#111827',
                },
              ]}
            >
              No Caregiver Connected
            </Text>


            <Text
              style={[
                styles.emptySubtitle,

                {
                  fontSize:
                    font(12, 17),

                  lineHeight:
                    font(18, 24),

                  color:
                    highContrast
                      ? '#000000'
                      : '#6B7280',
                },
              ]}
            >
              You are not currently connected to a caregiver.
              Your recovery information will remain private
              until you connect someone.
            </Text>


            {/* ==================================
                CONNECTION CODE
            ================================== */}

            <View
              style={[
                styles.codeCard,

                styles.codeCardEmpty,

                highContrast &&
                  styles.highContrastCodeCard,
              ]}
            >

              <View
                style={[
                  styles.codeIcon,

                  highContrast &&
                    styles.highContrastIconCircle,
                ]}
              >

                <Ionicons
                  name="key-outline"
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
                style={styles.codeInfo}
              >

                <Text
                  style={[
                    styles.codeLabel,

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
                  Your Caregiver Connection Code
                </Text>


                <Text
                  style={[
                    styles.codeValue,

                    {
                      fontSize:
                        font(27, 34),

                      lineHeight:
                        font(34, 43),

                      color:
                        highContrast
                          ? '#000000'
                          : '#111827',
                    },
                  ]}
                  selectable={true}
                >
                  {connectionCode ||
                    '------'}
                </Text>


                <Text
                  style={[
                    styles.codeDescription,

                    {
                      fontSize:
                        font(11, 15),

                      lineHeight:
                        font(16, 21),

                      color:
                        highContrast
                          ? '#000000'
                          : '#6B7280',
                    },
                  ]}
                >
                  Give this code to your caregiver. They can enter it from their Caregiver Settings screen.
                </Text>

              </View>

            </View>


            <TouchableOpacity
              style={[
                styles.connectButton,

                highContrast &&
                  styles.highContrastConnectButton,
              ]}
              onPress={
                handleConnect
              }
              activeOpacity={0.8}
            >

              <Ionicons
                name="person-add-outline"
                size={
                  largeText
                    ? 22
                    : 19
                }
                color="#FFFFFF"
              />


              <Text
                style={[
                  styles.connectButtonText,

                  {
                    fontSize:
                      font(14, 18),

                    lineHeight:
                      font(19, 24),
                  },
                ]}
              >
                Connect a Caregiver
              </Text>

            </TouchableOpacity>

          </View>

        )}


        {/* ==================================
            ACTIVITY SHARING
        ================================== */}

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
          Activity Sharing
        </Text>


        <View
          style={[
            styles.sharingCard,

            highContrast &&
              styles.highContrastCard,
          ]}
        >

          <View
            style={[
              styles.settingIcon,

              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >

            <Ionicons
              name="analytics-outline"
              size={
                largeText
                  ? 27
                  : 24
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
              styles.textContainer
            }
          >

            <Text
              style={[
                styles.settingTitle,

                {
                  fontSize:
                    font(17, 21),

                  lineHeight:
                    font(22, 28),

                  color:
                    highContrast
                      ? '#000000'
                      : '#111827',
                },
              ]}
            >
              Share Activity Logs
            </Text>


            <Text
              style={[
                styles.settingDescription,

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
              Sync completed recovery exercises and milestones with your connected caregiver.
            </Text>

          </View>


          <Switch
            value={shareLogs}
            onValueChange={
              handleShareLogsChange
            }
            trackColor={{
              false: '#D1D5DB',
              true: '#A5B4FC',
            }}
            thumbColor={
              shareLogs
                ? '#5B6CFF'
                : '#F9FAFB'
            }
          />

        </View>


        {/* ==================================
            LOCATION SHARING
        ================================== */}

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
          Location Sharing
        </Text>


        <View
          style={[
            styles.sharingCard,

            highContrast &&
              styles.highContrastCard,
          ]}
        >

          <View
            style={[
              styles.settingIcon,

              highContrast &&
                styles.highContrastIconCircle,
            ]}
          >

            <Ionicons
              name="location-outline"
              size={
                largeText
                  ? 27
                  : 24
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
              styles.textContainer
            }
          >

            <Text
              style={[
                styles.settingTitle,

                {
                  fontSize:
                    font(17, 21),

                  lineHeight:
                    font(22, 28),

                  color:
                    highContrast
                      ? '#000000'
                      : '#111827',
                },
              ]}
            >
              Share Location
            </Text>


            <Text
              style={[
                styles.settingDescription,

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
              Allow your connected caregiver to see your latest shared location on their map.
            </Text>


            {shareLocation ? (

              <View
                style={
                  styles.locationStatus
                }
              >

                <View
                  style={
                    styles.locationStatusDot
                  }
                />


                <Text
                  style={[
                    styles.locationStatusText,

                    {
                      fontSize:
                        font(11, 14),

                      lineHeight:
                        font(16, 19),

                      color:
                        highContrast
                          ? '#000000'
                          : '#059669',
                    },
                  ]}
                >
                  {locationUpdating
                    ? 'Location sharing is active'
                    : 'Location sharing is enabled'}
                </Text>

              </View>

            ) : (

              <View
                style={
                  styles.locationStatus
                }
              >

                <Ionicons
                  name="lock-closed-outline"
                  size={
                    largeText
                      ? 16
                      : 14
                  }
                  color={
                    highContrast
                      ? '#000000'
                      : '#6B7280'
                  }
                />


                <Text
                  style={[
                    styles.locationStatusText,

                    {
                      fontSize:
                        font(11, 14),

                      lineHeight:
                        font(16, 19),

                      color:
                        highContrast
                          ? '#000000'
                          : '#6B7280',
                    },
                  ]}
                >
                  Location sharing is off
                </Text>

              </View>

            )}


            {shareLocation &&
            lastLocationUpdate ? (

              <Text
                style={[
                  styles.lastUpdatedText,

                  {
                    fontSize:
                      font(10, 13),

                    lineHeight:
                      font(15, 18),

                    color:
                      highContrast
                        ? '#000000'
                        : '#6B7280',
                  },
                ]}
              >
                Last updated:{' '}
                {formatLocationTime(
                  lastLocationUpdate
                )}
              </Text>

            ) : null}

          </View>


          <Switch
            value={shareLocation}
            onValueChange={
              handleShareLocationChange
            }
            trackColor={{
              false: '#D1D5DB',
              true: '#A5B4FC',
            }}
            thumbColor={
              shareLocation
                ? '#5B6CFF'
                : '#F9FAFB'
            }
          />

        </View>


        {/* ==================================
            PRIVACY NOTE
        ================================== */}

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
                styles.highContrastInfoIcon,
            ]}
          >

            <Ionicons
              name="shield-checkmark-outline"
              size={
                largeText
                  ? 27
                  : 23
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
              Your information is under your control
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
              You decide whether your recovery activity and location can be shared with your caregiver.
            </Text>

          </View>

        </View>

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

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 45,
  },


  // ========================================
  // HEADER
  // ========================================

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
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

  title: {
    fontWeight: '800',
    marginBottom: 5,
  },

  subtitle: {
    fontWeight: '500',
  },


  // ========================================
  // SECTIONS
  // ========================================

  sectionTitle: {
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 12,
  },


  // ========================================
  // CONNECTION CARD
  // ========================================

  connectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 25,
  },

  highContrastCard: {
    borderColor: '#000000',
    borderWidth: 2,
  },

  connectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  personIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  highContrastIconCircle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  caregiverInfo: {
    flex: 1,
  },

  caregiverName: {
    fontWeight: '800',
  },

  caregiverEmail: {
    marginTop: 2,
    fontWeight: '500',
  },


  // ========================================
  // CONNECTED BADGE
  // ========================================

  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    marginTop: 7,
  },

  highContrastBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },

  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },

  highContrastDot: {
    backgroundColor: '#000000',
  },

  connectedText: {
    fontWeight: '800',
  },


  // ========================================
  // CONNECTION CODE
  // ========================================

  codeCard: {
    marginTop: 18,
    backgroundColor: '#F7F7FF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DDDFFF',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  codeCardEmpty: {
    marginTop: 20,
  },

  highContrastCodeCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 2,
  },

  codeIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  codeInfo: {
    flex: 1,
  },

  codeLabel: {
    fontWeight: '700',
    marginBottom: 1,
  },

  codeValue: {
    fontWeight: '900',
    letterSpacing: 5,
    marginTop: 1,
    marginBottom: 2,
  },

  codeDescription: {
    fontWeight: '500',
  },


  // ========================================
  // DISCONNECT
  // ========================================

  disconnectButton: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  highContrastDisconnect: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#FFFFFF',
  },

  disconnectText: {
    fontWeight: '800',
    marginLeft: 8,
  },


  // ========================================
  // EMPTY STATE
  // ========================================

  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },

  emptyTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },

  emptySubtitle: {
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 7,
  },

  connectButton: {
    backgroundColor: '#5B6CFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  highContrastConnectButton: {
    backgroundColor: '#000000',
  },

  connectButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginLeft: 8,
  },


  // ========================================
  // LOADING
  // ========================================

  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },

  loadingText: {
    fontWeight: '500',
    marginLeft: 10,
  },


  // ========================================
  // SHARING CARDS
  // ========================================

  sharingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  textContainer: {
    flex: 1,
    paddingRight: 10,
  },

  settingTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },

  settingDescription: {
    fontWeight: '500',
  },


  // ========================================
  // LOCATION STATUS
  // ========================================

  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  locationStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },

  locationStatusText: {
    fontWeight: '700',
  },

  lastUpdatedText: {
    marginTop: 4,
    fontWeight: '500',
  },


  // ========================================
  // INFORMATION
  // ========================================

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 16,
    marginTop: 2,
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

  highContrastInfoIcon: {
    borderWidth: 2,
    borderColor: '#000000',
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