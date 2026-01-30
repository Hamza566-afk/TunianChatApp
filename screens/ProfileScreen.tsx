import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { signOut, updateEmail, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function ProfileScreen({ navigation }: any) {
  const [userData, setUserData] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState(auth.currentUser?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (!auth.currentUser) return;
      try {
        const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setNewName(data.username || '');
          setBirthDate(data.birthDate || '');
          setCity(data.city || '');
          setGovernorate(data.governorate || '');
          setPhotoURL(data.photoURL || '');
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    fetchUser();
  }, []);

  const uploadToCloudinary = async (imageUri: string) => {
    setUploading(true);
    const data = new FormData();
    data.append('file', { uri: imageUri, type: 'image/jpeg', name: 'profile.jpg' } as any);
    data.append('upload_preset', 'mobile_chat_app'); 
    data.append('cloud_name', 'dl6lehqc3'); 
    try {
      let res = await fetch('https://api.cloudinary.com/v1_1/dl6lehqc3/image/upload', { method: 'POST', body: data });
      let responseData = await res.json();
      if (responseData.secure_url) {
        setPhotoURL(responseData.secure_url); 
        Alert.alert("نجاح", "تم تحميل الصورة بنجاح.");
      }
    } catch (error) {
      Alert.alert("خطأ", "مشكلة في سيرفر الصور.");
    } finally { setUploading(false); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('خطأ', 'نحتاج صلاحية الوصول للصور.'); return; }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!result.canceled) { uploadToCloudinary(result.assets[0].uri); }
  };

  const handleUpdate = async () => {
    try {
      if (!auth.currentUser) return;
      setLoading(true);

      if (newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
      }

      if (newPassword.length > 0) {
        if (newPassword.length < 6) {
          Alert.alert("خطأ", "كلمة السر لازم تكون 6 حروف على الأقل.");
          setLoading(false);
          return;
        }
        await updatePassword(auth.currentUser, newPassword);
      }

      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        username: newName,
        birthDate: birthDate,
        city: city,
        governorate: governorate,
        photoURL: photoURL
      });

      Alert.alert("تم", "تم تحديث بروفايلك بنجاح!");
      setNewPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        Alert.alert("أمن", "العملية هذي تتطلب إنك تعاود تسجل دخولك للأمان قبل تغيير الإيميل أو المودباس.");
      } else {
        Alert.alert("خطأ", "فشل في حفظ البيانات.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- الإصلاح الجوهري هنا ---
  const handleSignOut = async () => {
    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد أنك تريد الخروج؟",
      [
        { text: "إلغاء", style: "cancel" },
        { 
          text: "خروج", 
          style: "destructive",
          onPress: async () => {
            try {
              // بما إنك تستعمل Conditional Rendering في index.tsx
              // الـ signOut وحدها كافية باش ترجعك للـ Login أوتوماتيكياً
              await signOut(auth); 
              // ملاحظة: الـ index.tsx سيفهم أن user أصبح null وسيبدل الـ Stack تلقائياً
            } catch (error) { 
              console.error("Logout Error:", error); 
              Alert.alert("خطأ", "تعذر تسجيل الخروج.");
            }
          } 
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={uploading}>
          <View style={styles.cameraIcon}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={18} color="#fff" />}
          </View>
          <View style={styles.bigAvatar}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarLetter}>{userData?.username?.[0]?.toUpperCase() || '?'}</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.emailText}>{auth.currentUser?.email}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>الاسم المستعار:</Text>
        <TextInput style={styles.input} value={newName} onChangeText={setNewName} placeholder="مثال: حمزة" placeholderTextColor="#999" />
        <Text style={styles.label}>البريد الإلكتروني:</Text>
        <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" placeholderTextColor="#999" />
        <Text style={styles.label}>كلمة السر الجديدة (اختياري):</Text>
        <View style={styles.passwordContainer}>
          <TextInput style={styles.passwordInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} placeholder="اكتب كلمة سر جديدة..." placeholderTextColor="#999" />
          <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="#888" />
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>الولاية (Gouvernorat):</Text>
        <TextInput style={styles.input} value={governorate} onChangeText={setGovernorate} placeholder="تونس، نابل..." placeholderTextColor="#999" />
        <Text style={styles.label}>المدينة (Ville):</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="المرسى، قليبية..." placeholderTextColor="#999" />
        <Text style={styles.label}>تاريخ الميلاد:</Text>
        <TextInput style={styles.input} value={birthDate} onChangeText={setBirthDate} placeholder="01/01/1995" placeholderTextColor="#999" />
        <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={loading || uploading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>حفظ التغييرات</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  profileHeader: { alignItems: 'center', marginTop: 50, marginBottom: 20 },
  avatarContainer: { position: 'relative' },
  bigAvatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#f0f0f0' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarLetter: { fontSize: 50, color: '#fff', fontWeight: 'bold' },
  cameraIcon: { position: 'absolute', bottom: 5, right: 5, zIndex: 2, backgroundColor: '#333', borderRadius: 20, padding: 8, borderWidth: 2, borderColor: '#fff' },
  emailText: { marginTop: 10, color: '#888', fontSize: 14 },
  form: { marginBottom: 30 },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 15, marginBottom: 20, backgroundColor: '#f9f9f9', color: '#000' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee', borderRadius: 12, backgroundColor: '#f9f9f9', marginBottom: 20 },
  passwordInput: { flex: 1, padding: 15, color: '#000' },
  eyeIcon: { padding: 10 },
  saveBtn: { backgroundColor: '#28a745', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#ff4444', padding: 18, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 50 },
  logoutBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 }
});