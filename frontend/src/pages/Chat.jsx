import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API, { autoConnect: true });

export default function Chat() {
  const user = JSON.parse(localStorage.getItem('user'));
  const [videoFilter, setVideoFilter] = useState('none');
  
  const [users, setUsers] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
  }, []);
  
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    
    axios.get(`${API}/api/users`).then(res => {
      const otherUsers = res.data.filter(u => u.id !== user.id);
      setUsers(otherUsers);
      
      if (!activeChatId && otherUsers.length > 0) {
        if (user.role === 'admin') {
          setActiveChatId(otherUsers[0].id);
        } else {
          const admin = otherUsers.find(u => u.role === 'admin');
          if (admin) setActiveChatId(admin.id);
        }
      }
    }).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!activeChatId || !user) return;

    axios.get(`${API}/api/messages/${user.id}/${activeChatId}`)
      .then(res => setMessages(res.data))
      .catch(console.error);

    socket.on('receive_message', (message) => {
      if (
        (message.sender_id === user.id && message.receiver_id === activeChatId) ||
        (message.sender_id === activeChatId && message.receiver_id === user.id)
      ) {
        setMessages(prev => [...prev, message]);
        
        if (message.sender_id !== user.id && audioRef.current) {
          audioRef.current.play().catch(e => console.log("Audio play failed:", e));
        }
      }
    });

    socket.on('user_typing', (data) => {
      if (data.senderId === activeChatId) {
        setTypingUser(data.name);
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 1500);
      }
    });

    return () => {
      socket.off('receive_message');
      socket.off('user_typing');
    };
  }, [activeChatId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeChatId) return;

    socket.emit('send_message', {
      senderId: user.id,
      receiverId: activeChatId,
      content: newMessage
    });
    
    setNewMessage('');
    setShowEmojiPicker(false);
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (user && activeChatId) {
      socket.emit('typing', { senderId: user.id, name: user.name });
    }
  };

  const uploadFileToCloud = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/api/upload`, formData);
      const fileUrl = res.data.fileUrl;
      
      socket.emit('send_message', {
        senderId: user.id,
        receiverId: activeChatId,
        content: fileUrl
      });
    } catch (err) {
      alert('Failed to upload file');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) uploadFileToCloud(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
        await uploadFileToCloud(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  if (!user) return <div className="text-white text-center mt-10">Please log in.</div>;

  const activeChatUser = users.find(u => u.id === activeChatId);

  return (
    <div className="h-screen flex bg-slate-900 text-white font-sans relative">
      
      {/* SIDEBAR */}
      <div className="w-1/3 max-w-sm bg-slate-800 border-r border-slate-700 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <h2 className="text-xl font-bold">Inbox</h2>
          <p className="text-sm text-slate-400">Logged in as {user.name}</p>
          <button onClick={() => { localStorage.clear(); window.location.href = '/'; }} className="text-red-400 text-sm mt-2 hover:underline">Logout</button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {users.map(u => (
            <div 
              key={u.id} 
              onClick={() => setActiveChatId(u.id)}
              className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700 transition ${activeChatId === u.id ? 'bg-slate-700 border-l-4 border-l-blue-500' : ''}`}
            >
              <h3 className="font-semibold">{u.name}</h3>
              <p className="text-xs text-slate-400">{u.role.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT WINDOW */}
      <div className="flex-1 flex flex-col bg-slate-900 w-full">
        {activeChatId ? (
          <>
            <header className="p-4 bg-slate-800 border-b border-slate-700 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <h2 className="font-bold text-lg">{activeChatUser?.name}</h2>
              </div>
              
              <button 
                onClick={() => setInCall(true)} 
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition"
              >
                📹 Start Video Call
              </button>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, index) => {
                const isImage = msg.content.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
                const isVideo = msg.content.match(/\.(mp4|webm|ogg|mov)$/i) != null;
                const isAudio = msg.content.match(/\.(mp3|wav|ogg|m4a|webm)$/i) != null;

                return (
                  <div key={index} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-2xl shadow ${msg.sender_id === user.id ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-100 rounded-bl-none'}`}>
                      
                      {isImage && <img src={msg.content} alt="attachment" className="max-w-full rounded-lg" />}
                      
                      {isVideo && (
                        <video controls className="max-w-full rounded-lg">
                          <source src={msg.content} />
                        </video>
                      )}
                      
                      {isAudio && (
                        <audio controls className="w-full mt-2">
                          <source src={msg.content} />
                        </audio>
                      )}

                      {!isImage && !isVideo && !isAudio && msg.content}
                      
                    </div>
                  </div>
                );
              })}
              {isTyping && <div className="text-sm text-slate-400 italic">{typingUser} is typing...</div>}
              <div ref={bottomRef} />
            </main>

            {showEmojiPicker && (
              <div className="absolute bottom-24 right-10 z-50">
                <EmojiPicker onEmojiClick={(emojiData) => setNewMessage(prev => prev + emojiData.emoji)} />
              </div>
            )}

            <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2 relative items-center">
              
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-2xl hover:scale-110 transition">😀</button>
              
              <label className="text-2xl cursor-pointer hover:scale-110 transition">
                📎
                <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleFileUpload} />
              </label>

              <button 
                type="button" 
                onClick={isRecording ? stopRecording : startRecording} 
                className={`text-2xl transition ${isRecording ? 'animate-pulse text-red-500' : 'hover:scale-110'}`}
                title={isRecording ? "Stop Recording" : "Record Voice Note"}
              >
                {isRecording ? '🛑' : '🎤'}
              </button>

              <input 
                type="text" 
                value={newMessage}
                onChange={handleTyping}
                placeholder={isRecording ? "Recording audio..." : "Type a message..."} 
                disabled={isRecording}
                className={`flex-1 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRecording ? 'bg-red-900/50 text-red-200' : 'bg-slate-700'}`}
              />
              
              <button 
                disabled={isRecording}
                className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xl">
            Select a user to start chatting
          </div>
        )}
      </div>

      {/* VIDEO CALL SCREEN WITH FILTERS */}
      {inCall && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="bg-slate-800 p-4 flex justify-between items-center">
            <h2 className="text-white font-bold text-xl">Video Call in Progress</h2>
            
            {/* Filter Buttons */}
            <div className="flex gap-2">
              <button onClick={() => setVideoFilter('none')} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded transition">Normal</button>
              <button onClick={() => setVideoFilter('grayscale(100%)')} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded transition">B&W</button>
              <button onClick={() => setVideoFilter('sepia(100%)')} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded transition">Sepia</button>
              <button onClick={() => setVideoFilter('blur(5px)')} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded transition">Blur</button>
            </div>

            <button 
              onClick={() => setInCall(false)} 
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold"
            >
              Leave Call
            </button>
          </div>
          
          <iframe 
            src={`https://meet.jit.si/chat-room-${user.id}-${activeChatId}`} 
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="flex-1 w-full border-none"
            style={{ filter: videoFilter }}
          ></iframe>
        </div>
      )}
    </div>
  );
}