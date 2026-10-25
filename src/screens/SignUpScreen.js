import React, { useState } from 'react';

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


// ==========================================
// SIGN UP SCREEN
// ==========================================

export default function SignUpScreen({
  navigation,
  route,
}) {

  // ========================================
  // SOCIAL ACCOUNT INFORMATION
  // ========================================

  const socialProvider =
    route?.params?.socialProvider || null;

  const socialUser =
    route?.params?.socialUser || null;


  const isSocialSignup =
    !!socialProvider &&
    !!socialUser;


  // ========================================
  // FORM STATE
  // ========================================

  const [name, setName] = useState(
    socialUser?.name || ''
  );

  const [email, setEmail] = useState(
    socialUser?.email || ''
  );

  const [password, setPassword] = useState('');

  const [role, setRole] = useState('');


  // ==========================================
  // CONNECTION CODE
  // ==========================================

  const generateConnectionCode = () => {

    return Math.floor(
      100000 +
      Math.random() * 900000
    ).toString();

  };


  // ==========================================
  // HANDLE SIGN UP
  // ==========================================

  const handleSignUp = async () => {

    // ========================================
    // VALIDATE REQUIRED INFORMATION
    // ========================================

    if (
      !name.trim() ||
      !email.trim() ||
      !role
    ) {

      Alert.alert(
        'Missing Information',
        'Please complete your name, email, and account type.'
      );

      return;
    }


    // ========================================
    // PASSWORD REQUIRED ONLY FOR
    // NORMAL EMAIL SIGNUP
    // ========================================

    if (
      !isSocialSignup &&
      !password
    ) {

      Alert.alert(
        'Missing Information',
        'Please create a password.'
      );

      return;
    }


    try {

      // ========================================
      // GET EXISTING ACCOUNTS
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
      // NORMALIZE EMAIL
      // ========================================

      const normalizedEmail =
        email.trim().toLowerCase();


      // ========================================
      // CHECK EXISTING EMAIL
      // ========================================

      const existingAccount =
        accounts.find(
          (account) =>
            account.email &&
            account.email.toLowerCase() ===
              normalizedEmail
        );


      // ========================================
      // EMAIL ALREADY EXISTS
      // ========================================

      if (existingAccount) {

        // ======================================
        // SOCIAL SIGNUP:
        // CONNECT SOCIAL LOGIN TO EXISTING
        // ACCOUNT INSTEAD OF CREATING DUPLICATE
        // ======================================

        if (isSocialSignup) {

          const updatedAccount = {
            ...existingAccount,
          };


          if (
            socialProvider ===
            'google'
          ) {

            updatedAccount.googleUserId =
              socialUser.userId;

          }


          if (
            socialProvider ===
            'apple'
          ) {

            updatedAccount.appleUserId =
              socialUser.userId;

          }


          // If the existing account doesn't
          // have a name, use the social name.

          if (
            !updatedAccount.name &&
            name.trim()
          ) {

            updatedAccount.name =
              name.trim();

          }


          const updatedAccounts =
            accounts.map(
              (account) =>
                account.id ===
                existingAccount.id
                  ? updatedAccount
                  : account
            );


          await AsyncStorage.setItem(
            'strokebuddy_accounts',
            JSON.stringify(
              updatedAccounts
            )
          );


          Alert.alert(
            'Account Connected',
            `${socialProvider === 'google' ? 'Google' : 'Apple'} has been connected to your existing StrokeBuddy account.`,
            [
              {
                text: 'Continue',
                onPress: () =>
                  openAccount(
                    updatedAccount
                  ),
              },
            ]
          );


          return;
        }


        // ======================================
        // NORMAL EMAIL SIGNUP
        // ======================================

        Alert.alert(
          'Account Already Exists',
          'An account with this email already exists. Please log in instead.'
        );

        return;
      }


      // ========================================
      // CREATE NEW ACCOUNT
      // ========================================

      const newAccount = {

        id:
          Date.now().toString(),

        name:
          name.trim(),

        email:
          normalizedEmail,

        // Normal password account gets a password.
        // Social account doesn't need one.

        password:
          isSocialSignup
            ? ''
            : password,

        role:

          role,

        connectionCode:
          generateConnectionCode(),

        connectedPatientId:
          null,

        connectedCaregiverId:
          null,

      };


      // ========================================
      // SAVE GOOGLE ID
      // ========================================

      if (
        socialProvider ===
        'google'
      ) {

        newAccount.googleUserId =
          socialUser.userId;

      }


      // ========================================
      // SAVE APPLE ID
      // ========================================

      if (
        socialProvider ===
        'apple'
      ) {

        newAccount.appleUserId =
          socialUser.userId;

      }


      // ========================================
      // SAVE ACCOUNT
      // ========================================

      const updatedAccounts = [
        ...accounts,
        newAccount,
      ];


      await AsyncStorage.setItem(
        'strokebuddy_accounts',
        JSON.stringify(
          updatedAccounts
        )
      );


      // ========================================
      // OPEN APP
      // ========================================

      openAccount(newAccount);

    } catch (error) {

      console.log(
        'Sign up error:',
        error
      );


      Alert.alert(
        'Something went wrong',
        'We could not create your account. Please try again.'
      );
    }
  };


  // ==========================================
  // OPEN ACCOUNT
  // ==========================================

  const openAccount = (account) => {

    if (!account) {
      return;
    }


    // ========================================
    // PATIENT
    // ========================================

    if (
      account.role ===
      'patient'
    ) {

      navigation.replace(
        'PatientApp',
        {
          name:
            account.name,

          role:
            'patient',

          email:
            account.email,

          accountId:
            account.id,
        }
      );

      return;
    }


    // ========================================
    // CAREGIVER
    // ========================================

    if (
      account.role ===
      'caregiver'
    ) {

      navigation.replace(
        'CaregiverApp',
        {
          name:
            account.name,

          role:
            'caregiver',

          email:
            account.email,

          accountId:
            account.id,
        }
      );

      return;
    }


    Alert.alert(
      'Account Error',
      'This account does not have a valid StrokeBuddy role.'
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

          {/* ==================================
              BACK
          ================================== */}

          <TouchableOpacity
            onPress={() =>
              navigation.goBack()
            }
          >

            <Text style={styles.backText}>
              ‹ Back
            </Text>

          </TouchableOpacity>


          {/* ==================================
              HEADER
          ================================== */}

          <Text style={styles.title}>
            {isSocialSignup
              ? 'Finish your account'
              : 'Create your account'}
          </Text>


          <Text style={styles.subtitle}>
            {isSocialSignup
              ? `Choose how you'll use StrokeBuddy with your ${socialProvider === 'google' ? 'Google' : 'Apple'} account.`
              : 'Set up your StrokeBuddy account to get started.'}
          </Text>


          {/* ==================================
              NAME
          ================================== */}

          <Text style={styles.label}>
            Your Name
          </Text>


          <TextInput
            style={[
              styles.input,
              isSocialSignup &&
                styles.inputDisabled,
            ]}

            placeholder="Enter your name"

            placeholderTextColor="#9CA3AF"

            value={name}

            onChangeText={setName}

            autoCapitalize="words"

            editable={!isSocialSignup}
          />


          {/* ==================================
              EMAIL
          ================================== */}

          <Text style={styles.label}>
            Email
          </Text>


          <TextInput
            style={[
              styles.input,
              isSocialSignup &&
                styles.inputDisabled,
            ]}

            placeholder="you@example.com"

            placeholderTextColor="#9CA3AF"

            value={email}

            onChangeText={setEmail}

            keyboardType="email-address"

            autoCapitalize="none"

            autoCorrect={false}

            editable={!isSocialSignup}
          />


          {/* ==================================
              PASSWORD
          ================================== */}

          {!isSocialSignup && (

            <>
              <Text style={styles.label}>
                Password
              </Text>


              <TextInput
                style={styles.input}

                placeholder="Create a password"

                placeholderTextColor="#9CA3AF"

                value={password}

                onChangeText={setPassword}

                secureTextEntry

                autoCapitalize="none"
              />
            </>

          )}


          {/* ==================================
              SOCIAL ACCOUNT NOTICE
          ================================== */}

          {isSocialSignup && (

            <View
              style={
                styles.socialNotice
              }
            >

              <Text
                style={
                  styles.socialNoticeTitle
                }
              >
                {socialProvider === 'google'
                  ? '✓ Google account connected'
                  : '✓ Apple account connected'}
              </Text>


              <Text
                style={
                  styles.socialNoticeText
                }
              >
                Your account will use{' '}
                {socialProvider === 'google'
                  ? 'Google'
                  : 'Apple'}{' '}
                to sign in.
              </Text>

            </View>

          )}


          {/* ==================================
              ACCOUNT TYPE
          ================================== */}

          <Text style={styles.accountTypeLabel}>
            What type of account are you creating?
          </Text>


          <View style={styles.roleContainer}>

            {/* ==================================
                PATIENT
            ================================== */}

            <TouchableOpacity
              style={[
                styles.roleButton,

                role === 'patient' &&
                  styles.roleButtonSelected,
              ]}

              onPress={() =>
                setRole('patient')
              }

              activeOpacity={0.8}
            >

              <View
                style={
                  styles.roleIconContainer
                }
              >

                <Text
                  style={styles.roleIcon}
                >
                  ♡
                </Text>

              </View>


              <View
                style={styles.roleInfo}
              >

                <Text
                  style={[
                    styles.roleTitle,

                    role === 'patient' &&
                      styles.roleTextSelected,
                  ]}
                >
                  Patient
                </Text>


                <Text
                  style={[
                    styles.roleDescription,

                    role === 'patient' &&
                      styles.roleTextSelected,
                  ]}
                >
                  I'm working on my recovery
                </Text>

              </View>


              {role === 'patient' && (

                <Text
                  style={styles.checkmark}
                >
                  ✓
                </Text>

              )}

            </TouchableOpacity>


            {/* ==================================
                CAREGIVER
            ================================== */}

            <TouchableOpacity
              style={[
                styles.roleButton,

                role === 'caregiver' &&
                  styles.roleButtonSelected,
              ]}

              onPress={() =>
                setRole('caregiver')
              }

              activeOpacity={0.8}
            >

              <View
                style={
                  styles.roleIconContainer
                }
              >

                <Text
                  style={styles.roleIcon}
                >
                  ♧
                </Text>

              </View>


              <View
                style={styles.roleInfo}
              >

                <Text
                  style={[
                    styles.roleTitle,

                    role === 'caregiver' &&
                      styles.roleTextSelected,
                  ]}
                >
                  Caregiver
                </Text>


                <Text
                  style={[
                    styles.roleDescription,

                    role === 'caregiver' &&
                      styles.roleTextSelected,
                  ]}
                >
                  I'm supporting a patient
                </Text>

              </View>


              {role === 'caregiver' && (

                <Text
                  style={styles.checkmark}
                >
                  ✓
                </Text>

              )}

            </TouchableOpacity>

          </View>


          {/* ==================================
              CREATE ACCOUNT
          ================================== */}

          <TouchableOpacity

            style={[
              styles.createButton,

              (
                !name.trim() ||
                !email.trim() ||
                !role ||
                (
                  !isSocialSignup &&
                  !password
                )
              ) &&
                styles.buttonDisabled,
            ]}

            onPress={
              handleSignUp
            }

            disabled={
              !name.trim() ||
              !email.trim() ||
              !role ||
              (
                !isSocialSignup &&
                !password
              )
            }

            activeOpacity={0.8}
          >

            <Text
              style={
                styles.createButtonText
              }
            >
              {isSocialSignup
                ? 'Finish Account'
                : 'Create Account'}
            </Text>

          </TouchableOpacity>


          {/* ==================================
              EXISTING ACCOUNT
          ================================== */}

          {!isSocialSignup && (

            <View
              style={styles.loginRow}
            >

              <Text
                style={
                  styles.loginQuestion
                }
              >
                Already have an account?
              </Text>


              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(
                    'LoginAccount'
                  )
                }
              >

                <Text
                  style={styles.loginLink}
                >
                  Log In
                </Text>

              </TouchableOpacity>

            </View>

          )}

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
    marginBottom: 28,
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
    marginBottom: 28,
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
    marginBottom: 14,
  },

  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
  },

  socialNotice: {
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  socialNoticeTitle: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },

  socialNoticeText: {
    color: '#6366F1',
    fontSize: 12,
    lineHeight: 18,
  },

  accountTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 10,
  },

  roleContainer: {
    gap: 10,
  },

  roleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  roleButtonSelected: {
    backgroundColor: '#818CF8',
    borderColor: '#818CF8',
  },

  roleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  roleIcon: {
    fontSize: 21,
    color: '#5B6CFF',
  },

  roleInfo: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 3,
  },

  roleDescription: {
    fontSize: 12,
    color: '#6B7280',
  },

  roleTextSelected: {
    color: '#FFFFFF',
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },

  createButton: {
    backgroundColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },

  loginQuestion: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 5,
  },

  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5B6CFF',
  },

});