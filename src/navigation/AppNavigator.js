import React from 'react';

import {
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import {
  NavigationContainer,
} from '@react-navigation/native';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import {
  Ionicons,
} from '@expo/vector-icons';


// ==========================================
// EMERGENCY CONTACT CONTEXT
// ==========================================

import {
  EmergencyContactsProvider,
} from '../context/EmergencyContactsContext';


// ==========================================
// ACCESSIBILITY CONTEXT
// ==========================================

import {
  AccessibilityProvider,
} from '../context/AccessibilityContext';


// ==========================================
// PATIENT SCREENS
// ==========================================

import HomeScreen from '../screens/HomeScreen';
import MedsScreen from '../screens/MedsScreen';
import VoiceScreen from '../screens/VoiceScreen';
import ExercisesScreen from '../screens/ExercisesScreen';
import SettingsScreen from '../screens/SettingsScreen';


// ==========================================
// AUTHENTICATION SCREENS
// ==========================================

import LoginScreen from '../screens/LoginScreen';
import LoginAccountScreen from '../screens/LoginAccountScreen';
import SignUpScreen from '../screens/SignUpScreen';


// ==========================================
// CAREGIVER MAIN SCREENS
// ==========================================

import CaregiverHomeScreen from '../screens/Caregiver Screens/CaregiverHomeScreen';
import CaregiverMedsScreen from '../screens/Caregiver Screens/CaregiverMedsScreen';
import CaregiverVoiceScreen from '../screens/Caregiver Screens/CaregiverVoiceScreen';
import CaregiverPTScreen from '../screens/Caregiver Screens/CaregiverPTScreen';
import CaregiverSettingsScreen from '../screens/Caregiver Screens/CaregiverSettingsScreen';


// ==========================================
// CAREGIVER SETTINGS SCREENS
// ==========================================

import CaregiverPermissionsScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverPermissionsScreen';
import CaregiverAccountScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverAccountScreen';
import CaregiverConnectionScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverConnectionScreen';
import CaregiverNotificationsScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverNotificationsScreen';
import CaregiverAccessibilityScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverAccessibilityScreen';
import CaregiverExperienceScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverExperienceScreen';
import CaregiverEmergencyScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverEmergencyScreen';
import CaregiverPrivacyDataScreen from '../screens/Caregiver Screens/Caregiver Settings/CaregiverPrivacyDataScreen';

// ==========================================
// PATIENT SETTINGS SCREENS
// ==========================================

import AccessibilityScreen from '../screens/Settings/AccessibilityScreen';
import CaregiverScreen from '../screens/Settings/CaregiverScreen';
import EmergencyScreen from '../screens/Settings/EmergencyScreen';
import NotificationsScreen from '../screens/Settings/NotificationsScreen';
import PatientExperienceScreen from '../screens/Settings/PatientExperienceScreen';
import PrivacyDataScreen from '../screens/Settings/PrivacyDataScreen';
import HelpAboutScreen from '../screens/Settings/HelpAboutScreen';


// ==========================================
// PATIENT EXERCISE SCREENS
// ==========================================

import BreathingExerciseScreen from '../screens/Exercise ML Camera/BreathingExerciseScreen';
import FacialExerciseScreen from '../screens/Exercise ML Camera/FacialExerciseScreen';
import PTExerciseScreen from '../screens/Exercise ML Camera/PTExerciseScreen';


// ==========================================
// NAVIGATORS
// ==========================================

const Tab = createBottomTabNavigator();
const CaregiverTab = createBottomTabNavigator();

const Stack = createNativeStackNavigator();
const CaregiverStack = createNativeStackNavigator();


// ==========================================
// PATIENT SETTINGS STACK
// ==========================================

function SettingsStack({ route }) {

  const {
    name,
    role,
    email,
    accountId,
  } = route?.params || {};

  return (
    <Stack.Navigator
      initialRouteName="MainSettings"
      screenOptions={{
        headerShown: false,
        contentStyle: {
          flex: 1,
          minHeight: 0,
        },
      }}
    >

      <Stack.Screen
        name="MainSettings"
        component={SettingsScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="Accessibility"
        component={AccessibilityScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="Caregiver"
        component={CaregiverScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="Emergency"
        component={EmergencyScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="PatientExperience"
        component={PatientExperienceScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="PrivacyData"
        component={PrivacyDataScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="HelpAbout"
        component={HelpAboutScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

    </Stack.Navigator>
  );
}


// ==========================================
// PATIENT EXERCISE STACK
// ==========================================

function ExerciseStack({ route }) {

  const {
    name,
    role,
    email,
    accountId,
  } = route?.params || {};

  return (
    <Stack.Navigator
      initialRouteName="MainExercises"
      screenOptions={{
        headerShown: false,
        contentStyle: {
          flex: 1,
          minHeight: 0,
        },
      }}
    >

      <Stack.Screen
        name="MainExercises"
        component={ExercisesScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="BreathingExercise"
        component={BreathingExerciseScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="FacialExercise"
        component={FacialExerciseScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

      <Stack.Screen
        name="PTExercise"
        component={PTExerciseScreen}
        initialParams={{
          name,
          role,
          email,
          accountId,
        }}
      />

    </Stack.Navigator>
  );
}


// ==========================================
// PATIENT FLOATING VOICE BUTTON
// ==========================================

function CustomVoiceButton({
  children,
  onPress,
}) {

  return (
    <TouchableOpacity
      style={styles.voiceButtonContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.voiceButtonCircle}>
        {children}
      </View>
    </TouchableOpacity>
  );
}


// ==========================================
// PATIENT APP
// ==========================================

function PatientApp({ route }) {

  const {
    name,
    role,
    email,
    accountId,
  } = route?.params || {};

  return (
    <AccessibilityProvider
      accountId={accountId}
    >

      <Tab.Navigator
        screenOptions={({ route }) => ({

          headerShown: false,

          sceneStyle: {
            flex: 1,
            minHeight: 0,
          },

          tabBarActiveTintColor: '#6366F1',

          tabBarInactiveTintColor: '#9CA3AF',

          tabBarStyle: styles.tabBar,

          tabBarLabelStyle: styles.tabBarLabel,

          tabBarIcon: ({
            focused,
            color,
            size,
          }) => {

            let iconName;

            if (route.name === 'Home') {

              iconName = focused
                ? 'home'
                : 'home-outline';

            }

            else if (route.name === 'Meds') {

              iconName = focused
                ? 'medkit'
                : 'medkit-outline';

            }

            else if (route.name === 'Voice') {

              iconName = focused
                ? 'chatbubbles'
                : 'chatbubbles-outline';

            }

            else if (route.name === 'Exercises') {

              iconName = focused
                ? 'fitness'
                : 'fitness-outline';

            }

            else if (route.name === 'Settings') {

              iconName = focused
                ? 'settings'
                : 'settings-outline';

            }

            return (
              <Ionicons
                name={iconName}
                size={size || 22}
                color={color}
              />
            );

          },

        })}
      >

        <Tab.Screen
          name="Home"
          component={HomeScreen}
          initialParams={{
            name,
            role,
            email,
            accountId,
          }}
        />

        <Tab.Screen
          name="Meds"
          component={MedsScreen}
          initialParams={{
            name,
            role,
            email,
            accountId,
          }}
        />

        <Tab.Screen
          name="Voice"
          component={VoiceScreen}
          options={{
            title: 'Messages',
          }}
          initialParams={{
            name,
            role,
            email,
            accountId,
          }}
        />

        <Tab.Screen
          name="Exercises"
          component={ExerciseStack}
          initialParams={{
            name,
            role,
            email,
            accountId,
          }}
        />

        <Tab.Screen
          name="Settings"
          component={SettingsStack}
          initialParams={{
            name,
            role,
            email,
            accountId,
          }}
        />

      </Tab.Navigator>

    </AccessibilityProvider>
  );
}


// ==========================================
// CAREGIVER TABS
// ==========================================

function CaregiverTabs({ route }) {

  const {
    name,
    role,
    email,
    accountId,
  } = route?.params || {};

  const caregiverRole =
    role || 'caregiver';

  return (
    <CaregiverTab.Navigator
      initialRouteName="Home"

      screenOptions={({ route }) => ({

        headerShown: false,

        sceneStyle: {
          flex: 1,
          minHeight: 0,
        },

        tabBarActiveTintColor: '#6366F1',

        tabBarInactiveTintColor: '#9CA3AF',

        tabBarStyle: styles.caregiverTabBar,

        tabBarLabelStyle: styles.caregiverTabBarLabel,

        tabBarIcon: ({
          focused,
          color,
          size,
        }) => {

          let iconName;

          if (route.name === 'Home') {

            iconName = focused
              ? 'home'
              : 'home-outline';

          }

          else if (route.name === 'Meds') {

            iconName = focused
              ? 'medical'
              : 'medical-outline';

          }

          // CHANGED: Voice microphone icon -> Message chat icon
          else if (route.name === 'Voice') {

            iconName = focused
              ? 'chatbubbles'
              : 'chatbubbles-outline';

          }

          else if (route.name === 'PT Progress') {

            iconName = focused
              ? 'fitness'
              : 'fitness-outline';

          }

          else if (route.name === 'Settings') {

            iconName = focused
              ? 'settings'
              : 'settings-outline';

          }

          return (
            <Ionicons
              name={iconName}
              size={size || 22}
              color={color}
            />
          );

        },

      })}
    >

      <CaregiverTab.Screen
        name="Home"
        component={CaregiverHomeScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverTab.Screen
        name="Meds"
        component={CaregiverMedsScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      {/* CHANGED: Display "Message" while keeping the internal route name "Voice" */}
      <CaregiverTab.Screen
        name="Voice"
        component={CaregiverVoiceScreen}
        options={{
          tabBarLabel: 'Message',
        }}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverTab.Screen
        name="PT Progress"
        component={CaregiverPTScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverTab.Screen
        name="Settings"
        component={CaregiverSettingsScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

    </CaregiverTab.Navigator>
  );
}


// ==========================================
// CAREGIVER APP STACK
// ==========================================

function CaregiverApp({ route }) {

  const {
    name,
    role,
    email,
    accountId,
  } = route?.params || {};

  const caregiverRole =
    role || 'caregiver';

  return (
    <CaregiverStack.Navigator
      initialRouteName="CaregiverTabs"

      screenOptions={{
        headerShown: false,

        contentStyle: {
          flex: 1,
          minHeight: 0,
        },
      }}
    >

      <CaregiverStack.Screen
        name="CaregiverTabs"
        component={CaregiverTabs}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverSettingsScreen"
        component={CaregiverSettingsScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverAccount"
        component={CaregiverAccountScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverConnection"
        component={CaregiverConnectionScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverNotifications"
        component={CaregiverNotificationsScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverAccessibility"
        component={CaregiverAccessibilityScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverExperience"
        component={CaregiverExperienceScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="Permissions"
        component={CaregiverPermissionsScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverEmergency"
        component={CaregiverEmergencyScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

      <CaregiverStack.Screen
        name="CaregiverPrivacyData"
        component={CaregiverPrivacyDataScreen}
        initialParams={{
          name,
          role: caregiverRole,
          email,
          accountId,
        }}
      />

    </CaregiverStack.Navigator>
  );
}


// ==========================================
// MAIN APP NAVIGATOR
// ==========================================

export default function AppNavigator() {

  return (
    <EmergencyContactsProvider>

      <NavigationContainer>

        <Stack.Navigator
          initialRouteName="Login"

          screenOptions={{
            headerShown: false,

            contentStyle: {
              flex: 1,
              minHeight: 0,
            },
          }}
        >

          <Stack.Screen
            name="Login"
            component={LoginScreen}
          />

          <Stack.Screen
            name="LoginAccount"
            component={LoginAccountScreen}
          />

          <Stack.Screen
            name="SignUp"
            component={SignUpScreen}
          />

          <Stack.Screen
            name="PatientApp"
            component={PatientApp}
          />

          <Stack.Screen
            name="CaregiverApp"
            component={CaregiverApp}
          />

        </Stack.Navigator>

      </NavigationContainer>

    </EmergencyContactsProvider>
  );
}


// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({

  // ========================================
  // PATIENT TAB BAR
  // ========================================

  tabBar: {

    height: 70,

    paddingBottom: 10,

    paddingTop: 8,

    backgroundColor: '#FFFFFF',

    borderTopWidth: 1,

    borderTopColor: '#F3F4F6',

    elevation: 8,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: -2,
    },

    shadowOpacity: 0.05,

    shadowRadius: 10,

  },


  tabBarLabel: {

    fontSize: 11,

    fontWeight: '500',

  },


  // ========================================
  // PATIENT VOICE BUTTON
  // ========================================

  voiceButtonContainer: {

    top: -20,

    justifyContent: 'center',

    alignItems: 'center',

  },


  voiceButtonCircle: {

    width: 58,

    height: 58,

    borderRadius: 29,

    backgroundColor: '#6366F1',

    justifyContent: 'center',

    alignItems: 'center',

    shadowColor: '#6366F1',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.35,

    shadowRadius: 8,

    elevation: 6,

  },


  // ========================================
  // CAREGIVER TAB BAR
  // ========================================

  caregiverTabBar: {

    height: 70,

    paddingBottom: 10,

    paddingTop: 8,

    backgroundColor: '#FFFFFF',

    borderTopWidth: 1,

    borderTopColor: '#F3F4F6',

    elevation: 8,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: -2,
    },

    shadowOpacity: 0.05,

    shadowRadius: 10,

  },


  caregiverTabBarLabel: {

    fontSize: 10,

    fontWeight: '500',

  },

});