import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import React from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

export default function NotificationsScreen({ navigation, route }: any) {
  const { requests = [], myId = "" } = route?.params || {};

  const acceptFriend = async (request: any) => {
    if (!myId || !request.fromId) return;
    try {
      const batch = writeBatch(db);
      const myDocRef = doc(db, "users", myId);
      const friendDocRef = doc(db, "users", request.fromId);

      batch.update(myDocRef, {
        friends: arrayUnion(request.fromId),
        friendRequests: arrayRemove(request) 
      });

      batch.update(friendDocRef, {
        friends: arrayUnion(myId)
      });

      await batch.commit();

      // إرسال نوتيفيكاسيون للي بعث الطلب إنو تقبل
      const friendSnap = await getDoc(friendDocRef);
      const token = friendSnap.data()?.pushToken;
      if (token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: token,
            title: 'تم قبول طلب الصداقة! ✅',
            body: `وافق أحدهم على طلبك، تنجموا تحكيو توا.`,
          }),
        });
      }

      Alert.alert("مبروك", "وليتوا أصحاب توّة!");
      navigation.goBack();
    } catch (e) {
      Alert.alert("خطأ", "فشل قبول الطلب.");
    }
  };

  const declineRequest = async (request: any) => {
    if (!myId) return;
    try {
      await updateDoc(doc(db, "users", myId), {
        friendRequests: arrayRemove(request)
      });
      Alert.alert("تم", "تم حذف الطلب.");
    } catch (e) {
      Alert.alert("خطأ", "فشل حذف الطلب.");
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={26} color="#000" />
      </TouchableOpacity>
      
      <Text style={styles.title}>طلبات الصداقة ✉️</Text>
      
      <FlatList
        data={requests}
        keyExtractor={(item, index) => item.fromId || index.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.username}>{item.fromUsername || "مستخدم"}</Text>
              <Text style={styles.subText}>بعثلك طلب صداقة</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={() => acceptFriend(item)}>
                <Ionicons name="checkmark" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={() => declineRequest(item)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>ما عندك حتى طلب توّة.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', paddingTop: 50 },
  backBtn: { marginBottom: 15 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#f9f9f9', borderRadius: 12, marginBottom: 10 },
  username: { fontSize: 16, fontWeight: 'bold' },
  subText: { fontSize: 13, color: '#666' },
  actions: { flexDirection: 'row' },
  btn: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  acceptBtn: { backgroundColor: '#34C759' },
  declineBtn: { backgroundColor: '#FF3B30' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});