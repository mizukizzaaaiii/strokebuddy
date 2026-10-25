import React, { useEffect, useState } from 'react';

import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  GoogleSignin,
} from '@react-native-google-signin/google-signin';

import * as AppleAuthentication from 'expo-apple-authentication';


// ==========================================
// LOGIN ACCOUNT SCREEN
// ==========================================

export default function LoginAccountScreen({
  navigation,
}) {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');


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
  // OPEN EXISTING ACCOUNT
  // ==========================================

  const openAccount = (account) => {

    if (!account) {
      return;
    }


    // ========================================
    // PATIENT
    // ========================================

    if (account.role === 'patient') {

      navigation.replace(
        'PatientApp',
        {
          name: account.name,
          role: 'patient',
          email: account.email,
          accountId: account.id,
        }
      );

      return;
    }


    // ========================================
    // CAREGIVER
    // ========================================

    if (account.role === 'caregiver') {

      navigation.replace(
        'CaregiverApp',
        {
          name: account.name,
          role: 'caregiver',
          email: account.email,
          accountId: account.id,
        }
      );

      return;
    }


    // ========================================
    // INVALID ROLE
    // ========================================

    Alert.alert(
      'Account Error',
      'This account does not have a valid StrokeBuddy role.'
    );
  };


  // ==========================================
  // EMAIL + PASSWORD LOGIN
  // ==========================================

  const handleLogin = async () => {

    if (!email.trim() || !password) {

      Alert.alert(
        'Missing Information',
        'Please enter your email and password.'
      );

      return;
    }


    try {

      const savedAccounts =
        await AsyncStorage.getItem(
          'strokebuddy_accounts'
        );


      const accounts =
        savedAccounts
          ? JSON.parse(savedAccounts)
          : [];


      const normalizedEmail =
        email.trim().toLowerCase();


      const account =
        accounts.find(
          (item) =>
            item.email &&
            item.email.toLowerCase() ===
              normalizedEmail &&
            item.password === password
        );


      if (!account) {

        Alert.alert(
          'Login Failed',
          'The email or password is incorrect.'
        );

        return;
      }


      openAccount(account);

    } catch (error) {

      console.log(
        'Login error:',
        error
      );

      Alert.alert(
        'Something went wrong',
        'We could not log you in right now. Please try again.'
      );
    }
  };


  // ==========================================
  // NEW SOCIAL ACCOUNT
  // ==========================================

  const continueWithNewSocialAccount = (
    provider,
    socialUser
  ) => {

    navigation.navigate(
      'SignUp',
      {
        socialProvider: provider,
        socialUser: socialUser,
      }
    );
  };


  // ==========================================
  // APPLE LOGIN
  // ==========================================

  const handleAppleLogin = async () => {

    try {

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
      // APPLE SIGN IN
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
        'Apple Sign-In Credential:',
        credential
      );


      const appleUserId =
        credential.user;


      const appleEmail =
        credential.email || null;


      // ========================================
      // GET APPLE NAME
      // ========================================

      let appleName =
        'StrokeBuddy User';


      if (credential.fullName) {

        const formattedName =
          AppleAuthentication.formatFullName(
            credential.fullName,
            'default'
          );


        if (
          formattedName &&
          formattedName.trim()
        ) {

          appleName =
            formattedName.trim();

        }
      }


      // ========================================
      // GET SAVED ACCOUNTS
      // ========================================

      const savedAccounts =
        await AsyncStorage.getItem(
          'strokebuddy_accounts'
        );


      const accounts =
        savedAccounts
          ? JSON.parse(savedAccounts)
          : [];


      // ========================================
      // FIND EXISTING APPLE ACCOUNT
      // ========================================

      const existingAccount =
        accounts.find(
          (account) => {

            // Strong match:
            // Apple user ID

            if (
              account.appleUserId &&
              account.appleUserId ===
                appleUserId
            ) {

              return true;
            }


            // Secondary match:
            // Apple email

            if (
              appleEmail &&
              account.email &&
              account.email.toLowerCase() ===
                appleEmail.toLowerCase()
            ) {

              return true;
            }


            return false;
          }
        );


      // ========================================
      // EXISTING ACCOUNT
      // ========================================

      if (existingAccount) {

        // Make sure the Apple ID is saved
        // on the account for future logins.

        if (
          existingAccount.appleUserId !==
          appleUserId
        ) {

          const updatedAccounts =
            accounts.map(
              (account) => {

                if (
                  account.id ===
                  existingAccount.id
                ) {

                  return {
                    ...account,
                    appleUserId:
                      appleUserId,
                  };

                }

                return account;
              }
            );


          await AsyncStorage.setItem(
            'strokebuddy_accounts',
            JSON.stringify(
              updatedAccounts
            )
          );


          existingAccount.appleUserId =
            appleUserId;
        }


        openAccount(existingAccount);

        return;
      }


      // ========================================
      // NEW APPLE ACCOUNT
      // ========================================

      continueWithNewSocialAccount(
        'apple',
        {
          userId: appleUserId,
          email: appleEmail,
          name: appleName,
        }
      );

    } catch (error) {

      console.log(
        'Apple Sign-In error:',
        error
      );


      // User cancelled Apple Sign-In.

      if (
        error?.code ===
        'ERR_REQUEST_CANCELED'
      ) {

        return;
      }


      Alert.alert(
        'Apple Sign-In Failed',
        'We could not sign you in with Apple. Please try again.'
      );
    }
  };


  // ==========================================
  // GOOGLE LOGIN
  // ==========================================

  const handleGoogleLogin = async () => {

    try {

      // ========================================
      // CHECK GOOGLE SERVICES
      // ========================================

      await GoogleSignin.hasPlayServices();


      // ========================================
      // GOOGLE SIGN IN
      // ========================================

      const response =
        await GoogleSignin.signIn();


      console.log(
        'Google Sign-In Response:',
        response
      );


      // ========================================
      // GET GOOGLE USER
      // ========================================

      const googleUser =
        response?.data?.user;


      if (!googleUser) {

        Alert.alert(
          'Google Sign-In Failed',
          'We could not get your Google account information.'
        );

        return;
      }


      const googleUserId =
        googleUser.id;


      const googleEmail =
        googleUser.email;


      const googleName =
        googleUser.name ||
        googleUser.givenName ||
        'StrokeBuddy User';


      // ========================================
      // GET SAVED ACCOUNTS
      // ========================================

      const savedAccounts =
        await AsyncStorage.getItem(
          'strokebuddy_accounts'
        );


      const accounts =
        savedAccounts
          ? JSON.parse(savedAccounts)
          : [];


      // ========================================
      // FIND EXISTING GOOGLE ACCOUNT
      // ========================================

      const existingAccount =
        accounts.find(
          (account) => {

            // Strong match:
            // Google user ID

            if (
              account.googleUserId &&
              account.googleUserId ===
                googleUserId
            ) {

              return true;
            }


            // Secondary match:
            // Google email

            if (
              account.email &&
              googleEmail &&
              account.email.toLowerCase() ===
                googleEmail.toLowerCase()
            ) {

              return true;
            }


            return false;
          }
        );


      // ========================================
      // EXISTING ACCOUNT
      // ========================================

      if (existingAccount) {

        // Save Google ID if this account
        // was originally created with email.

        if (
          existingAccount.googleUserId !==
          googleUserId
        ) {

          const updatedAccounts =
            accounts.map(
              (account) => {

                if (
                  account.id ===
                  existingAccount.id
                ) {

                  return {
                    ...account,
                    googleUserId:
                      googleUserId,
                  };

                }

                return account;
              }
            );


          await AsyncStorage.setItem(
            'strokebuddy_accounts',
            JSON.stringify(
              updatedAccounts
            )
          );


          existingAccount.googleUserId =
            googleUserId;
        }


        openAccount(existingAccount);

        return;
      }


      // ========================================
      // NEW GOOGLE ACCOUNT
      // ========================================

      continueWithNewSocialAccount(
        'google',
        {
          userId: googleUserId,
          email: googleEmail,
          name: googleName,
        }
      );

    } catch (error) {

      console.log(
        'Google Sign-In error:',
        error
      );


      // ========================================
      // USER CANCELLED
      // ========================================

      if (
        error?.code ===
        'SIGN_IN_CANCELLED'
      ) {

        return;
      }


      Alert.alert(
        'Google Sign-In Failed',
        'We could not sign you in with Google. Please try again.'
      );
    }
  };


  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  const handleForgotPassword = () => {

    Alert.alert(
      'Forgot Password',
      'Password recovery will be added when we connect the secure account system.'
    );
  };


  // ==========================================
  // UI
  // ==========================================

  return (

    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >

      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.content}>

          {/* BACK */}

          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
          >

            <Text style={styles.backText}>
              ‹ Back
            </Text>

          </TouchableOpacity>


          {/* HEADER */}

          <Text style={styles.title}>
            Welcome back
          </Text>


          <Text style={styles.subtitle}>
            Log in to your StrokeBuddy account to continue.
          </Text>


          {/* EMAIL */}

          <Text style={styles.label}>
            Email
          </Text>


          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />


          {/* PASSWORD */}

          <Text style={styles.label}>
            Password
          </Text>


          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />


          {/* FORGOT PASSWORD */}

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={
              handleForgotPassword
            }
          >

            <Text style={styles.forgotText}>
              Forgot password?
            </Text>

          </TouchableOpacity>


          {/* LOGIN */}

          <TouchableOpacity
            style={[
              styles.loginButton,
              (
                !email.trim() ||
                !password
              ) &&
                styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={
              !email.trim() ||
              !password
            }
            activeOpacity={0.8}
          >

            <Text
              style={
                styles.loginButtonText
              }
            >
              Log In
            </Text>

          </TouchableOpacity>


          {/* DIVIDER */}

          <View
            style={
              styles.dividerContainer
            }
          >

            <View
              style={styles.divider}
            />

            <Text
              style={styles.dividerText}
            >
              OR
            </Text>

            <View
              style={styles.divider}
            />

          </View>


          {/* APPLE */}

          <TouchableOpacity
            style={styles.socialButton}
            onPress={
              handleAppleLogin
            }
            activeOpacity={0.8}
          >

            <Text
              style={styles.appleIcon}
            >
              
            </Text>

            <Text
              style={styles.socialText}
            >
              Continue with Apple
            </Text>

          </TouchableOpacity>


          {/* GOOGLE */}

          <TouchableOpacity
            style={styles.socialButton}
            onPress={
              handleGoogleLogin
            }
            activeOpacity={0.8}
          >

            <Text
              style={styles.googleIcon}
            >
              G
            </Text>

            <Text
              style={styles.socialText}
            >
              Continue with Google
            </Text>

          </TouchableOpacity>


          {/* SIGN UP */}

          <View
            style={styles.signupRow}
          >

            <Text
              style={styles.signupQuestion}
            >
              Don't have an account?
            </Text>


            <TouchableOpacity
              onPress={() =>
                navigation.navigate(
                  'SignUp'
                )
              }
            >

              <Text
                style={styles.signupLink}
              >
                Sign Up
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </ScrollView>

    </KeyboardAvoidingView>
  );
}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    padding: 24,
    paddingTop: 55,
    paddingBottom: 40,
  },

  backText: {
    color: '#5B6CFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 30,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 32,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 5,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 16,
  },

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 18,
  },

  forgotText: {
    color: '#5B6CFF',
    fontSize: 13,
    fontWeight: '600',
  },

  loginButton: {
    backgroundColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 23,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  dividerText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginHorizontal: 12,
    fontWeight: '600',
  },

  socialButton: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  appleIcon: {
    fontSize: 22,
    color: '#000000',
    marginRight: 10,
  },

  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 10,
  },

  socialText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },

  signupQuestion: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 5,
  },

  signupLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B6CFF',
  },

});