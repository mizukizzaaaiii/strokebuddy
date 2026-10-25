import React, { useCallback, useState } from 'react';
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
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useEmergencyContacts } from '../context/EmergencyContactsContext';
import { useAccessibility } from '../context/AccessibilityContext';

const DEFAULT_PATIENT_EXPERIENCE = {
  recoveryTips: true,
  dailyMotivation: true,
  exerciseConfirmation: true,
  streakCelebrations: true,
  progressUpdates: true,
  caregiverSharingReminder: true,
};

const HomeScreen = ({ navigation, route }) => {
  const { name: routeName, accountId } = route.params || {};

  const { primaryContact } = useEmergencyContacts();
  const { largeText, highContrast } = useAccessibility();

  const [account, setAccount] = useState(null);
  const [caregiver, setCaregiver] = useState(null);
  const [completedExercises, setCompletedExercises] = useState(0);
  const [totalExercises] = useState(10);
  const [recoveryStreak, setRecoveryStreak] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [patientExperience, setPatientExperience] = useState(
    DEFAULT_PATIENT_EXPERIENCE
  );

  const loadPatientExperienceSettings = async () => {
    try {
      const key = `strokebuddy_patient_experience_${
        accountId || 'default_patient'
      }`;

      const saved = await AsyncStorage.getItem(key);

      if (saved) {
        const parsed = JSON.parse(saved);

        setPatientExperience({
          ...DEFAULT_PATIENT_EXPERIENCE,
          ...parsed,
        });
      } else {
        setPatientExperience(DEFAULT_PATIENT_EXPERIENCE);
      }
    } catch (error) {
      console.log(
        'Error loading patient experience settings:',
        error
      );

      setPatientExperience(DEFAULT_PATIENT_EXPERIENCE);
    }
  };

  // FIXED: Supports both id/accountId and both directions
  // of the patient/caregiver connection.
  const findConnectedCaregiver = (accounts, patient) => {
    if (!Array.isArray(accounts) || !patient) {
      return null;
    }

    const patientId =
      patient.accountId || patient.id || null;

    // First check the patient's connected caregiver
    const connectedCaregiverId =
      patient.connectedCaregiverId ||
      patient.caregiverId ||
      null;

    if (connectedCaregiverId) {
      const connected = accounts.find(
        acc =>
          acc.role === 'caregiver' &&
          (
            acc.accountId === connectedCaregiverId ||
            acc.id === connectedCaregiverId
          )
      );

      if (connected) {
        return connected;
      }
    }

    // Then check caregivers who have this patient connected
    const connectedCaregiver = accounts.find(
      acc =>
        acc.role === 'caregiver' &&
        (
          acc.connectedPatientId === patientId ||
          acc.patientId === patientId ||
          acc.connectedPatientAccountId === patientId
        )
    );

    return connectedCaregiver || null;
  };

  const loadHomeData = async () => {
    try {
      const accountsData = await AsyncStorage.getItem(
        'strokebuddy_accounts'
      );

      const accounts = accountsData
        ? JSON.parse(accountsData)
        : [];

      // FIXED: Patient can be identified by either id or accountId
      const patient =
        accounts.find(
          acc =>
            acc.role === 'patient' &&
            (
              acc.accountId === accountId ||
              acc.id === accountId
            )
        ) ||
        accounts.find(acc => acc.role === 'patient');

      if (patient) {
        setAccount(patient);

        const connectedCaregiver =
          findConnectedCaregiver(
            accounts,
            patient
          );

        setCaregiver(connectedCaregiver);
      } else {
        setAccount(null);
        setCaregiver(null);
      }

      const recoveryKey = `strokebuddy_recovery_${
        accountId || 'default_patient'
      }`;

      const recoveryData =
        await AsyncStorage.getItem(recoveryKey);

      if (recoveryData) {
        const recovery = JSON.parse(recoveryData);

        setCompletedExercises(
          recovery.completedExercisesToday || 0
        );

        setRecoveryStreak(
          recovery.recoveryStreak || 0
        );

        setTodayCompleted(
          recovery.todayCompleted || false
        );
      } else {
        setCompletedExercises(0);
        setRecoveryStreak(0);
        setTodayCompleted(false);
      }
    } catch (error) {
      console.log(
        'Error loading home data:',
        error
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
      loadPatientExperienceSettings();
    }, [accountId])
  );

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        loadHomeData(),
        loadPatientExperienceSettings(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const progressPercentage =
    totalExercises > 0
      ? Math.min(
          100,
          Math.round(
            (completedExercises / totalExercises) * 100
          )
        )
      : 0;

  const sendCaregiverMessage = async message => {
    try {
      const accountsData =
        await AsyncStorage.getItem(
          'strokebuddy_accounts'
        );

      const accounts = accountsData
        ? JSON.parse(accountsData)
        : [];

      // FIXED: Patient can be identified by either id or accountId
      const patient =
        accounts.find(
          acc =>
            acc.role === 'patient' &&
            (
              acc.accountId === accountId ||
              acc.id === accountId
            )
        ) ||
        accounts.find(acc => acc.role === 'patient');

      const connectedCaregiver =
        findConnectedCaregiver(
          accounts,
          patient
        );

      if (!connectedCaregiver) {
        Alert.alert(
          'No Caregiver Connected',
          'Connect with a caregiver in Settings to send messages'
        );

        return;
      }

      const messagesKey = 'strokebuddy_messages';

      const existingMessages =
        await AsyncStorage.getItem(messagesKey);

      const messages = existingMessages
        ? JSON.parse(existingMessages)
        : [];

      const newMessage = {
        id: Date.now().toString(),
        senderId:
          patient?.accountId ||
          patient?.id ||
          accountId,
        senderRole: 'patient',
        recipientId:
          connectedCaregiver.accountId ||
          connectedCaregiver.id,
        message,
        timestamp: new Date().toISOString(),
        read: false,
      };

      messages.push(newMessage);

      await AsyncStorage.setItem(
        messagesKey,
        JSON.stringify(messages)
      );

      Alert.alert(
        'Message Sent',
        'Your caregiver has been notified'
      );
    } catch (error) {
      console.log(
        'Error sending caregiver message:',
        error
      );

      Alert.alert(
        'Unable to Send',
        'Please try again'
      );
    }
  };

  const handleQuickNeed = type => {
    if (type === 'call') {
      if (primaryContact?.phone) {
        Linking.openURL(
          `tel:${primaryContact.phone}`
        );

        return;
      }

      if (caregiver?.phone) {
        Linking.openURL(
          `tel:${caregiver.phone}`
        );

        return;
      }

      Alert.alert(
        'No Caregiver Contact',
        'Add an emergency contact or connect a caregiver in Settings'
      );

      return;
    }

    const messages = {
      water: 'I need some water',
      bathroom:
        'I need help getting to the bathroom',
      food: 'I need some food',
      help: 'I need some help',
    };

    if (messages[type]) {
      sendCaregiverMessage(messages[type]);
    }
  };

  const openVoiceScreen = () => {
    navigation.navigate('Voice');
  };

  const openMedsScreen = () => {
    navigation.navigate('Meds');
  };

  const openExercisesScreen = () => {
    navigation.navigate('Exercises');
  };

  const openEmergencyContacts = () => {
    navigation.navigate('Settings', {
      screen: 'EmergencyContacts',
    });
  };

  const openSettings = () => {
    navigation.navigate('Settings');
  };

  const displayName =
    account?.name ||
    routeName ||
    'there';

  const streakMessage =
    recoveryStreak > 0
      ? `${recoveryStreak} day${
          recoveryStreak === 1 ? '' : 's'
        } in a row`
      : 'Start your recovery streak today';

  const colors = {
    background: highContrast
      ? '#FFFFFF'
      : '#FAF8F5',

    text: highContrast
      ? '#000000'
      : '#1F2937',

    secondary: highContrast
      ? '#1F2937'
      : '#777777',

    primary: highContrast
      ? '#000000'
      : '#5B6CFF',

    border: highContrast
      ? '#111827'
      : '#E5E7EB',

    card: '#FFFFFF',
  };

  if (!account && !routeName) {
    // Do not block the screen while account data loads.
    // The regular Home UI still renders using "there".
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          largeText &&
            styles.containerLarge,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        {/* HEADER */}
        <View
          style={[
            styles.header,
            largeText &&
              styles.headerLarge,
          ]}
        >
          <View style={styles.headerText}>
            <Text
              allowFontScaling
              style={[
                styles.appTitle,
                largeText &&
                  styles.appTitleLarge,
                {
                  color: colors.primary,
                },
              ]}
            >
              StrokeBuddy
            </Text>

            <Text
              allowFontScaling
              style={[
                styles.welcomeText,
                largeText &&
                  styles.welcomeTextLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Welcome back, {displayName}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.chatButton,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#EEF0FF',
                borderColor:
                  highContrast
                    ? '#111827'
                    : 'transparent',
                borderWidth:
                  highContrast ? 2 : 0,
              },
            ]}
            onPress={openVoiceScreen}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Message caregiver"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={25}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* DAILY MOTIVATION */}
        {patientExperience.dailyMotivation && (
          <View
            style={[
              styles.motivationCard,
              largeText &&
                styles.motivationCardLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#EEF0FF',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#E0E3FF',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.motivationIcon,
                largeText &&
                  styles.motivationIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#DDE2FF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 2 : 0,
                },
              ]}
            >
              <Ionicons
                name="sunny-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <View
              style={styles.motivationContent}
            >
              <Text
                allowFontScaling
                style={[
                  styles.motivationLabel,
                  largeText &&
                    styles.motivationLabelLarge,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                DAILY MOTIVATION
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.motivationText,
                  largeText &&
                    styles.motivationTextLarge,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Every small step is part of your recovery
              </Text>
            </View>
          </View>
        )}

        {/* RECOVERY PROGRESS */}
        <TouchableOpacity
          style={[
            styles.progressCard,
            largeText &&
              styles.progressCardLarge,
            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,

              borderWidth:
                highContrast ? 2 : 1,
            },
          ]}
          onPress={openExercisesScreen}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.progressHeader,
              largeText &&
                styles.progressHeaderLarge,
            ]}
          >
            <View
              style={[
                styles.progressIcon,
                largeText &&
                  styles.progressIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#EEF0FF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 2 : 0,
                },
              ]}
            >
              <Ionicons
                name="trending-up-outline"
                size={26}
                color={colors.primary}
              />
            </View>

            <View
              style={styles.progressHeaderText}
            >
              <Text
                allowFontScaling
                style={[
                  styles.cardTitle,
                  largeText &&
                    styles.cardTitleLarge,
                  {
                    color: colors.text,
                  },
                ]}
              >
                Today’s Recovery
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.cardSubtitle,
                  largeText &&
                    styles.cardSubtitleLarge,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                Keep building your progress
              </Text>
            </View>

            <Text
              allowFontScaling
              style={[
                styles.progressPercentage,
                largeText &&
                  styles.progressPercentageLarge,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              {progressPercentage}%
            </Text>
          </View>

          <View
            style={[
              styles.progressTrack,
              largeText &&
                styles.progressTrackLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#D1D5DB'
                    : '#ECECF2',

                borderColor:
                  highContrast
                    ? '#111827'
                    : 'transparent',

                borderWidth:
                  highContrast ? 1 : 0,
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    `${progressPercentage}%`,

                  backgroundColor:
                    colors.primary,
                },
              ]}
            />
          </View>

          <View
            style={styles.progressBottom}
          >
            <Text
              allowFontScaling
              style={[
                styles.progressCount,
                largeText &&
                  styles.progressCountLarge,
                {
                  color:
                    colors.secondary,
                },
              ]}
            >
              {completedExercises} of {totalExercises} exercises completed
            </Text>

            <Text
              allowFontScaling
              style={[
                styles.viewText,
                largeText &&
                  styles.viewTextLarge,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              View
            </Text>
          </View>
        </TouchableOpacity>

        {/* STREAK */}
        {patientExperience.streakCelebrations && (
          <View
            style={[
              styles.infoRow,
              largeText &&
                styles.infoRowLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#FFFDF7',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#F4E7C2',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.infoIcon,
                largeText &&
                  styles.infoIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#FFF4D6',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 2 : 0,
                },
              ]}
            >
              <Ionicons
                name="flame-outline"
                size={26}
                color={
                  highContrast
                    ? '#000000'
                    : '#D99000'
                }
              />
            </View>

            <View
              style={styles.infoContent}
            >
              <Text
                allowFontScaling
                style={[
                  styles.infoTitle,
                  largeText &&
                    styles.infoTitleLarge,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                7-Day Recovery Streak
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.infoSubtitle,
                  largeText &&
                    styles.infoSubtitleLarge,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                {streakMessage}
              </Text>
            </View>

            <View
              style={
                styles.streakNumberContainer
              }
            >
              <Text
                allowFontScaling
                style={[
                  styles.streakNumber,
                  largeText &&
                    styles.streakNumberLarge,
                  {
                    color:
                      highContrast
                        ? '#000000'
                        : '#D99000',
                  },
                ]}
              >
                {recoveryStreak}
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.streakDays,
                  largeText &&
                    styles.streakDaysLarge,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                DAYS
              </Text>
            </View>
          </View>
        )}

        {/* CAREGIVER CONNECTION */}
        <TouchableOpacity
          style={[
            styles.infoRow,
            largeText &&
              styles.infoRowLarge,
            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,

              borderWidth:
                highContrast ? 2 : 1,
            },
          ]}
          onPress={openSettings}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.infoIcon,
              largeText &&
                styles.infoIconLarge,
              caregiver &&
                  styles.caregiverAvatarCircle,

              caregiver?.profilePicture &&
                styles.caregiverAvatarContainer,

              caregiver?.profilePicture &&
                largeText &&
                styles.caregiverAvatarContainerLarge,

              {
                backgroundColor:
                  caregiver?.profilePicture
                    ? '#FFFFFF'
                    : highContrast
                    ? '#FFFFFF'
                    : '#EEF0FF',

                borderColor:
                  highContrast
                    ? '#111827'
                    : caregiver?.profilePicture
                    ? '#E5E7EB'
                    : 'transparent',

                borderWidth:
                  highContrast
                    ? 2
                    : caregiver?.profilePicture
                    ? 1
                    : 0,
              },
            ]}
          >
            {caregiver?.profilePicture ? (
            <Image
              source={{ uri: caregiver.profilePicture }}
              style={styles.caregiverAvatarImage}
            />
          ) : caregiver ? (
            <Ionicons
              name="person"
              size={25}
              color={highContrast ? '#000000' : '#5B6CFF'}
            />
          ) : (
            <Ionicons
              name="person-add-outline"
              size={26}
              color={highContrast ? '#000000' : '#45A66F'}
            />
          )}
          </View>

          <View
            style={styles.infoContent}
          >
            <Text
              allowFontScaling
              style={[
                styles.infoTitle,
                largeText &&
                  styles.infoTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              {caregiver
                ? caregiver.name ||
                  'Caregiver Connected'
                : 'No Caregiver Connected'}
            </Text>

            <Text
              allowFontScaling
              style={[
                styles.infoSubtitle,
                largeText &&
                  styles.infoSubtitleLarge,
                {
                  color:
                    colors.secondary,
                },
              ]}
            >
              {caregiver
                ? 'Your caregiver is connected'
                : 'Connect a caregiver in Settings'}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={colors.secondary}
          />
        </TouchableOpacity>

        {/* QUICK NEEDS */}
        <View
          style={[
            styles.sectionHeader,
            largeText &&
              styles.sectionHeaderLarge,
          ]}
        >
          <Text
            allowFontScaling
            style={[
              styles.sectionTitle,
              largeText &&
                styles.sectionTitleLarge,
              {
                color: colors.text,
              },
            ]}
          >
            Quick Needs
          </Text>

          <Text
            allowFontScaling
            style={[
              styles.sectionSubtitle,
              largeText &&
                styles.sectionSubtitleLarge,
              {
                color:
                  colors.secondary,
              },
            ]}
          >
            Let your caregiver know what you need
          </Text>
        </View>

        <View
          style={styles.quickNeedsGrid}
        >
          {/* WATER */}
          <TouchableOpacity
            style={[
              styles.quickTile,
              largeText &&
                styles.quickTileLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#E8F5FF',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#D7ECFA',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={() =>
              handleQuickNeed('water')
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickIcon,
                largeText &&
                  styles.quickIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#D7EEFF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 1 : 0,
                },
              ]}
            >
              <Ionicons
                name="water-outline"
                size={28}
                color={
                  highContrast
                    ? '#000000'
                    : '#3B82F6'
                }
              />
            </View>

            <Text
              allowFontScaling
              style={[
                styles.quickTitle,
                largeText &&
                  styles.quickTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Water
            </Text>
          </TouchableOpacity>

          {/* BATHROOM */}
          <TouchableOpacity
            style={[
              styles.quickTile,
              largeText &&
                styles.quickTileLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#F3ECFF',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#E8DDF9',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={() =>
              handleQuickNeed('bathroom')
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickIcon,
                largeText &&
                  styles.quickIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#E9DDFF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 1 : 0,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="toilet"
                size={28}
                color={
                  highContrast
                    ? '#000000'
                    : '#8B5CF6'
                }
              />
            </View>

            <Text
              allowFontScaling
              style={[
                styles.quickTitle,
                largeText &&
                  styles.quickTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Bathroom
            </Text>
          </TouchableOpacity>

          {/* FOOD */}
          <TouchableOpacity
            style={[
              styles.quickTile,
              largeText &&
                styles.quickTileLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#FFF1E5',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#F8E0CA',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={() =>
              handleQuickNeed('food')
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickIcon,
                largeText &&
                  styles.quickIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#FFE5D0',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 1 : 0,
                },
              ]}
            >
              <Ionicons
                name="restaurant-outline"
                size={28}
                color={
                  highContrast
                    ? '#000000'
                    : '#E87832'
                }
              />
            </View>

            <Text
              allowFontScaling
              style={[
                styles.quickTitle,
                largeText &&
                  styles.quickTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Food
            </Text>
          </TouchableOpacity>

          {/* MEDICATIONS */}
          <TouchableOpacity
            style={[
              styles.quickTile,
              largeText &&
                styles.quickTileLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#EAF7EF',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#D8EEDF',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={openMedsScreen}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickIcon,
                largeText &&
                  styles.quickIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#DDF1E4',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 1 : 0,
                },
              ]}
            >
              <Ionicons
                name="medkit-outline"
                size={28}
                color={
                  highContrast
                    ? '#000000'
                    : '#3FA36C'
                }
              />
            </View>

            <Text
              allowFontScaling
              style={[
                styles.quickTitle,
                largeText &&
                  styles.quickTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Medications
            </Text>
          </TouchableOpacity>

          {/* HELP */}
          <TouchableOpacity
            style={[
              styles.quickTile,
              largeText &&
                styles.quickTileLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#FFF0F1',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#F7DDDF',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={() =>
              handleQuickNeed('help')
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickIcon,
                largeText &&
                  styles.quickIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#FFE0E2',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 1 : 0,
                },
              ]}
            >
              <Ionicons
                name="hand-left-outline"
                size={28}
                color={
                  highContrast
                    ? '#000000'
                    : '#E05A63'
                }
              />
            </View>

            <Text
              allowFontScaling
              style={[
                styles.quickTitle,
                largeText &&
                  styles.quickTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Help
            </Text>
          </TouchableOpacity>

          {/* CALL CAREGIVER */}
          <TouchableOpacity
            style={[
              styles.quickTile,
              largeText &&
                styles.quickTileLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#EEF0FF',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#DEE2FF',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={() =>
              handleQuickNeed('call')
            }
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.quickIcon,
                largeText &&
                  styles.quickIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#DEE2FF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 1 : 0,
                },
              ]}
            >
              <Ionicons
                name="call-outline"
                size={28}
                color={
                  highContrast
                    ? '#000000'
                    : colors.primary
                }
              />
            </View>

            <Text
              allowFontScaling
              style={[
                styles.quickTitle,
                largeText &&
                  styles.quickTitleLarge,
                {
                  color: colors.text,
                },
              ]}
            >
              Call Caregiver
            </Text>
          </TouchableOpacity>
        </View>

        {/* MORE ACTIONS */}
        <View
          style={[
            styles.actionsSection,
            largeText &&
              styles.actionsSectionLarge,
          ]}
        >
          {/* TODAY'S MEDICATIONS */}
          <TouchableOpacity
            style={[
              styles.actionRow,
              largeText &&
                styles.actionRowLarge,
              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={openMedsScreen}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.actionIcon,
                largeText &&
                  styles.actionIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#EAF7EF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 2 : 0,
                },
              ]}
            >
              <Ionicons
                name="medical-outline"
                size={26}
                color={
                  highContrast
                    ? '#000000'
                    : '#3FA36C'
                }
              />
            </View>

            <View
              style={styles.actionText}
            >
              <Text
                allowFontScaling
                style={[
                  styles.actionTitle,
                  largeText &&
                    styles.actionTitleLarge,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Today’s Medications
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.actionSubtitle,
                  largeText &&
                    styles.actionSubtitleLarge,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                View your medication schedule
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.secondary}
            />
          </TouchableOpacity>

          {/* MESSAGE CAREGIVER */}
          <TouchableOpacity
            style={[
              styles.actionRow,
              largeText &&
                styles.actionRowLarge,
              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={openVoiceScreen}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.actionIcon,
                largeText &&
                  styles.actionIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#EEF0FF',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 2 : 0,
                },
              ]}
            >
              <Ionicons
                name="chatbubble-outline"
                size={26}
                color={
                  highContrast
                    ? '#000000'
                    : colors.primary
                }
              />
            </View>

            <View
              style={styles.actionText}
            >
              <Text
                allowFontScaling
                style={[
                  styles.actionTitle,
                  largeText &&
                    styles.actionTitleLarge,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Message Caregiver
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.actionSubtitle,
                  largeText &&
                    styles.actionSubtitleLarge,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                Send a message or use quick phrases
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.secondary}
            />
          </TouchableOpacity>

          {/* EMERGENCY CONTACTS */}
          <TouchableOpacity
            style={[
              styles.emergencyRow,
              largeText &&
                styles.emergencyRowLarge,
              {
                backgroundColor:
                  highContrast
                    ? '#FFFFFF'
                    : '#FFF4F4',

                borderColor:
                  highContrast
                    ? '#111827'
                    : '#F4DEDE',

                borderWidth:
                  highContrast ? 2 : 1,
              },
            ]}
            onPress={openEmergencyContacts}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.emergencyIcon,
                largeText &&
                  styles.emergencyIconLarge,
                {
                  backgroundColor:
                    highContrast
                      ? '#FFFFFF'
                      : '#FFE3E3',

                  borderColor:
                    highContrast
                      ? '#111827'
                      : 'transparent',

                  borderWidth:
                    highContrast ? 2 : 0,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={26}
                color={
                  highContrast
                    ? '#000000'
                    : '#D9535D'
                }
              />
            </View>

            <View
              style={styles.actionText}
            >
              <Text
                allowFontScaling
                style={[
                  styles.actionTitle,
                  largeText &&
                    styles.actionTitleLarge,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Emergency Contacts
              </Text>

              <Text
                allowFontScaling
                style={[
                  styles.actionSubtitle,
                  largeText &&
                    styles.actionSubtitleLarge,
                  {
                    color:
                      colors.secondary,
                  },
                ]}
              >
                Manage your emergency contacts
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.secondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  containerLarge: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 80,
  },

  /* ---------------- HEADER ---------------- */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  headerLarge: {
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    paddingRight: 14,
  },

  appTitle: {
  fontSize: 30,
  fontWeight: '800',
  letterSpacing: -0.5,
  lineHeight: 32,
  marginBottom: 3,
  },

  appTitleLarge: {
    fontSize: 38,
    lineHeight: 42,
  },

  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 29,
  },

  welcomeTextLarge: {
    fontSize: 30,
    lineHeight: 39,
  },

  chatButton: {
    width: 50,
    height: 50,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  /* ---------------- MOTIVATION ---------------- */

  motivationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF0FF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E3FF',
  },

  motivationCardLarge: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginBottom: 17,
  },

  motivationIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: '#DDE2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  motivationIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 15,
  },

  motivationContent: {
    flex: 1,
  },

  motivationLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },

  motivationLabelLarge: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 6,
  },

  motivationText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },

  motivationTextLarge: {
    fontSize: 19,
    lineHeight: 26,
  },

  /* ---------------- PROGRESS ---------------- */

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  progressCardLarge: {
    paddingVertical: 20,
    paddingHorizontal: 19,
    borderRadius: 22,
    marginBottom: 15,
  },

  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },

  progressHeaderLarge: {
    marginBottom: 18,
  },

  progressIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  progressIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    marginRight: 15,
  },

  progressHeaderText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },

  cardTitleLarge: {
    fontSize: 21,
    lineHeight: 28,
  },

  cardSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },

  cardSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },

  progressPercentage: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
  },

  progressPercentageLarge: {
    fontSize: 23,
    lineHeight: 30,
    marginLeft: 14,
  },

  progressTrack: {
    height: 7,
    width: '100%',
    backgroundColor: '#ECECF2',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 11,
  },

  progressTrackLarge: {
    height: 8,
    borderRadius: 7,
    marginBottom: 13,
  },

  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#5B6CFF',
  },

  progressBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  progressCount: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },

  progressCountLarge: {
    fontSize: 14,
    lineHeight: 21,
  },

  viewText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 10,
  },

  viewTextLarge: {
    fontSize: 15,
  },

  /* ---------------- INFO ROWS ---------------- */

  infoRow: {
    minHeight: 75,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  infoRowLarge: {
    minHeight: 89,
    paddingVertical: 18,
    paddingHorizontal: 17,
    borderRadius: 22,
    marginBottom: 15,
  },

  infoIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  infoIconLarge: {
    width: 59,
    height: 59,
    borderRadius: 20,
    marginRight: 14,
  },

  caregiverAvatarContainer: {
    overflow: 'hidden',
  },

  caregiverAvatarContainerLarge: {
    overflow: 'hidden',
  },

  caregiverAvatarImage: {
    width: 49,
    height: 49,
    borderRadius: 17,
  },

  caregiverAvatarImageLarge: {
    width: 59,
    height: 59,
    borderRadius: 20,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },

  infoTitleLarge: {
    fontSize: 20,
    lineHeight: 27,
  },

  infoSubtitle: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 17,
  },

  infoSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },

  streakNumberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    minWidth: 38,
  },

  streakNumber: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 29,
  },

  streakNumberLarge: {
    fontSize: 34,
    lineHeight: 40,
  },

  streakDays: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
    letterSpacing: 0.4,
  },

  streakDaysLarge: {
    fontSize: 11,
    marginTop: 2,
  },

  /* ---------------- SECTION ---------------- */

  sectionHeader: {
    marginTop: 15,
    marginBottom: 12,
  },

  sectionHeaderLarge: {
    marginTop: 19,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
    marginBottom: 3,
  },

  sectionTitleLarge: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 5,
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },

  sectionSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
  },

  /* ---------------- QUICK NEEDS ---------------- */

  quickNeedsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  quickTile: {
    width: '48.2%',
    minHeight: 116,
    borderRadius: 20,
    padding: 15,
    marginBottom: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
  },

  quickTileLarge: {
    minHeight: 140,
    padding: 18,
    borderRadius: 22,
    marginBottom: 15,
  },

  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },

  quickIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 20,
  },

  quickTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },

  quickTitleLarge: {
    fontSize: 19,
    lineHeight: 26,
  },

  /* ---------------- ACTIONS ---------------- */

  actionsSection: {
    marginTop: 9,
  },

  actionsSectionLarge: {
    marginTop: 12,
  },

  actionRow: {
    minHeight: 75,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  actionRowLarge: {
    minHeight: 89,
    paddingVertical: 18,
    paddingHorizontal: 17,
    borderRadius: 22,
    marginBottom: 15,
  },

  actionIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  actionIconLarge: {
    width: 59,
    height: 59,
    borderRadius: 20,
    marginRight: 14,
  },

  actionText: {
    flex: 1,
  },

  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },

  actionTitleLarge: {
    fontSize: 20,
    lineHeight: 27,
  },

  actionSubtitle: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 17,
  },

  actionSubtitleLarge: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 5,
  },

  /* ---------------- EMERGENCY ---------------- */

  emergencyRow: {
    minHeight: 75,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },

  emergencyRowLarge: {
    minHeight: 89,
    paddingVertical: 18,
    paddingHorizontal: 17,
    borderRadius: 22,
  },

  emergencyIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  emergencyIconLarge: {
    width: 59,
    height: 59,
    borderRadius: 20,
    marginRight: 14,
  },
  
  caregiverAvatarCircle: {
  borderRadius: 999,
  overflow: 'hidden',
  },
});

export default HomeScreen;