import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function ChatScreen({ route }: any) {
  const { friendId, friendName, friendPhoto } = route.params; 
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [friendPushToken, setFriendPushToken] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<any>(null);

  const CLOUD_NAME = 'dl6lehqc3';
  const UPLOAD_PRESET = 'mobile_chat_app';
  const chatId = [auth.currentUser!.uid, friendId].sort().join('_');

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchFriendData = async () => {
      const docSnap = await getDoc(doc(db, "users", friendId));
      if (docSnap.exists()) {
        setFriendPushToken(docSnap.data().pushToken);
      }
    };
    fetchFriendData();

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"));
    
    // زدت الـ Error callback هنا لمنع الـ Permission Denied
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      snapshot.docs.forEach(async (document) => {
        const data = document.data();
        if (data.senderId === friendId && data.seen === false) {
          await updateDoc(doc(db, "chats", chatId, "messages", document.id), { seen: true });
        }
      });
    }, (error) => {
      console.log("Chat listener stopped safely");
    });

    return () => {
      unsubscribe();
      // نوقفوا الصوت إذا خرجنا من الـ Chat
      if (soundInstance) {
        soundInstance.unloadAsync();
      }
    };
  }, [chatId]);

  const sendPushNotification = async (targetToken: string, title: string, body: string, data: any) => {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: targetToken, sound: 'default', title, body, data }),
      });
    } catch (error) { console.error("❌ Notification Error:", error); }
  };

  const sendMsg = async (content: string, type: string, duration?: string) => {
    if (!auth.currentUser) return; // حماية إضافية
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: auth.currentUser.uid, // ديما استعمل الـ Auth UID مباشرة للسيكوريتي
        receiverId: friendId,
        createdAt: serverTimestamp(),
        type,
        [type === 'text' ? 'text' : 'mediaUrl']: content,
        duration: duration || null,
        seen: false
      });

      if (friendPushToken) {
        const myName = auth.currentUser?.email?.split('@')[0] || "صديقك";
        const msgPreview = type === 'vocal' ? "🎤 رسالة صوتية" : type === 'image' ? "📷 صورة" : content;
        await sendPushNotification(friendPushToken, myName, msgPreview, { type: 'MESSAGE', friendId: auth.currentUser.uid });
      }
    } catch (err) { console.error("🔥 Send Message Error:", err); }
    setText('');
  };

  // ... (بقية الدوال: playVocal, startRecording, stopAndSendVocal, uploadMedia, getVocalDisplayTime تقعد هي بيدها)

  const playVocal = async (uri: string, id: string) => {
    try {
      if (soundInstance) await soundInstance.unloadAsync();
      setPlayingId(id);
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, (s) => {
        if (s.isLoaded) { setPlaybackStatus(s); if (s.didJustFinish) setPlayingId(null); }
      });
      setSoundInstance(sound);
    } catch (e) { console.error(e); }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording); setIsRecording(true); setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (err) { console.error(err); }
  };

  const stopAndSendVocal = async () => {
    try {
      if (!recording) return;
      clearInterval(timerRef.current); setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        const url = await uploadMedia(uri, 'vocal');
        if (url) await sendMsg(url, 'vocal', `${Math.floor(seconds/60)}:${seconds%60 < 10 ? '0' : ''}${seconds%60}`);
      }
      setRecording(null);
    } catch (error) { console.error(error); }
  };

  const uploadMedia = async (uri: string, type: string) => {
    setLoading(true);
    try {
      const data = new FormData();
      // @ts-ignore
      data.append('file', { uri, name: type === 'image' ? 'p.jpg' : 'v.m4a', type: type === 'image' ? 'image/jpeg' : 'audio/m4a' });
      data.append('upload_preset', UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: data });
      const json = await res.json();
      return json.secure_url;
    } catch (e) { return null; } finally { setLoading(false); }
  };

  const getVocalDisplayTime = (item: any, isPlaying: boolean) => {
    if (!isPlaying || !playbackStatus) return item.duration;
    const timeLeft = (playbackStatus.durationMillis - playbackStatus.positionMillis) / 1000;
    const mins = Math.floor(timeLeft / 60); const secs = Math.floor(timeLeft % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          {selectedImg && <Image source={{ uri: selectedImg }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}>
        
        <View style={styles.header}>
            <View style={styles.headerContent}>
                <View style={styles.userInfo}>
                    <Image 
                        source={{ 
                            uri: friendPhoto && friendPhoto.startsWith('http') 
                                ? friendPhoto 
                                : `https://ui-avatars.com/api/?name=${friendName}&background=007AFF&color=fff` 
                        }} 
                        style={styles.avatar} 
                    />
                    <Text style={styles.headerTitle} numberOfLines={1}>{friendName}</Text>
                </View>

                <View style={styles.headerIcons}>
                    <TouchableOpacity onPress={() => console.log("Appel Audio")} style={styles.iconBtn}>
                        <Ionicons name="call" size={22} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => console.log("Appel Vidéo")} style={styles.iconBtn}>
                        <Ionicons name="videocam" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => console.log("View Profile")} style={styles.iconBtn}>
                        <Ionicons name="information-circle" size={26} color="#007AFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        <FlatList
          data={messages} inverted keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMine = item.senderId === auth.currentUser?.uid;
            const isPlaying = playingId === item.id;
            const progress = isPlaying && playbackStatus ? (playbackStatus.positionMillis / playbackStatus.durationMillis) * 100 : 0;
            return (
              <View style={[styles.bubble, isMine ? styles.myMsg : styles.theirMsg]}>
                {item.type === 'vocal' ? (
                  <View style={styles.vocalContainer}>
                    <TouchableOpacity onPress={() => playVocal(item.mediaUrl, item.id)}>
                        <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={35} color={isMine ? "#fff" : "#007AFF"} />
                    </TouchableOpacity>
                    <View style={styles.progressWrapper}>
                        <View style={[styles.progressBarBase, { backgroundColor: isMine ? 'rgba(255,255,255,0.3)' : '#ccc' }]} />
                        <View style={[styles.progressBarActive, { width: `${progress}%`, backgroundColor: isMine ? '#fff' : '#007AFF' }]} />
                    </View>
                    <Text style={{fontSize: 10, color: isMine ? '#fff' : '#666', marginLeft: 5, width: 35}}>{getVocalDisplayTime(item, isPlaying)}</Text>
                  </View>
                ) : item.type === 'image' ? (
                  <TouchableOpacity onPress={() => { setSelectedImg(item.mediaUrl); setModalVisible(true); }}>
                    <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
                  </TouchableOpacity>
                ) : <Text style={{ color: isMine ? '#fff' : '#000', fontSize: 16 }}>{item.text}</Text>}
                <View style={{ flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', marginTop: 2 }}>
                  <Text style={[styles.timeTxt, { color: isMine ? '#d1d1d1' : '#888' }]}>{item.createdAt?.toDate?.().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || ""}</Text>
                  {isMine && <Ionicons name="checkmark-done" size={14} color={item.seen ? "#4fc3f7" : "#d1d1d1"} style={{ marginLeft: 3 }} />}
                </View>
              </View>
            );
          }}
        />

        {loading && <ActivityIndicator size="small" color="#007AFF" style={{ marginBottom: 5 }} />}

        <View style={styles.inputArea}>
          <TouchableOpacity onPress={() => ImagePicker.launchImageLibraryAsync({ quality: 0.5 }).then(res => { if (!res.canceled) uploadMedia(res.assets[0].uri, 'image').then(url => url && sendMsg(url, 'image')) })}>
            <Ionicons name="images-outline" size={28} color="#007AFF" />
          </TouchableOpacity>
          {!isRecording && <TouchableOpacity onPress={startRecording} style={{ marginLeft: 10 }}><Ionicons name="mic-outline" size={28} color="#007AFF" /></TouchableOpacity>}
          {isRecording ? 
            <Text style={{color: 'red', flex: 1, textAlign: 'center'}}>قاعد نسجل... {seconds}s</Text> : 
            <View style={styles.inputWrapper}><TextInput style={styles.input} placeholder="أكتب ميساجك..." value={text} onChangeText={setText} multiline /></View>
          }
          <TouchableOpacity onPress={() => isRecording ? stopAndSendVocal() : (text.trim() && sendMsg(text, 'text'))}>
            <Ionicons name="send" size={32} color={isRecording || text.trim() ? "#007AFF" : "#ccc"} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ... styles تقعد هي بيدها
const styles = StyleSheet.create({
  header: { paddingHorizontal: 15, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: '#eee', backgroundColor: '#fff' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, marginRight: 10, backgroundColor: '#f0f0f0' },
  headerTitle: { fontWeight: 'bold', fontSize: 17, maxWidth: width * 0.4 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginLeft: 18 },
  bubble: { padding: 10, borderRadius: 18, marginVertical: 4, marginHorizontal: 12, maxWidth: '80%' },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#0084ff' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  vocalContainer: { flexDirection: 'row', alignItems: 'center', width: 210 },
  progressWrapper: { flex: 1, marginLeft: 10, justifyContent: 'center', height: 20 },
  progressBarBase: { height: 3, width: '100%', borderRadius: 2, position: 'absolute' },
  progressBarActive: { height: 3, borderRadius: 2, position: 'absolute' },
  timeTxt: { fontSize: 9, marginTop: 2 },
  messageImage: { width: 220, height: 220, borderRadius: 15 },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 0.5, borderColor: '#eee', paddingBottom: Platform.OS === 'ios' ? 30 : 10 },
  inputWrapper: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, marginHorizontal: 5 },
  input: { paddingVertical: 8, maxHeight: 100, textAlign: 'right' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: width, height: height * 0.8 },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 1 }
});