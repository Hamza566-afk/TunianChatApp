import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDK9NhWJfil-HBjGwcQvmlm95codo0HhRM",
  authDomain: "tunisianchatapp.firebaseapp.com",
  projectId: "tunisianchatapp",
  storageBucket: "tunisianchatapp.firebasestorage.app",
  messagingSenderId: "104632230618",
  appId: "1:104632230618:web:a71d0689c4f9b88d863be3"
};

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Initialize Firestore (Database)
export const db = getFirestore(app);

// 3. Initialize Auth مع خاصية الـ Persistence (باش يبقى مسجل الدخول)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});