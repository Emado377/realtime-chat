import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API, { autoConnect: true });

export default function Chat() {
  const user = JSON.parse(localStorage.getItem('user'));
  
  const [users, setUsers] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  
  const bottomRef = useRef(null);

  // 1. Fetch Users (For the Admin Sidebar)
  useEffect(() => {
    if (!user) return;
    
    axios.get(`${API}/api/users`).then(res => {
      const otherUsers = res.data.filter(u => u.id !== user.id);
      setUsers(otherUsers);
      
      // Auto-select the first user if you are an Admin
      if (user.role === 'admin' && otherUsers.length > 0 && !activeChatId) {
        setActiveChatId(otherUsers[0].id);
      }
    }).catch(console.error);
  }, [user]);

  // 2. Auto-select Admin for Customer
  useEffect(() => {
    if (user?.role === 'customer' && !activeChatId) {
      const admin = users.find(u => u.role === 'admin');
      if (admin) setActiveChatId(admin.id);
    }
  }, [users, user, activeChatId]);

  // 3. Fetch Messages when a chat is selected
  useEffect(() => {
    if (!activeChatId || !user) return;

    axios.get(`${API}/api/messages/${user.id}/${activeChatId}`)
      .then(res => setMessages(res.data))
      .catch(console.error);

    socket.on('receive_message', (message) => {
      // Only add message if it belongs to the current open chat
      if (
        (message.sender_id === user.id && message.receiver_id === activeChatId) ||
        (message.sender_id === activeChatId && message.receiver_id === user.id)
      ) {
        setMessages(prev => [...prev, message]);
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

  // Scroll to bottom
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
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (user && activeChatId) {
      socket.emit('typing', { senderId: user.id, name: user.name });
    }
  };

  if (!user) return <div className="text-white text-center mt-10">Please log in.</div>;

  const activeChatUser = users.find(u => u.id === activeChatId);

  return (
    <div className="h-screen flex bg-slate-900 text-white font-sans">
      
      {/* SIDEBAR (For Admin or Mobile View) */}
      <div className="w-1/3 max-w-sm bg-slate-800 border-r border-slate-700 flex flex-col">
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
      <div className="flex-1 flex flex-col bg-slate-900">
        {activeChatId ? (
          <>
            {/* Header */}
            <header className="p-4 bg-slate-800 border-b border-slate-700 shadow-sm flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <h2 className="font-bold text-lg">{activeChatUser?.name}</h2>
            </header>

            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] p-3 rounded-2xl shadow ${msg.sender_id === user.id ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-100 rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && <div className="text-sm text-slate-400 italic">{typingUser} is typing...</div>}
              <div ref={bottomRef} />
            </main>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-3">
              <input 
                type="text" 
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message..." 
                className="flex-1 p-3 bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition">Send</button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xl">
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  );
}