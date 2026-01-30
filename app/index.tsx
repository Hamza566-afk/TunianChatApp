import { createStackNavigator } from '@react-navigation/stack';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// استيراد الـ Screens
import ChatScreen from '../screens/ChatScreen';
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SignUpScreen from '../screens/SignUpScreen';

import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const Stack = createStackNavigator();

// 1. تصليح الـ Notification Handler لتفادي الـ Deprecation Warning
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // استعملنا هذم في بلاصة shouldShowAlert القديمة
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // 2. العسّاس (Auth Observer)
    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
      setLoading(false);
    });

    // 3. تسجيل الـ Notifications بطريقة آمنة
    async function registerNotifications() {
      if (Device.isDevice && auth.currentUser) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        try {
          const token = (await Notifications.getExpoPushTokenAsync({
            projectId: "b0c391fb-fbfd-43eb-96ed-8ded3add2672" 
          })).data;

          if (token) {
            await updateDoc(doc(db, "users", auth.currentUser.uid), { pushToken: token });
          }
        } catch (error) {
          console.log("Error getting push token:", error);
        }
      }
    }
    
    // نخدموها كان كي يبدأ فما User
    if (user) {
      registerNotifications();
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      unsubscribeAuth();
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [user]); // زدنا user هنا باش يعاود يثبت في الـ token كي يسجل دخول

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      // نحددوا الـ Initial Route حسب حالة المستخدم
      initialRouteName={user ? "Home" : "Login"}
    >
      {user ? (
        // الـ Group هذا يتحل كان كي يبدأ فما User
        <Stack.Group>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Group>
      ) : (
        // الـ Group هذا يتحل كان كي يخرج المستخدم (Sign Out)
        <Stack.Group screenOptions={{ animationTypeForReplace: 'pop' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} /> 
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}