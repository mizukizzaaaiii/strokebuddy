import React, {
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
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  ACCOUNTS_KEY,
} from './CaregiverSettingsStorage';


// ==========================================
// SCREEN
// ==========================================

export default function CaregiverConnectionScreen({
  navigation,
  route,
}) {

  const {
    name,
    email,
    accountId,
  } = route?.params || {};

  const [account, setAccount] =
    useState(null);

  const [patient, setPatient] =
    useState(null);

  const [connectionCode, setConnectionCode] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [connecting, setConnecting] =
    useState(false);


  useEffect(() => {

    loadConnection();

  }, [accountId]);


  // ==========================================
  // LOAD
  // ==========================================

  const loadConnection = async () => {

    try {

      setLoading(true);

      const saved =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!saved) {
        return;
      }

      const accounts =
        JSON.parse(saved);

      if (!Array.isArray(accounts)) {
        return;
      }

      const caregiver =
        accounts.find(
          (item) =>
            item.id === accountId &&
            item.role === 'caregiver'
        );

      setAccount(caregiver || null);

      if (!caregiver) {
        return;
      }

      const connectedPatientId =
        caregiver.connectedPatientId ||
        caregiver.patientId ||
        null;

      if (connectedPatientId) {

        const connectedPatient =
          accounts.find(
            (item) =>
              item.id === connectedPatientId &&
              item.role === 'patient'
          );

        setPatient(
          connectedPatient || null
        );

      } else {

        setPatient(null);

      }

    } catch (error) {

      console.log(
        'Load connection error:',
        error
      );

      Alert.alert(
        'Unable to Load Connection',
        'We could not load your patient connection.'
      );

    } finally {

      setLoading(false);

    }

  };


  // ==========================================
  // CONNECT
  // ==========================================

  const handleConnect = () => {

    const cleanedCode =
      connectionCode
        .replace(/\D/g, '')
        .slice(0, 6);

    setConnectionCode(cleanedCode);

    if (cleanedCode.length !== 6) {

      Alert.alert(
        'Enter a 6-Digit Code',
        'Please enter the complete connection code provided by the patient.'
      );

      return;

    }

    Alert.alert(
      'Connect to Patient?',
      'Please confirm that this is the patient you intend to connect with. Connecting will allow your caregiver account to access information according to the patient’s permissions.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: () =>
            performConnection(
              cleanedCode
            ),
        },
      ]
    );

  };


  // ==========================================
  // PERFORM CONNECTION
  // ==========================================

  const performConnection = async (
    code
  ) => {

    try {

      setConnecting(true);

      const saved =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!saved) {

        Alert.alert(
          'Connection Failed',
          'No account information was found.'
        );

        return;

      }

      const accounts =
        JSON.parse(saved);

      if (!Array.isArray(accounts)) {

        Alert.alert(
          'Connection Failed',
          'Your account information could not be read.'
        );

        return;

      }


      const caregiverIndex =
        accounts.findIndex(
          (item) =>
            item.id === accountId &&
            item.role === 'caregiver'
        );


      if (caregiverIndex === -1) {

        Alert.alert(
          'Account Error',
          'Your caregiver account could not be found.'
        );

        return;

      }


      const patientIndex =
        accounts.findIndex(
          (item) =>
            item.role === 'patient' &&
            item.connectionCode === code
        );


      if (patientIndex === -1) {

        Alert.alert(
          'Patient Not Found',
          'That connection code does not match a patient account. Please check the code and try again.'
        );

        return;

      }


      if (
        patientIndex === caregiverIndex
      ) {

        Alert.alert(
          'Invalid Connection',
          'A caregiver account cannot be connected to itself.'
        );

        return;

      }


      const foundPatient =
        accounts[patientIndex];


      if (
        foundPatient.connectedCaregiverId &&
        foundPatient.connectedCaregiverId !== accountId
      ) {

        Alert.alert(
          'Patient Already Connected',
          'This patient is already connected to another caregiver.'
        );

        return;

      }


      const currentCaregiver =
        accounts[caregiverIndex];


      if (
        currentCaregiver.connectedPatientId &&
        currentCaregiver.connectedPatientId !== foundPatient.id
      ) {

        Alert.alert(
          'Caregiver Already Connected',
          'Your caregiver account is already connected to another patient. Disconnect that patient before connecting to someone else.'
        );

        return;

      }


      const updatedAccounts =
        accounts.map(
          (item, index) => {

            if (
              index === caregiverIndex
            ) {

              return {
                ...item,

                connectedPatientId:
                  foundPatient.id,

                patientId:
                  foundPatient.id,
              };

            }


            if (
              index === patientIndex
            ) {

              return {
                ...item,

                connectedCaregiverId:
                  accountId,
              };

            }

            return item;

          }
        );


      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(updatedAccounts)
      );


      setPatient(
        foundPatient
      );

      setAccount(
        updatedAccounts[
          caregiverIndex
        ]
      );

      setConnectionCode('');


      Alert.alert(
        'Patient Connected',
        `${foundPatient.name || 'The patient'} is now connected to your caregiver account.`,
        [
          {
            text: 'OK',
          },
        ]
      );

    } catch (error) {

      console.log(
        'Connect patient error:',
        error
      );

      Alert.alert(
        'Connection Failed',
        'Something went wrong while connecting the patient. Please try again.'
      );

    } finally {

      setConnecting(false);

    }

  };


  // ==========================================
  // DISCONNECT
  // ==========================================

  const handleDisconnect = () => {

    if (!patient) {
      return;
    }

    Alert.alert(
      'Disconnect Patient?',
      `Are you sure you want to disconnect ${
        patient.name || 'this patient'
      } from your caregiver account?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: performDisconnect,
        },
      ]
    );

  };


  const performDisconnect = async () => {

    try {

      setConnecting(true);

      const saved =
        await AsyncStorage.getItem(
          ACCOUNTS_KEY
        );

      if (!saved) {
        return;
      }

      const accounts =
        JSON.parse(saved);

      if (!Array.isArray(accounts)) {
        return;
      }


      const patientId =
        patient?.id || null;


      const updatedAccounts =
        accounts.map(
          (item) => {

            if (
              item.id === accountId &&
              item.role === 'caregiver'
            ) {

              return {
                ...item,

                connectedPatientId:
                  null,

                patientId:
                  null,
              };

            }


            if (
              item.id === patientId &&
              item.role === 'patient'
            ) {

              return {
                ...item,

                connectedCaregiverId:
                  null,
              };

            }

            return item;

          }
        );


      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(updatedAccounts)
      );


      setPatient(null);

      setAccount(
        updatedAccounts.find(
          (item) =>
            item.id === accountId
        ) || null
      );


      Alert.alert(
        'Patient Disconnected',
        'The patient has been disconnected from your caregiver account.'
      );

    } catch (error) {

      console.log(
        'Disconnect error:',
        error
      );

      Alert.alert(
        'Unable to Disconnect',
        'We could not update the connection. Please try again.'
      );

    } finally {

      setConnecting(false);

    }

  };


  return (

    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        <Header
          navigation={navigation}
          title="Patient Connection"
          subtitle="Connect your caregiver account to a patient."
        />


        {loading ? (

          <View style={styles.loading}>

            <ActivityIndicator
              size="large"
              color="#6366F1"
            />

            <Text style={styles.loadingText}>
              Loading connection...
            </Text>

          </View>

        ) : patient ? (

          <>

            <View style={styles.connectedCard}>

              <View style={styles.connectedIcon}>

                <Ionicons
                  name="person"
                  size={28}
                  color="#6366F1"
                />

              </View>

              <View style={styles.connectedInfo}>

                <Text style={styles.connectedLabel}>
                  Connected Patient
                </Text>

                <Text style={styles.patientName}>
                  {patient.name ||
                    'Patient'}
                </Text>

                <Text style={styles.patientEmail}>
                  {patient.email ||
                    'Email not available'}
                </Text>

              </View>

              <View style={styles.badge}>

                <View style={styles.badgeDot} />

                <Text style={styles.badgeText}>
                  Connected
                </Text>

              </View>

            </View>


            <View style={styles.infoCard}>

              <Ionicons
                name="shield-checkmark-outline"
                size={23}
                color="#6366F1"
              />

              <Text style={styles.infoText}>
                Patient information is controlled
                by the patient’s caregiver
                permissions. A connection does not
                automatically grant access to
                information the patient has chosen
                to hide.
              </Text>

            </View>


            <TouchableOpacity
              style={styles.disconnectButton}
              onPress={handleDisconnect}
              disabled={connecting}
              activeOpacity={0.8}
            >

              {connecting ? (

                <ActivityIndicator
                  size="small"
                  color="#B91C1C"
                />

              ) : (

                <>

                  <Ionicons
                    name="unlink-outline"
                    size={20}
                    color="#B91C1C"
                  />

                  <Text style={styles.disconnectText}>
                    Disconnect Patient
                  </Text>

                </>

              )}

            </TouchableOpacity>

          </>

        ) : (

          <>

            <View style={styles.emptyCard}>

              <View style={styles.emptyIcon}>

                <Ionicons
                  name="people-outline"
                  size={35}
                  color="#6366F1"
                />

              </View>

              <Text style={styles.emptyTitle}>
                No Patient Connected
              </Text>

              <Text style={styles.emptyText}>
                Ask the patient to open their
                Caregiver settings and give you
                their six-digit connection code.
              </Text>

            </View>


            <Text style={styles.sectionTitle}>
              Patient Connection Code
            </Text>


            <View style={styles.codeCard}>

              <View style={styles.codeIcon}>

                <Ionicons
                  name="key-outline"
                  size={25}
                  color="#6366F1"
                />

              </View>

              <Text style={styles.codeTitle}>
                Enter the patient’s code
              </Text>

              <Text style={styles.codeDescription}>
                The patient’s code is a unique
                six-digit number shown in their
                Caregiver settings.
              </Text>


              <TextInput
                value={connectionCode}
                onChangeText={(value) =>
                  setConnectionCode(
                    value
                      .replace(/\D/g, '')
                      .slice(0, 6)
                  )
                }
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeInput}
                textAlign="center"
                accessibilityLabel="Patient connection code"
              />


              <Text style={styles.codeCount}>
                {connectionCode.length}/6 digits
              </Text>


              <TouchableOpacity
                style={[
                  styles.connectButton,
                  connecting &&
                    styles.connectButtonDisabled,
                ]}
                onPress={handleConnect}
                disabled={connecting}
                activeOpacity={0.8}
              >

                {connecting ? (

                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                ) : (

                  <>

                    <Ionicons
                      name="link-outline"
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text style={styles.connectText}>
                      Connect Patient
                    </Text>

                  </>

                )}

              </TouchableOpacity>

            </View>


            <View style={styles.privacyCard}>

              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6366F1"
              />

              <Text style={styles.privacyText}>
                The connection code identifies the
                patient account. Patient permissions
                still determine what information you
                can access.
              </Text>

            </View>

          </>

        )}

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// HEADER
// ==========================================

function Header({
  navigation,
  title,
  subtitle,
}) {

  return (

    <View style={styles.header}>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() =>
          navigation.goBack()
        }
        activeOpacity={0.8}
      >

        <Ionicons
          name="arrow-back"
          size={22}
          color="#111827"
        />

      </TouchableOpacity>

      <View style={styles.headerText}>

        <Text style={styles.title}>
          {title}
        </Text>

        <Text style={styles.subtitle}>
          {subtitle}
        </Text>

      </View>

    </View>

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

  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 3,
  },

  loading: {
    alignItems: 'center',
    paddingVertical: 70,
  },

  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
  },

  connectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  connectedIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  connectedInfo: {
    flex: 1,
  },

  connectedLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
  },

  patientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },

  patientEmail: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  badge: {
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366F1',
    marginRight: 4,
  },

  badgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#4F46E5',
  },

  infoCard: {
    backgroundColor: '#EEF0FF',
    borderRadius: 18,
    padding: 15,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#4B5563',
    marginLeft: 10,
  },

  disconnectButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 18,
  },

  disconnectText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 7,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    padding: 24,
    marginBottom: 24,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },

  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    alignItems: 'center',
  },

  codeIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  codeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },

  codeDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 15,
  },

  codeInput: {
    width: '100%',
    height: 58,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 15,
    backgroundColor: '#FAFAFA',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#1F2937',
  },

  codeCount: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
  },

  connectButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 14,
  },

  connectButtonDisabled: {
    opacity: 0.7,
  },

  connectText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 7,
  },

  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 5,
  },

  privacyText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    color: '#6B7280',
    marginLeft: 8,
  },

});