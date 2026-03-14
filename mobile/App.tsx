import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { WalletProvider } from "./src/context/WalletContext";
import LoginScreen from "./src/screens/LoginScreen";
import CourseListScreen from "./src/screens/CourseListScreen";
import CourseDetailScreen from "./src/screens/CourseDetailScreen";
import CoursePlayerScreen from "./src/screens/CoursePlayerScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// Stack for Courses tab
function CoursesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CourseList"
        component={CourseListScreen}
        options={{ title: "Courses" }}
      />
      <Stack.Screen
        name="CourseDetail"
        component={CourseDetailScreen}
        options={{ title: "Course Details" }}
      />
      <Stack.Screen
        name="CoursePlayer"
        component={CoursePlayerScreen}
        options={{ title: "Course Player" }}
      />
    </Stack.Navigator>
  );
}

// Main app with bottom tabs
function AppTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Courses"
        component={CoursesStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user } = useAuth();
  return user ? <AppTabs /> : <AuthStack />;
}

export default function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </WalletProvider>
    </AuthProvider>
  );
}
