import React, {
  useEffect,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GoogleSignin,
} from '@react-native-google-signin/google-signin';

import * as AppleAuthentication from 'expo-apple-authentication';

import {
  Ionicons,
} from '@expo/vector-icons';


// ==========================================
// PATIENT SETTINGS SCREEN
// ==========================================

export default function SettingsScreen({
  navigation,
  route,
}) {

  const [account, setAccount] =
    useState(null);

  // ==========================================
  // CAREGIVER CONNECTION
  // ==========================================

  const [caregiver, setCaregiver] =
    useState(null);

  const [isConnectingGoogle, setIsConnectingGoogle] =
    useState(false);

  const [isConnectingApple, setIsConnectingApple] =
    useState(false);


  // ==========================================
  // GOOGLE CONFIGURATION
  // ==========================================

  useEffect(() => {

    GoogleSignin.configure({
      iosClientId:
        '402827347798-r191ntku6qtp9g1jtccn3ir2jaaeurqh.apps.googleusercontent.com',
    });

  }, []);


  // ==========================================
  // LOAD CURRENT ACCOUNT
  // ==========================================

  const loadAccount = async () => {

    try {

      const accountId =
        route?.params?.accountId;

      if (!accountId) {
        return;
      }

      const savedAccounts =
        await AsyncStorage.getItem(
          'strokebuddy_accounts'
        );

      const accounts =
        savedAccounts
          ? JSON.parse(savedAccounts)
          : [];


      const currentAccount =
        accounts.find(
          (item) =>
            item.id === accountId
        );


      if (currentAccount) {

        setAccount(
          currentAccount
        );


        // ========================================
        // FIND CONNECTED CAREGIVER
        // ========================================

        let connectedCaregiver =
          null;


        // ========================================
        // PATIENT STORES CAREGIVER ID
        // ========================================

        if (
          currentAccount.connectedCaregiverId
        ) {

          connectedCaregiver =
            accounts.find(
              (item) =>
                item.id ===
                  currentAccount.connectedCaregiverId &&
                item.role === 'caregiver'
            );

        }


        // ========================================
        // FALLBACK:
        // CAREGIVER STORES PATIENT ID
        // ========================================

        if (!connectedCaregiver) {

          connectedCaregiver =
            accounts.find(
              (item) =>
                item.role === 'caregiver' &&
                item.connectedPatientId ===
                  currentAccount.id
            );

        }


        setCaregiver(
          connectedCaregiver || null
        );

      } else {

        setAccount(null);
        setCaregiver(null);

      }

    } catch (error) {

      console.log(
        'Settings account load error:',
        error
      );

      setAccount(null);
      setCaregiver(null);

    }

  };


  // ==========================================
  // LOAD ACCOUNT
  // ==========================================

  useEffect(() => {

    loadAccount();

  }, [
    route?.params?.accountId,
  ]);


  // ==========================================
  // REFRESH WHEN SETTINGS OPENS
  // ==========================================

  useEffect(() => {

    const unsubscribe =
      navigation.addListener(
        'focus',
        loadAccount
      );

    return unsubscribe;

  }, [
    navigation,
    route?.params?.accountId,
  ]);


  // ==========================================
  // SAVE SOCIAL CONNECTION
  // ==========================================

  const saveSocialConnection = async (
    provider,
    userId,
    socialEmail
  ) => {

    try {

      const accountId =
        route?.params?.accountId;

      if (!accountId) {

        Alert.alert(
          'Account Error',
          'We could not identify your StrokeBuddy account.'
        );

        return false;
      }


      const savedAccounts =
        await AsyncStorage.getItem(
          'strokebuddy_accounts'
        );


      const accounts =
        savedAccounts
          ? JSON.parse(savedAccounts)
          : [];


      // ========================================
      // FIND CURRENT ACCOUNT
      // ========================================

      const currentAccount =
        accounts.find(
          (item) =>
            item.id === accountId
        );


      if (!currentAccount) {

        Alert.alert(
          'Account Error',
          'We could not find your StrokeBuddy account.'
        );

        return false;
      }


      // ========================================
      // CHECK IF SOCIAL ACCOUNT
      // IS ALREADY LINKED TO ANOTHER
      // STROKEBUDDY ACCOUNT
      // ========================================

      const alreadyUsed =
        accounts.find(
          (item) => {

            if (
              item.id ===
              currentAccount.id
            ) {
              return false;
            }


            if (
              provider ===
              'google'
            ) {

              return (
                item.googleUserId &&
                item.googleUserId ===
                  userId
              );

            }


            if (
              provider ===
              'apple'
            ) {

              return (
                item.appleUserId &&
                item.appleUserId ===
                  userId
              );

            }


            return false;

          }
        );


      if (alreadyUsed) {

        Alert.alert(
          'Account Already Linked',
          `This ${
            provider === 'google'
              ? 'Google'
              : 'Apple'
          } account is already connected to another StrokeBuddy account.`
        );

        return false;
      }


      // ========================================
      // CREATE UPDATED ACCOUNT
      // ========================================

      const updatedAccount = {
        ...currentAccount,
      };


      if (
        provider ===
        'google'
      ) {

        updatedAccount.googleUserId =
          userId;

      }


      if (
        provider ===
        'apple'
      ) {

        updatedAccount.appleUserId =
          userId;

      }


      // ========================================
      // KEEP EMAIL IF SOCIAL PROVIDER
      // HAS ONE
      // ========================================

      if (
        socialEmail &&
        !updatedAccount.email
      ) {

        updatedAccount.email =
          socialEmail
            .trim()
            .toLowerCase();

      }


      // ========================================
      // SAVE UPDATED ACCOUNTS
      // ========================================

      const updatedAccounts =
        accounts.map(
          (item) =>
            item.id ===
            currentAccount.id
              ? updatedAccount
              : item
        );


      await AsyncStorage.setItem(
        'strokebuddy_accounts',
        JSON.stringify(
          updatedAccounts
        )
      );


      // ========================================
      // UPDATE SCREEN
      // ========================================

      setAccount(
        updatedAccount
      );


      return true;

    } catch (error) {

      console.log(
        'Save social connection error:',
        error
      );


      Alert.alert(
        'Something Went Wrong',
        'We could not connect this account. Please try again.'
      );


      return false;

    }

  };


  // ==========================================
  // CONNECT GOOGLE
  // ==========================================

  const handleGoogleConnect = async () => {

    if (
      account?.googleUserId
    ) {

      Alert.alert(
        'Google Connected',
        'Your StrokeBuddy account is already connected to Google.'
      );

      return;
    }


    setIsConnectingGoogle(
      true
    );


    try {

      // ========================================
      // CHECK GOOGLE SERVICES
      // ========================================

      await GoogleSignin.hasPlayServices();


      // ========================================
      // SIGN IN WITH GOOGLE
      // ========================================

      const response =
        await GoogleSignin.signIn();


      console.log(
        'Google connection response:',
        response
      );


      const googleUser =
        response?.data?.user;


      if (!googleUser) {

        Alert.alert(
          'Google Sign-In Failed',
          'We could not verify your Google account.'
        );

        return;
      }


      const googleUserId =
        googleUser.id;


      const googleEmail =
        googleUser.email ||
        null;


      // ========================================
      // VERIFY SOCIAL ACCOUNT
      // ========================================

      if (!googleUserId) {

        Alert.alert(
          'Verification Failed',
          'Google did not provide a valid account ID.'
        );

        return;
      }


      // ========================================
      // SAVE CONNECTION
      // ========================================

      const success =
        await saveSocialConnection(
          'google',
          googleUserId,
          googleEmail
        );


      if (success) {

        Alert.alert(
          'Google Connected',
          'Your Google account has been securely connected to your StrokeBuddy account.'
        );

      }

    } catch (error) {

      console.log(
        'Google connection error:',
        error
      );


      if (
        error?.code ===
        'SIGN_IN_CANCELLED'
      ) {
        return;
      }


      if (
        error?.code ===
        'SIGN_IN_REQUIRED'
      ) {
        return;
      }


      Alert.alert(
        'Google Connection Failed',
        'We could not connect your Google account. Please try again.'
      );

    } finally {

      setIsConnectingGoogle(
        false
      );

    }

  };


  // ==========================================
  // CONNECT APPLE
  // ==========================================

  const handleAppleConnect = async () => {

    if (
      account?.appleUserId
    ) {

      Alert.alert(
        'Apple Connected',
        'Your StrokeBuddy account is already connected to Apple.'
      );

      return;
    }


    setIsConnectingApple(
      true
    );


    try {

      // ========================================
      // CHECK APPLE AVAILABILITY
      // ========================================

      const isAvailable =
        await AppleAuthentication.isAvailableAsync();


      if (!isAvailable) {

        Alert.alert(
          'Apple Sign-In Unavailable',
          'Apple Sign-In is not available on this device.'
        );

        return;
      }


      // ========================================
      // SIGN IN WITH APPLE
      // ========================================

      const credential =
        await AppleAuthentication.signInAsync({

          requestedScopes: [

            AppleAuthentication
              .AppleAuthenticationScope.FULL_NAME,

            AppleAuthentication
              .AppleAuthenticationScope.EMAIL,

          ],

        });


      console.log(
        'Apple connection credential:',
        credential
      );


      const appleUserId =
        credential.user;


      const appleEmail =
        credential.email ||
        null;


      // ========================================
      // VERIFY APPLE ACCOUNT
      // ========================================

      if (!appleUserId) {

        Alert.alert(
          'Verification Failed',
          'Apple did not provide a valid account ID.'
        );

        return;
      }


      // ========================================
      // SAVE CONNECTION
      // ========================================

      const success =
        await saveSocialConnection(
          'apple',
          appleUserId,
          appleEmail
        );


      if (success) {

        Alert.alert(
          'Apple Connected',
          'Your Apple account has been securely connected to your StrokeBuddy account.'
        );

      }

    } catch (error) {

      console.log(
        'Apple connection error:',
        error
      );


      if (
        error?.code ===
        'ERR_REQUEST_CANCELED'
      ) {
        return;
      }


      Alert.alert(
        'Apple Connection Failed',
        'We could not connect your Apple account. Please try again.'
      );

    } finally {

      setIsConnectingApple(
        false
      );

    }

  };


  // ==========================================
  // CAREGIVER CONNECTION & PERMISSIONS
  // ==========================================

  const handleCaregiverSettings = () => {

    navigation.navigate(
      'Caregiver'
    );

  };


  // ==========================================
  // PATIENT EXPERIENCE
  // ==========================================

  const handlePatientExperience = () => {

    navigation.navigate(
      'PatientExperience'
    );

  };


  // ==========================================
  // PRIVACY & DATA
  // ==========================================

  const handlePrivacyAndData = () => {

    navigation.navigate(
      'PrivacyData'
    );

  };


  // ==========================================
  // HELP & ABOUT
  // ==========================================

  const handleHelpAndAbout = () => {

    navigation.navigate(
      'HelpAbout'
    );

  };


  // ==========================================
  // LOG OUT
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

            navigation
              .getParent()
              ?.getParent()
              ?.replace('Login');

          },

        },

      ]
    );

  };


  // ==========================================
  // ACCOUNT PROVIDER STATUS
  // ==========================================

  const googleConnected =
    !!account?.googleUserId;


  const appleConnected =
    !!account?.appleUserId;


  // ==========================================
  // CAREGIVER STATUS
  // ==========================================

  const caregiverConnected =
    !!caregiver;


  // ==========================================
  // UI
  // ==========================================

  return (

    <SafeAreaView
      style={styles.safeArea}
    >

      <ScrollView
        style={styles.scrollView}

        contentContainerStyle={
          styles.container
        }

        showsVerticalScrollIndicator={
          true
        }

        keyboardShouldPersistTaps="handled"

        nestedScrollEnabled={
          true
        }
      >

        {/* ==================================
            HEADER
        ================================== */}

        <Text
          style={styles.header}
        >
          Settings
        </Text>


        <Text
          style={styles.headerSubtitle}
        >
          Manage your account and preferences
        </Text>


        {/* ==================================
            PROFILE
        ================================== */}

        <View
          style={
            styles.profileCard
          }
        >

          <Text
            style={
              styles.profileName
            }
          >
            {account?.name ||
              'StrokeBuddy Patient'}
          </Text>


          <Text
            style={
              styles.profileEmail
            }
          >
            {account?.email ||
              'No email available'}
          </Text>


          <Text
            style={[
              styles.profileStatus,

              caregiverConnected
                ? styles.profileConnectedStatus
                : styles.profileNotConnectedStatus,
            ]}
          >
            {caregiverConnected
              ? '● Caregiver Connected'
              : '● No Caregiver Connected'}
          </Text>

        </View>


        {/* ==================================
            ACCOUNT & SIGN-IN
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Account & Sign-In
        </Text>


        {/* ==================================
            GOOGLE
        ================================== */}

        <TouchableOpacity
          style={
            styles.accountItem
          }

          onPress={
            handleGoogleConnect
          }

          disabled={
            isConnectingGoogle ||
            googleConnected
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.accountInfo
            }
          >

            <View
              style={
                styles.providerIcon
              }
            >

              <Text
                style={
                  styles.googleIcon
                }
              >
                G
              </Text>

            </View>


            <View
              style={
                styles.providerText
              }
            >

              <Text
                style={
                  styles.accountTitle
                }
              >
                Google
              </Text>


              <Text
                style={
                  styles.accountDescription
                }
              >
                {googleConnected

                  ? 'Connected to this account'

                  : isConnectingGoogle

                    ? 'Connecting...'

                    : 'Tap to connect Google'}
              </Text>

            </View>

          </View>


          <View
            style={[
              styles.statusBadge,

              googleConnected
                ? styles.connectedBadge
                : styles.notConnectedBadge,
            ]}
          >

            <Text
              style={[
                styles.statusText,

                googleConnected
                  ? styles.connectedText
                  : styles.notConnectedText,
              ]}
            >
              {googleConnected

                ? 'Connected'

                : isConnectingGoogle

                  ? '...'

                  : 'Connect'}
            </Text>

          </View>

        </TouchableOpacity>


        {/* ==================================
            APPLE
        ================================== */}

        <TouchableOpacity
          style={
            styles.accountItem
          }

          onPress={
            handleAppleConnect
          }

          disabled={
            isConnectingApple ||
            appleConnected
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.accountInfo
            }
          >

            <View
              style={
                styles.providerIcon
              }
            >

              <Text
                style={
                  styles.appleIcon
                }
              >
                
              </Text>

            </View>


            <View
              style={
                styles.providerText
              }
            >

              <Text
                style={
                  styles.accountTitle
                }
              >
                Apple
              </Text>


              <Text
                style={
                  styles.accountDescription
                }
              >
                {appleConnected

                  ? 'Connected to this account'

                  : isConnectingApple

                    ? 'Connecting...'

                    : 'Tap to connect Apple'}
              </Text>

            </View>

          </View>


          <View
            style={[
              styles.statusBadge,

              appleConnected
                ? styles.connectedBadge
                : styles.notConnectedBadge,
            ]}
          >

            <Text
              style={[
                styles.statusText,

                appleConnected
                  ? styles.connectedText
                  : styles.notConnectedText,
              ]}
            >
              {appleConnected

                ? 'Connected'

                : isConnectingApple

                  ? '...'

                  : 'Connect'}
            </Text>

          </View>

        </TouchableOpacity>


        {/* ==================================
            CAREGIVER CONNECTION
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Caregiver Connection
        </Text>


        <TouchableOpacity
          style={
            styles.caregiverCard
          }

          onPress={
            handleCaregiverSettings
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.caregiverInfo
            }
          >

            {/* ==================================
                CAREGIVER AVATAR
            ================================== */}

            <View
              style={[
                styles.caregiverIcon,

                caregiverConnected &&
                caregiver?.profilePicture
                  ? styles.caregiverAvatar
                  : caregiverConnected
                  ? styles.caregiverConnectedIcon
                  : styles.caregiverNotConnectedIcon,
              ]}
            >

              {caregiverConnected &&
              caregiver?.profilePicture ? (

                <Image
                  source={{
                    uri:
                      caregiver.profilePicture,
                  }}
                  style={
                    styles.caregiverAvatarImage
                  }
                />

              ) : caregiverConnected ? (

                <Ionicons
                  name="person"
                  size={25}
                  color="#5B6CFF"
                />

              ) : (

                <Ionicons
                  name="person-add-outline"
                  size={26}
                  color="#45A66F"
                />

              )}

            </View>


            <View
              style={
                styles.caregiverTextContainer
              }
            >

              <Text
                style={
                  styles.caregiverTitle
                }
              >

                {caregiverConnected
                  ? caregiver?.name ||
                    'Caregiver Connected'
                  : 'No Caregiver Connected'}

              </Text>


              <Text
                style={
                  styles.caregiverDescription
                }
              >

                {caregiverConnected

                  ? 'Manage caregiver access and permissions'

                  : 'Connect a caregiver to share supported patient information'}

              </Text>

            </View>

          </View>


          <View
            style={[
              styles.caregiverStatusBadge,

              caregiverConnected
                ? styles.caregiverConnectedBadge
                : styles.caregiverNotConnectedBadge,
            ]}
          >

            <Text
              style={[
                styles.caregiverStatusText,

                caregiverConnected
                  ? styles.caregiverConnectedText
                  : styles.caregiverNotConnectedText,
              ]}
            >

              {caregiverConnected
                ? 'Connected'
                : 'Connect'}

            </Text>

          </View>

        </TouchableOpacity>


        {/* ==================================
            PREFERENCES
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Preferences
        </Text>


        {/* ACCESSIBILITY */}

        <TouchableOpacity
          style={
            styles.menuItem
          }

          onPress={() =>
            navigation.navigate(
              'Accessibility'
            )
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.menuTextContainer
            }
          >

            <Text
              style={
                styles.menuText
              }
            >
              Accessibility
            </Text>


            <Text
              style={
                styles.menuDescription
              }
            >
              Text size, contrast, and accessibility options
            </Text>

          </View>


          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>

        </TouchableOpacity>


        {/* NOTIFICATIONS */}

        <TouchableOpacity
          style={
            styles.menuItem
          }

          onPress={() =>
            navigation.navigate(
              'Notifications'
            )
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.menuTextContainer
            }
          >

            <Text
              style={
                styles.menuText
              }
            >
              Notifications
            </Text>


            <Text
              style={
                styles.menuDescription
              }
            >
              Manage medication, exercise, message, and alert notifications
            </Text>

          </View>


          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>

        </TouchableOpacity>


        {/* ==================================
            EMERGENCY & SAFETY
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Emergency & Safety
        </Text>


        {/* EMERGENCY */}

        <TouchableOpacity
          style={
            styles.menuItem
          }

          onPress={() =>
            navigation.navigate(
              'Emergency'
            )
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.menuTextContainer
            }
          >

            <Text
              style={
                styles.menuText
              }
            >
              Emergency Contacts
            </Text>


            <Text
              style={
                styles.menuDescription
              }
            >
              Manage your emergency and caregiver contacts
            </Text>

          </View>


          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>

        </TouchableOpacity>


        {/* ==================================
            PATIENT EXPERIENCE
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Patient Experience
        </Text>


        <TouchableOpacity
          style={
            styles.menuItem
          }

          onPress={
            handlePatientExperience
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.menuTextContainer
            }
          >

            <Text
              style={
                styles.menuText
              }
            >
              Patient Experience
            </Text>


            <Text
              style={
                styles.menuDescription
              }
            >
              Customize your StrokeBuddy experience
            </Text>

          </View>


          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>

        </TouchableOpacity>


        {/* ==================================
            PRIVACY & DATA
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Privacy & Data
        </Text>


        <TouchableOpacity
          style={
            styles.menuItem
          }

          onPress={
            handlePrivacyAndData
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.menuTextContainer
            }
          >

            <Text
              style={
                styles.menuText
              }
            >
              Privacy & Data
            </Text>


            <Text
              style={
                styles.menuDescription
              }
            >
              Information about your account and app data
            </Text>

          </View>


          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>

        </TouchableOpacity>


        {/* ==================================
            HELP & ABOUT
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Help & About
        </Text>


        <TouchableOpacity
          style={
            styles.menuItem
          }

          onPress={
            handleHelpAndAbout
          }

          activeOpacity={0.75}
        >

          <View
            style={
              styles.menuTextContainer
            }
          >

            <Text
              style={
                styles.menuText
              }
            >
              Help & About
            </Text>


            <Text
              style={
                styles.menuDescription
              }
            >
              Learn more about StrokeBuddy
            </Text>

          </View>


          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>

        </TouchableOpacity>


        {/* ==================================
            ACCOUNT STATUS
        ================================== */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Account Status
        </Text>


        <View
          style={
            styles.accountStatusCard
          }
        >

          <View
            style={
              styles.accountStatusRow
            }
          >

            <Text
              style={
                styles.accountStatusLabel
              }
            >
              Account
            </Text>


            <Text
              style={
                styles.accountStatusValue
              }
            >
              Active
            </Text>

          </View>


          <View
            style={
              styles.statusDivider
            }
          />


          <View
            style={
              styles.accountStatusRow
            }
          >

            <Text
              style={
                styles.accountStatusLabel
              }
            >
              Caregiver
            </Text>


            <Text
              style={[
                styles.accountStatusValue,

                caregiverConnected
                  ? styles.accountStatusConnected
                  : styles.accountStatusNotConnected,
              ]}
            >

              {caregiverConnected
                ? 'Connected'
                : 'Not Connected'}

            </Text>

          </View>


          {caregiverConnected && (

            <>

              <View
                style={
                  styles.statusDivider
                }
              />


              <View
                style={
                  styles.accountStatusRow
                }
              >

                <Text
                  style={
                    styles.accountStatusLabel
                  }
                >
                  Caregiver Name
                </Text>


                <Text
                  style={
                    styles.accountStatusValue
                  }
                >

                  {caregiver?.name ||
                    'Caregiver'}

                </Text>

              </View>

            </>

          )}

        </View>


        {/* ==================================
            LOG OUT
        ================================== */}

        <TouchableOpacity
          style={
            styles.logoutButton
          }

          onPress={
            handleLogout
          }

          activeOpacity={0.8}
        >

          <Text
            style={
              styles.logoutText
            }
          >
            Log Out
          </Text>

        </TouchableOpacity>


        {/* ==================================
            BOTTOM SPACING
        ================================== */}

        <View
          style={
            styles.bottomSpacer
          }
        />

      </ScrollView>

    </SafeAreaView>

  );

}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  // ========================================
  // SCREEN
  // ========================================

  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },


  scrollView: {
    flex: 1,
  },


  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },


  // ========================================
  // HEADER
  // MATCHES OTHER PATIENT SCREENS
  // ========================================

  header: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.4,
  },


  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#777777',
    marginTop: 5,
    marginBottom: 20,
  },


  // ========================================
  // PROFILE
  // ========================================

  profileCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },


  profileName: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: '#1F2937',
  },


  profileEmail: {
    fontSize: 13,
    lineHeight: 18,
    color: '#777777',
    marginTop: 4,
  },


  profileStatus: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 7,
  },


  profileConnectedStatus: {
    color: '#34A853',
  },


  profileNotConnectedStatus: {
    color: '#9CA3AF',
  },


  // ========================================
  // SECTION
  // ========================================

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    marginTop: 4,
  },


  // ========================================
  // ACCOUNT PROVIDERS
  // ========================================

  accountItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },


  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },


  providerIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },


  providerText: {
    flex: 1,
  },


  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
  },


  appleIcon: {
    fontSize: 24,
    color: '#000000',
  },


  accountTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#1F2937',
  },


  accountDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: '#777777',
    marginTop: 3,
  },


  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },


  connectedBadge: {
    backgroundColor: '#EAF8EE',
  },


  notConnectedBadge: {
    backgroundColor: '#F3F4F6',
  },


  statusText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },


  connectedText: {
    color: '#34A853',
  },


  notConnectedText: {
    color: '#6B7280',
  },


  // ========================================
  // CAREGIVER CONNECTION
  // ========================================

  caregiverCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },


  caregiverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },


  caregiverIcon: {
    width: 49,
    height: 49,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },


  caregiverConnectedIcon: {
    backgroundColor: '#EEF0FF',
  },


  caregiverNotConnectedIcon: {
    backgroundColor: '#EEF0FF',
  },


  // ========================================
  // CAREGIVER PROFILE PICTURE
  // ========================================

  caregiverAvatar: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },


  caregiverAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },


  caregiverTextContainer: {
    flex: 1,
  },


  caregiverTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#1F2937',
  },


  caregiverDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: '#777777',
    marginTop: 3,
  },


  caregiverStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },


  caregiverConnectedBadge: {
    backgroundColor: '#EAF8EE',
  },


  caregiverNotConnectedBadge: {
    backgroundColor: '#F3F4F6',
  },


  caregiverStatusText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },


  caregiverConnectedText: {
    color: '#34A853',
  },


  caregiverNotConnectedText: {
    color: '#6B7280',
  },


  // ========================================
  // MENU
  // ========================================

  menuItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },


  menuTextContainer: {
    flex: 1,
    paddingRight: 10,
  },


  menuText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: '#1F2937',
  },


  menuDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: '#777777',
    marginTop: 3,
  },


  arrow: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400',
    color: '#AAAAAA',
    marginLeft: 8,
  },


  // ========================================
  // ACCOUNT STATUS
  // ========================================

  accountStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },


  accountStatusRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },


  accountStatusLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: '#777777',
  },


  accountStatusValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#1F2937',
    maxWidth: '55%',
    textAlign: 'right',
  },


  accountStatusConnected: {
    color: '#34A853',
  },


  accountStatusNotConnected: {
    color: '#9CA3AF',
  },


  statusDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },


  // ========================================
  // LOG OUT
  // ========================================

  logoutButton: {
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },


  logoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },


  // ========================================
  // BOTTOM SPACING
  // ========================================

  bottomSpacer: {
    height: 30,
  },

});