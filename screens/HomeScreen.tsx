import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications'; // تأكد إنك صبيت المكتبة
import { arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Keyboard, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function HomeScreen({ navigation }: any) {
  const [myData, setMyData] = useState<any>(null);
  const [friendsList, setFriendsList] = useState<any[]>([]); 
  const [unreadMessages, setUnreadMessages] = useState<any>({});
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const registerForPushNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { pushToken: token });
      }
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    registerForPushNotifications();

    let unsubFriends: (() => void) | undefined;
    const chatListeners: (() => void)[] = [];

    const unsubMe = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyData(data);
        const friendsIds = data.friends || [];
        if (friendsIds.length > 0) {
          const q = query(collection(db, "users"), where("__name__", "in", friendsIds));
          if (unsubFriends) unsubFriends();
          unsubFriends = onSnapshot(q, (querySnapshot) => {
            const friends = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setFriendsList(friends);
            setLoading(false);
            friends.forEach(friend => {
              const chatId = [auth.currentUser!.uid, friend.uid].sort().join('_');
              const msgQuery = query(collection(db, "chats", chatId, "messages"), where("seen", "==", false), where("senderId", "==", friend.uid));
              const unsubChat = onSnapshot(msgQuery, (snap) => {
                setUnreadMessages((prev: any) => ({ ...prev, [friend.uid]: snap.size > 0 }));
              });
              chatListeners.push(unsubChat);
            });
          });
        } else { setFriendsList([]); setLoading(false); }
      }
    });
    return () => { if (unsubMe) unsubMe(); if (unsubFriends) unsubFriends(); chatListeners.forEach(unsub => unsub()); };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (auth.currentUser) {
        const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (docSnap.exists()) setMyData(docSnap.data());
      }
    } catch (error) { console.error(error); } finally { setRefreshing(false); }
  }, []);

  const filteredFriends = useMemo(() => {
    return friendsList.filter(friend => friend.username?.toLowerCase().includes(searchText.toLowerCase()));
  }, [searchText, friendsList]);

  const sendFriendRequest = async () => {
    try {
      const q = query(collection(db, "users"), where("username", "==", searchText.trim()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) { Alert.alert("تنبيه", "المستخدم هذا مش موجود."); return; }

      const friendDoc = querySnapshot.docs[0];
      const friendId = friendDoc.id;
      const friendData = friendDoc.data();

      if (friendId === auth.currentUser?.uid) { Alert.alert("تنبيه", "راك تلوج على روحك!"); return; }

      await setDoc(doc(db, "users", friendId), {
        friendRequests: arrayUnion({ 
          fromId: auth.currentUser!.uid, 
          fromUsername: myData?.username || "مستخدم", 
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      }, { merge: true });

      if (friendData.pushToken) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: friendData.pushToken,
            title: 'طلب صداقة جديد 👤',
            body: `${myData?.username} بعثلك طلب صداقة.`,
            data: { screen: 'Notifications' },
          }),
        });
      }
      Alert.alert("تم بنجاح", "بعثنا طلب صداقة!");
      setSearchText('');
    } catch (e: any) { Alert.alert("خطأ", "فشل السيرفر."); }
  };

  const handleAction = async () => {
    if (!searchText.trim()) return;
    Keyboard.dismiss();
    const existingFriend = friendsList.find(f => f.username?.toLowerCase() === searchText.trim().toLowerCase());
    if (existingFriend) {
      navigation.navigate('Chat', { friendId: existingFriend.uid, friendName: existingFriend.username, friendPhoto: existingFriend.photoURL });
      setSearchText('');
    } else { await sendFriendRequest(); }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#007AFF" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>مرحبا بيك، {myData?.username} 👋</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications', { requests: myData?.friendRequests || [], myId: auth.currentUser?.uid })}>
            <Ionicons name="notifications-outline" size={26} color="#000" />
            {myData?.friendRequests?.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-circle-outline" size={30} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.searchSection}>
        <View style={styles.inputWrapper}>
          <Ionicons name="search" size={20} color="#999" style={{marginLeft: 10}} />
          <TextInput style={styles.input} placeholder="لوّج على صاحبك و أكتب اسمو..." placeholderTextColor="#999" value={searchText} onChangeText={setSearchText} autoCapitalize="none" />
        </View>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: searchText.trim() ? (friendsList.some(f => f.username?.toLowerCase() === searchText.toLowerCase()) ? '#34C759' : '#007AFF') : '#ccc' }]} onPress={handleAction} disabled={!searchText.trim()}>
          <Ionicons name={friendsList.some(f => f.username?.toLowerCase() === searchText.toLowerCase()) ? "chatbubbles" : "person-add"} size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.uid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#007AFF']} />}
        renderItem={({ item }) => {
          const hasUnread = unreadMessages[item.uid];
          return (
            <TouchableOpacity style={[styles.friendCard, hasUnread && styles.unreadCard]} onPress={() => navigation.navigate('Chat', { friendId: item.uid, friendName: item.username, friendPhoto: item.photoURL })}>
              <View style={styles.avatar}>
                {item.photoURL ? <Image source={{ uri: item.photoURL }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{item.username?.[0].toUpperCase()}</Text>}
                {hasUnread && <View style={styles.onlineBadge} />} 
              </View>
              <View style={{flex: 1}}>
                <Text style={[styles.friendName, hasUnread && styles.unreadText]}>{item.username}</Text>
                <Text style={[styles.lastMsg, hasUnread && styles.unreadSubText]}>{hasUnread ? "📩 ميساج جديد وصلك!" : ".. ابعث مساج و حرّك الجو"}</Text> 
              </View>
              <Ionicons name="chevron-forward" size={20} color={hasUnread ? "#007AFF" : "#ccc"} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>{searchText ? "لا يوجد مستخدم بهذا الاسم." : "ماعندك حتى صديق توّة."}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  welcome: { fontSize: 20, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginLeft: 15 },
  badge: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, backgroundColor: 'red', borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  searchSection: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f2', borderRadius: 12, paddingRight: 5 },
  input: { flex: 1, padding: 12, fontSize: 16, color: '#000' },
  actionBtn: { width: 50, height: 50, borderRadius: 12, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  friendCard: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  unreadCard: { borderColor: '#007AFF', backgroundColor: '#F0F7FF', borderWidth: 1.5 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 25 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, backgroundColor: '#007AFF', borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  friendName: { fontSize: 16, fontWeight: 'bold' },
  unreadText: { color: '#007AFF' },
  lastMsg: { fontSize: 12, color: '#666' },
  unreadSubText: { color: '#007AFF', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 }
});