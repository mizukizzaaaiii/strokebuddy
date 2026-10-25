import React from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function LoginScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.content}>

        <View style={styles.header}>

          <Text style={styles.title}>
            Welcome to StrokeBuddy
          </Text>

          <Text style={styles.subtitle}>
            A simple way to support stroke recovery and care.
          </Text>

        </View>


        <View style={styles.buttons}>

          {/* LOG IN */}

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() =>
              navigation.navigate(
                'LoginAccount'
              )
            }
            activeOpacity={0.8}
          >

            <Text style={styles.loginText}>
              Log In
            </Text>

          </TouchableOpacity>


          {/* SIGN UP */}

          <TouchableOpacity
            style={styles.signUpButton}
            onPress={() =>
              navigation.navigate(
                'SignUp'
              )
            }
            activeOpacity={0.8}
          >

            <Text style={styles.signUpText}>
              Sign Up
            </Text>

          </TouchableOpacity>

        </View>


        <Text style={styles.footer}>
          Your recovery journey, supported.
        </Text>

      </View>

    </SafeAreaView>
  );
}


const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },

  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },

  header: {
    marginBottom: 45,
  },

  title: {
    fontSize: 29,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    maxWidth: 330,
  },

  buttons: {
    gap: 12,
  },

  loginButton: {
    backgroundColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  loginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  signUpButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  signUpText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '600',
  },

  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 35,
  },

});