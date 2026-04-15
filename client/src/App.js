import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Settings from './Settings';
import StatusViewer from './StatusViewer';

const socket = io('https://whispera-api.onrender.com');
const API = 'https://whispera-api.onrender.com';
function timeStr(d) {
  return d
    ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function avatarColor(name) {
  const colors = [
    'linear-gradient(135deg,#b76e79,#a05a64)',
    'linear-gradient(135deg,#c9963a,#c4685a)',
    'linear-gradient(135deg,#6aab8e,#b76e79)',
    'linear-gradient(135deg,#b76e79,#a05a64)',
    'linear-gradient(135deg,#6aab8e,#b76e79)',
  ];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
}

function Avatar({ name, src, size = 38, style = {} }) {
  if (src && src.length > 0) {
    return (
      <img
        src={src}
        alt="pfp"
        className="avatar-wrap"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
      />
    );
  }
  return (
    <div
      className="avatar-wrap"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: avatarColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.4, color: '#fff', flexShrink: 0,
        ...style,
      }}
    >
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: '#f0e6de', borderRadius: '18px 18px 18px 4px', width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#b76e79' }} />
      ))}
    </div>
  );
}

function OnlineDot() {
  return <span className="online-dot" style={{ marginRight: 4 }} />;
}

// Floating particle for auth background
function Particles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: Math.random() * 6 + 3,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 4,
    duration: Math.random() * 4 + 4,
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `rgba(${Math.random() > 0.5 ? '183,110,121' : '160,90,100'},0.25)`,
            animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}


export default function App() {
  const [screen, setScreen] = useState('loading');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [msgSearch, setMsgSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [chats, setChats] = useState({});
  const [msg, setMsg] = useState('');
  const [smartReplies, setSmartReplies] = useState([]);
  const [warning, setWarning] = useState('');
  const [tab, setTab] = useState('chats');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [notification, setNotification] = useState('');
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [unread, setUnread] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiFor, setShowEmojiFor] = useState(null);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [msgContextMenu, setMsgContextMenu] = useState(null);
  const [blockedList, setBlockedList] = useState([]);
  const [showStatus, setShowStatus] = useState(false);
  const [friendDetails, setFriendDetails] = useState({});
  const [statuses, setStatuses] = useState([]);
  const [statusUploading, setStatusUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [viewingStatus, setViewingStatus] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);

  const fileInputRef = useRef(null);
  const statusFileRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentUserRef = useRef(null);
  const activeContactRef = useRef(null);
  const chatsRef = useRef({});
  const smartReplyRef = useRef([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { smartReplyRef.current = smartReplies; }, [smartReplies]);

  const authFetch = (url, opts = {}) =>
    fetch(API + url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedUser = localStorage.getItem('chat_user');
    if (savedToken && savedUser) {
      const user = JSON.parse(savedUser);
      setToken(savedToken);
      setCurrentUser(user);
      socket.emit('register-online', user.username);
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      fetch(API + '/friends', { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(r => r.json())
        .then(data => {
          setFriends(data.friends || []);
          setRequests(data.requests || []);
          const details = {};
          (data.friendDetails || []).forEach(f => { details[f.username] = f; });
          setFriendDetails(details);
          const savedTab = localStorage.getItem('chat_tab');
          if (savedTab) setTab(savedTab);
          setScreen('chat');
        })
        .catch(() => {
          localStorage.removeItem('chat_token');
          localStorage.removeItem('chat_user');
          setScreen('login');
        });
    } else {
      setScreen('login');
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeContact]);

  // All socket listeners
  useEffect(() => {
    socket.on('receiveMessage', (data) => {
      const me = currentUserRef.current?.username;
      const key = data.sender === me ? data.receiver : data.sender;
      setChats(prev => {
        const existing = prev[key] || [];
        if (existing.some(m => m._id && data._id && m._id.toString() === data._id.toString())) return prev;
        return { ...prev, [key]: [...existing, { ...data, time: timeStr(data.createdAt) }] };
      });
      if (data.sender !== me) {
        if (activeContactRef.current !== data.sender) {
          setUnread(prev => ({ ...prev, [data.sender]: (prev[data.sender] || 0) + 1 }));
        }
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`💬 ${data.sender}`, { body: data.text || '📎 Sent a file', icon: '/favicon.ico' });
        }
      }
    });

    socket.on('typing', ({ from }) => {
      setTypingUsers(prev => ({ ...prev, [from]: true }));
      setTimeout(() => setTypingUsers(prev => { const n = { ...prev }; delete n[from]; return n; }), 2500);
    });

    socket.on('smartReplies', (replies) => {
      setSmartReplies(replies);
      setTimeout(() => setSmartReplies([]), 15000);
    });

    socket.on('warning', (w) => { setWarning(w); setTimeout(() => setWarning(''), 4000); });
    socket.on('error', (e) => { setWarning(e); setTimeout(() => setWarning(''), 4000); });

    socket.on('friendRequest', ({ from }) => {
      setRequests(prev => prev.includes(from) ? prev : [...prev, from]);
      setNotification(`👋 ${from} sent you a friend request!`);
      setTimeout(() => setNotification(''), 4000);
      setTab('requests');
    });

    socket.on('requestAccepted', ({ by }) => {
      setFriends(prev => prev.includes(by) ? prev : [...prev, by]);
      setNotification(`✅ ${by} accepted your friend request!`);
      setTimeout(() => setNotification(''), 4000);
    });

    socket.on('userOnline', (username) => setOnlineFriends(prev => [...new Set([...prev, username])]));
    socket.on('userOffline', (username) => setOnlineFriends(prev => prev.filter(u => u !== username)));
    socket.on('onlineFriendsList', (list) => setOnlineFriends(list));

    socket.on('messagesSeen', ({ by, at }) => {
      setChats(prev => {
        const updated = { ...prev };
        if (updated[by]) {
          updated[by] = updated[by].map(m =>
            m.sender === currentUserRef.current?.username && !m.seenAt ? { ...m, seenAt: at } : m
          );
        }
        return updated;
      });
    });

    socket.on('messageReaction', ({ msgId, reactions }) => {
      setChats(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].map(m =>
            m._id?.toString() === msgId?.toString() ? { ...m, reactions } : m
          );
        }
        return updated;
      });
    });

    return () => {
      ['receiveMessage','typing','smartReplies','warning','error','friendRequest',
       'requestAccepted','userOnline','userOffline','onlineFriendsList','messageReaction','messagesSeen']
        .forEach(e => socket.off(e));
    };
  }, []);


  const loadFriends = async (tok) => {
    const t = tok || token;
    const res = await fetch(API + '/friends', { headers: { Authorization: `Bearer ${t}` } });
    const data = await res.json();
    setFriends(data.friends || []);
    setRequests(data.requests || []);
    const details = {};
    (data.friendDetails || []).forEach(f => { details[f.username] = f; });
    setFriendDetails(details);
    (data.friends || []).forEach(async (f) => {
      const r = await fetch(API + `/messages/${f}`, { headers: { Authorization: `Bearer ${t}` } });
      const msgs = await r.json();
      if (Array.isArray(msgs) && msgs.length > 0) {
        setChats(prev => ({ ...prev, [f]: msgs.map(m => ({ ...m, time: timeStr(m.createdAt) })) }));
      }
    });
  };

  const loadStatuses = async (tok) => {
    const t = tok || token;
    const res = await fetch(API + '/statuses', { headers: { Authorization: `Bearer ${t}` } });
    const data = await res.json();
    setStatuses(Array.isArray(data) ? data : []);
  };

  const postStatus = async (type, file) => {
    setStatusUploading(true);
    const fd = new FormData();
    fd.append('type', type);
    if (type === 'text') fd.append('content', statusText);
    else fd.append('file', file);
    await fetch(API + '/status', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    setStatusUploading(false);
    setStatusText('');
    loadStatuses();
  };

  const loadHistory = async (username) => {
    if (!username) return;
    const res = await authFetch(`/messages/${username}`);
    const data = await res.json();
    if (Array.isArray(data))
      setChats(prev => ({ ...prev, [username]: data.map(m => ({ ...m, time: timeStr(m.createdAt) })) }));
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const endpoint = screen === 'login' ? '/login' : '/register';
    const body = screen === 'login' ? { email: form.email, password: form.password } : form;
    console.log("API:", API);
console.log("ENDPOINT:", endpoint);
console.log("FINAL:", `${API}${endpoint}`);
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log("FINAL URL:", `${API}${endpoint}`);
      const data = await res.json();
      setAuthLoading(false);
      if (!res.ok) { setAuthError(data.error || data.errors?.[0]?.msg || 'Something went wrong'); return; }
      if (screen === 'register') { setScreen('login'); setForm(f => ({ ...f, password: '' })); return; }
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      socket.emit('register-online', data.user.username);
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      await loadFriends(data.token);
      setScreen('chat');
    } catch {
      setAuthLoading(false);
      setAuthError('Server not reachable. Make sure backend is running.');
    }
  };

  const handleSearch = async (q) => {
    setSearchQ(q);
    if (!q.trim()) { setSearchResults([]); return; }
    const res = await authFetch(`/users/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(Array.isArray(data) ? data : []);
  };

  const sendRequest = async (username) => {
    await authFetch('/friends/request', { method: 'POST', body: JSON.stringify({ toUsername: username }) });
    setSentRequests(prev => [...prev, username]);
  };

  const acceptRequest = async (username) => {
    await authFetch('/friends/accept', { method: 'POST', body: JSON.stringify({ fromUsername: username }) });
    setRequests(prev => prev.filter(r => r !== username));
    setFriends(prev => [...prev, username]);
  };

  const rejectRequest = async (username) => {
    await authFetch('/friends/reject', { method: 'POST', body: JSON.stringify({ fromUsername: username }) });
    setRequests(prev => prev.filter(r => r !== username));
  };

  const openChat = async (username) => {
    setActiveContact(username);
    setTab('chats');
    setSmartReplies([]);
    setWarning('');
    setUnread(prev => ({ ...prev, [username]: 0 }));
    if (!chats[username]) await loadHistory(username);
    authFetch('/messages/seen', { method: 'POST', body: JSON.stringify({ senderUsername: username }) });
    fetch(API + '/user/' + username, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.username) setFriendDetails(prev => ({ ...prev, [username]: data })); });
  };

  const send = (text) => {
    const t = text || msg;
    if (!t.trim() || !activeContact) return;
    socket.emit('sendMessage', {
      sender: currentUser.username,
      receiver: activeContact,
      text: t,
      replyTo: replyingTo
        ? { _id: replyingTo._id, sender: replyingTo.sender, text: replyingTo.text, fileType: replyingTo.fileType }
        : null,
    });
    setMsg('');
    setSmartReplies([]);
    setReplyingTo(null);
    smartReplyRef.current = [];
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    // emit typing
    if (activeContact && currentUser) {
      socket.emit('typing', { from: currentUser.username, to: activeContact });
    }
  };

  const lastSeenStr = (username) => {
    if (onlineFriends.includes(username)) return null;
    const d = friendDetails[username];
    if (!d || !d.lastSeen) return 'Offline';
    const diff = Date.now() - new Date(d.lastSeen);
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (m < 1) return 'Last seen just now';
    if (h < 1) return `Last seen ${m}m ago`;
    if (days < 1) return `Last seen ${h}h ago`;
    return `Last seen ${days}d ago`;
  };

  const unfriend = async (username) => {
    await authFetch('/friends/unfriend', { method: 'POST', body: JSON.stringify({ username }) });
    setFriends(prev => prev.filter(f => f !== username));
    setActiveContact(null);
    setShowContactMenu(false);
  };

  const blockUser = async (username) => {
    await authFetch('/friends/block', { method: 'POST', body: JSON.stringify({ username }) });
    setFriends(prev => prev.filter(f => f !== username));
    setBlockedList(prev => [...prev, username]);
    setActiveContact(null);
    setShowContactMenu(false);
  };

  const reactToMsg = async (msgId, emoji) => {
    setShowEmojiFor(null);
    const res = await authFetch(`/messages/${msgId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) });
    const data = await res.json();
    if (data.reactions) {
      setChats(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].map(m =>
            m._id?.toString() === msgId?.toString() ? { ...m, reactions: data.reactions } : m
          );
        }
        return updated;
      });
    }
  };

  const sendFile = async (file) => {
    if (!file || !activeContact) return;
    setSendingFile(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(API + '/upload/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    setSendingFile(false);
    if (data.fileUrl) {
      socket.emit('sendMessage', {
        sender: currentUser.username,
        receiver: activeContact,
        text: '',
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileName: data.fileName,
      });
    }
  };

  const handleFocus = () => {
    if (smartReplyRef.current.length) return;
    const contact = activeContactRef.current;
    const me = currentUserRef.current?.username;
    if (!contact || !me) return;
    const msgs = chatsRef.current[contact] || [];
    if (!msgs.length) return;
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.sender === me) return;
    socket.emit('getSuggestion', { text: lastMsg.text, requester: me });
  };

  const handleLogout = () => {
    socket.emit('logout', currentUser?.username);
    socket.disconnect();
    socket.connect();
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    localStorage.removeItem('chat_tab');
    setScreen('login');
    setCurrentUser(null);
    setToken('');
    setChats({});
    setFriends([]);
    setRequests([]);
    setActiveContact(null);
    setSentRequests([]);
    setSmartReplies([]);
    setWarning('');
    setNotification('');
    setSearchQ('');
    setSearchResults([]);
    setTab('chats');
    setOnlineFriends([]);
    setForm({ username: '', email: '', password: '' });
  };

  const filteredMessages = (msgs) => {
    if (!msgSearch.trim()) return msgs;
    return msgs.filter(m => m.text?.toLowerCase().includes(msgSearch.toLowerCase()));
  };

  const activeMessages = filteredMessages(chats[activeContact] || []);

  const sentimentColor = (s) => {
    if (s === 'Positive 😊') return { bg: '#d4edda', color: '#6aab8e' };
    if (s === 'Negative 😡') return { bg: '#fde8e8', color: '#c4685a' };
    return { bg: '#dde8f5', color: '#d4a882' };
  };


  if (screen === 'loading') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'linear-gradient(135deg,#f7f0eb,#fdf8f5)', gap:16 }}>
      <div className="anim-float" style={{ fontSize:52 }}>✦</div>
      <div className="grad-text" style={{ fontSize:22, fontWeight:800, letterSpacing:1 }}>Whispera</div>
      <div style={{ width:36, height:36, border:'3px solid #d4b8a8', borderTop:'3px solid #b76e79', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  if (screen === 'login' || screen === 'register') return (
    <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100vh', background:'linear-gradient(135deg,#f7f0eb 0%,#fdf8f5 50%,#f7f0eb 100%)', padding:'0 16px', boxSizing:'border-box', overflow:'hidden' }}>
      <Particles />

      {/* Glow blobs */}
      <div style={{ position:'absolute', top:'15%', left:'10%', width:300, height:300, borderRadius:'50%', background:'rgba(183,110,121,0.07)', filter:'blur(60px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'20%', right:'8%', width:250, height:250, borderRadius:'50%', background:'rgba(160,90,100,0.07)', filter:'blur(50px)', pointerEvents:'none' }} />

      <div className="anim-scaleIn glass" style={{ borderRadius:20, padding:'36px 28px', width:'100%', maxWidth:420, boxShadow:'0 32px 80px rgba(0,0,0,0.6)', position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div className="anim-float" style={{ fontSize:44, marginBottom:8 }}>✦</div>
          <div className="grad-text" style={{ fontSize:28, fontWeight:800, letterSpacing:0.5 }}>Whispera</div>
          <div style={{ fontSize:13, color:'#a88070', marginTop:4 }}>
            {screen === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', background:'#fdf8f5', borderRadius:12, padding:4, marginBottom:24, border:'1px solid #e8d5c8' }}>
          {['login','register'].map(s => (
            <button
              key={s}
              className="tab-btn"
              onClick={() => { setScreen(s); setAuthError(''); }}
              style={{ flex:1, padding:'9px', border:'none', borderRadius:9, fontWeight:600, fontSize:13, cursor:'pointer', background: screen===s ? 'linear-gradient(135deg,#b76e79,#a05a64)' : 'transparent', color: screen===s ? '#fff' : '#a88070' }}
            >
              {s === 'login' ? '🔑 Sign In' : '✨ Register'}
            </button>
          ))}
        </div>

        {authError && (
          <div className="anim-fadeDown" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#fca5a5', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
            ⚠️ {authError}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {screen === 'register' && (
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>👤</span>
              <input
                className="input-glow"
                style={{ width:'100%', padding:'12px 14px 12px 38px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:11, color:'#2d1f1a', fontSize:14, boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s' }}
                placeholder="Username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
          )}

          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>📧</span>
            <input
              className="input-glow"
              style={{ width:'100%', padding:'12px 14px 12px 38px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:11, color:'#2d1f1a', fontSize:14, boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s' }}
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>🔒</span>
            <input
              className="input-glow"
              style={{ width:'100%', padding:'12px 42px 12px 38px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:11, color:'#2d1f1a', fontSize:14, boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s' }}
              type={showPass ? 'text' : 'password'}
              placeholder="Password (min 6 chars)"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#a88070' }}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={authLoading}
            style={{ padding:'13px', borderRadius:11, fontSize:15, fontWeight:700, marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            {authLoading
              ? <><div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> Processing...</>
              : screen === 'login' ? '✦ Sign In' : '✨ Create Account'
            }
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#a88070' }}>
          {screen === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            style={{ background:'none', border:'none', color:'#d4a882', cursor:'pointer', fontWeight:600, fontSize:13 }}
            onClick={() => { setScreen(screen === 'login' ? 'register' : 'login'); setAuthError(''); }}
          >
            {screen === 'login' ? 'Register' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );


  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden', background:'#f7f0eb', fontFamily:'Inter,sans-serif' }}>

      {/* Modals */}
      {showSettings && (
        <Settings
          currentUser={currentUser}
          token={token}
          onClose={() => setShowSettings(false)}
          onUpdate={(user, tok) => {
            setCurrentUser(user);
            setToken(tok);
            localStorage.setItem('chat_token', tok);
            localStorage.setItem('chat_user', JSON.stringify(user));
          }}
        />
      )}
      {showStatus && (
        <StatusViewer token={token} currentUser={currentUser} onClose={() => setShowStatus(false)} />
      )}

      {/* Status fullscreen viewer */}
      {viewingStatus && (
        <div className="anim-fadeIn" style={{ position:'fixed', inset:0, background:'#000', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ color:'#fff', fontSize:14, fontWeight:600 }}>
              {viewingStatus.username === currentUser?.username ? '👤 My Status' : viewingStatus.username}
            </div>
            <button onClick={() => setViewingStatus(null)} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', borderRadius:'50%', width:36, height:36 }}>✕</button>
          </div>
          <div style={{ width:'100%', padding:'0 20px', position:'absolute', top:60 }}>
            <div className="status-progress"><div className="status-progress-fill" /></div>
          </div>
          {viewingStatus.username === currentUser?.username && (
            <div style={{ position:'absolute', bottom:30, left:0, right:0, textAlign:'center' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.1)', padding:'8px 16px', borderRadius:20 }}>
                <span>👁️</span>
                <span style={{ color:'#fff', fontSize:13, fontWeight:600 }}>{viewingStatus.status.views?.length || 0} views</span>
                {viewingStatus.status.views?.length > 0 && (
                  <span style={{ color:'#7a5c52', fontSize:12 }}>({viewingStatus.status.views.join(', ')})</span>
                )}
              </div>
            </div>
          )}
          <div className="anim-scaleIn" style={{ maxWidth:500, width:'100%', textAlign:'center', padding:20 }}>
            {viewingStatus.status.type==='text' && <div style={{ fontSize:26, color:'#fff', fontWeight:600, lineHeight:1.5 }}>{viewingStatus.status.content}</div>}
            {viewingStatus.status.type==='image' && <img src={viewingStatus.status.fileUrl} alt="status" style={{ maxWidth:'100%', maxHeight:'70vh', borderRadius:12 }} />}
            {viewingStatus.status.type==='video' && <video src={viewingStatus.status.fileUrl} controls autoPlay style={{ maxWidth:'100%', maxHeight:'70vh', borderRadius:12 }} />}
            {viewingStatus.status.type==='audio' && <audio src={viewingStatus.status.fileUrl} controls autoPlay style={{ width:'100%' }} />}
          </div>
        </div>
      )}

      {/* Search overlay */}
      {tab==='search' && (
        <div className="anim-fadeIn" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:500, display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}
          onClick={() => { setTab('chats'); setSearchQ(''); setSearchResults([]); }}>
          <div className="anim-fadeUp glass" style={{ borderRadius:16, width: isMobile ? '92vw' : 420, maxHeight:'70vh', overflow:'hidden', display:'flex', flexDirection:'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8d5c8' }}>
              <input
                className="input-glow"
                style={{ width:'100%', padding:'10px 14px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:10, color:'#2d1f1a', fontSize:14, outline:'none', boxSizing:'border-box' }}
                placeholder="🔍 Search by username..." value={searchQ} onChange={e => handleSearch(e.target.value)} autoFocus
              />
            </div>
            <div style={{ overflowY:'auto', flex:1 }}>
              {searchQ && searchResults.length===0 && <div style={{ padding:'30px 16px', textAlign:'center', color:'#7a5c52', fontSize:13 }}>No users found</div>}
              {searchResults.map(u => (
                <div key={u._id} className="sidebar-item" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' }}>
                  <Avatar name={u.username} src={u.profilePic} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:500, color:'#7a5c52' }}>{u.username}</div>
                    <div style={{ fontSize:11, color:'#a88070', marginTop:2 }}>{friends.includes(u.username) ? '✅ Friends' : 'Send a request'}</div>
                  </div>
                  {!friends.includes(u.username) && (
                    <button
                      onClick={() => { if (!sentRequests.includes(u.username)) sendRequest(u.username); }}
                      style={{ padding:'5px 14px', background: sentRequests.includes(u.username) ? '#f0e6de' : 'linear-gradient(90deg,#b76e79,#a05a64)', border:'none', borderRadius:8, color: sentRequests.includes(u.username) ? '#a88070' : '#fff', fontSize:12, cursor: sentRequests.includes(u.username) ? 'default' : 'pointer', fontWeight:600, flexShrink:0 }}>
                      {sentRequests.includes(u.username) ? 'Sent ✓' : 'Add +'}
                    </button>
                  )}
                </div>
              ))}
              {!searchQ && <div style={{ padding:'30px 16px', textAlign:'center', color:'#7a5c52', fontSize:13 }}>Type a username to search</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <div className="anim-slideLeft" style={{ width: isMobile ? '100vw' : 300, minWidth: isMobile ? '100vw' : 300, height:'100vh', background:'#fdf8f5', borderRight:'1px solid #f0e6de', display: isMobile && activeContact ? 'none' : 'flex', flexDirection:'column', position: isMobile ? 'fixed' : 'relative', top:0, left:0, zIndex:10 }}>

        {/* Sidebar header */}
        <div style={{ padding: isMobile ? '14px 16px' : '20px 18px 14px', borderBottom:'1px solid #f0e6de', paddingTop: isMobile ? 'max(14px,env(safe-area-inset-top))' : '20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:22, color:'#b76e79', fontWeight:700 }}>✦</span>
              <span className="grad-text" style={{ fontSize:20, fontWeight:800, letterSpacing:0.5 }}>Whispera</span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              <button onClick={() => setTab('search')} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', padding:'6px', borderRadius:8, color:'#a88070', transition:'color 0.2s' }} title="Search">🔍</button>
              <button onClick={() => setShowSettings(true)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', padding:'6px', borderRadius:8, color:'#a88070', transition:'color 0.2s' }} title="Settings">⚙️</button>
            </div>
          </div>
          {/* Current user row */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12, padding:'8px 10px', background:'#fdf8f5', borderRadius:10, border:'1px solid #f0e6de' }}>
            <div style={{ position:'relative' }}>
              <Avatar name={currentUser?.username} src={currentUser?.profilePic} size={32} />
              <span style={{ position:'absolute', bottom:0, right:0, width:9, height:9, borderRadius:'50%', background:'#6aab8e', border:'2px solid #fdf8f5' }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#2d1f1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{currentUser?.username}</div>
              <div style={{ fontSize:11, color:'#6aab8e' }}>● Online</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', padding:'10px 12px', gap:6, borderBottom:'1px solid #f0e6de' }}>
          {[['chats','💬','Chats'],['status','📸','Status'],['requests','🔔','Requests']].map(([key, icon, label]) => (
            <button
              key={key}
              className="tab-btn"
              onClick={() => { setTab(key); localStorage.setItem('chat_tab', key); if (key==='status') loadStatuses(); }}
              style={{ flex:1, padding:'8px 4px', background: tab===key ? 'linear-gradient(135deg,#b76e79,#a05a64)' : '#fdf8f5', border:'1px solid '+(tab===key ? 'transparent' : '#e8d5c8'), borderRadius:9, color: tab===key ? '#fff' : '#a88070', fontSize:11, fontWeight:600, cursor:'pointer', position:'relative' }}
            >
              <span style={{ fontSize:14 }}>{icon}</span>
              <span style={{ display:'block', marginTop:1 }}>{label}</span>
              {key==='requests' && requests.length>0 && (
                <span className="anim-popIn" style={{ position:'absolute', top:-4, right:-4, background:'#c4685a', color:'#fff', fontSize:9, fontWeight:700, borderRadius:10, padding:'1px 5px', minWidth:16, textAlign:'center' }}>{requests.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* List area */}
        <div style={{ flex:1, overflowY:'auto' }}>

          {/* Chats tab */}
          {tab==='chats' && (
            friends.length===0
              ? (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'#7a5c52' }}>
                  <div className="anim-float" style={{ fontSize:40, marginBottom:12 }}>👥</div>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>No friends yet</div>
                  <div style={{ fontSize:12 }}>Search users to add friends!</div>
                </div>
              )
              : friends.map(f => (
                <div
                  key={f}
                  className="sidebar-item"
                  onClick={() => openChat(f)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', background: activeContact===f ? 'rgba(183,110,121,0.1)' : 'transparent', borderLeft: activeContact===f ? '3px solid #b76e79' : '3px solid transparent', transition:'all 0.15s' }}
                >
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <Avatar name={f} src={friendDetails[f]?.profilePic} size={40} />
                    {onlineFriends.includes(f) && (
                      <span style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:'#6aab8e', border:'2px solid #fdf8f5' }} />
                    )}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontSize:14, fontWeight:600, color:'#2d1f1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f}</div>
                      {chats[f]?.length > 0 && <span style={{ fontSize:10, color:'#7a5c52', flexShrink:0 }}>{chats[f][chats[f].length-1].time}</span>}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:2 }}>
                      <div style={{ fontSize:11, color: unread[f]>0 ? '#d4b8a8' : '#a88070', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
                        {typingUsers[f]
                          ? <span style={{ color:'#b76e79', fontStyle:'italic' }}>typing...</span>
                          : chats[f]?.length > 0
                            ? (chats[f][chats[f].length-1].fileType==='image' ? '📷 Photo'
                              : chats[f][chats[f].length-1].fileType==='video' ? '🎬 Video'
                              : chats[f][chats[f].length-1].fileType==='audio' ? '🎵 Audio'
                              : chats[f][chats[f].length-1].fileType==='file' ? '📎 File'
                              : chats[f][chats[f].length-1].text || '')
                            : onlineFriends.includes(f) ? '● Online' : 'Offline'}
                      </div>
                      {unread[f] > 0 && (
                        <span className="anim-popIn" style={{ background:'linear-gradient(135deg,#b76e79,#a05a64)', color:'#fff', fontSize:10, fontWeight:700, borderRadius:10, padding:'2px 7px', flexShrink:0 }}>{unread[f]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}

          {/* Status tab */}
          {tab==='status' && (
            <>
              <div style={{ padding:'12px 14px', borderBottom:'1px solid #f0e6de' }}>
                <div style={{ fontSize:11, color:'#a88070', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Post Status</div>
                <textarea
                  className="input-glow"
                  style={{ width:'100%', padding:'9px 12px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:10, color:'#2d1f1a', fontSize:13, outline:'none', resize:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box', marginBottom:8 }}
                  rows={2} placeholder="Write a status..." value={statusText} onChange={e => setStatusText(e.target.value)}
                />
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {statusText.trim() && (
                    <button onClick={() => postStatus('text')} className="btn-primary" style={{ padding:'6px 14px', borderRadius:8, fontSize:12 }}>
                      {statusUploading ? 'Posting...' : '✏️ Post'}
                    </button>
                  )}
                  <input ref={statusFileRef} type="file" style={{ display:'none' }} onChange={e => { const f=e.target.files[0]; if(!f) return; const t=f.type.startsWith('image')?'image':f.type.startsWith('video')?'video':'audio'; postStatus(t,f); e.target.value=''; }} />
                  {[{icon:'🖼️',label:'Photo',accept:'image/*'},{icon:'🎬',label:'Video',accept:'video/*'},{icon:'🎵',label:'Audio',accept:'audio/*'}].map(({icon,label,accept}) => (
                    <button key={label} onClick={() => { statusFileRef.current.accept=accept; statusFileRef.current.click(); }}
                      style={{ padding:'6px 10px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:8, color:'#7a5c52', fontSize:12, cursor:'pointer', transition:'border-color 0.2s' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                {statuses.length===0
                  ? <div style={{ padding:'30px 16px', textAlign:'center', color:'#7a5c52', fontSize:13 }}>No statuses yet</div>
                  : statuses.map(u => (
                    <div key={u.username} style={{ padding:'10px 14px', borderBottom:'1px solid #f0e6de' }}>
                      <div style={{ fontSize:11, color:'#a88070', fontWeight:600, marginBottom:6 }}>
                        {u.username===currentUser?.username ? '👤 My Status' : u.username}
                      </div>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {u.statuses.map((st,i) => (
                          <div key={i} onClick={() => {
                            setViewingStatus({ username:u.username, status:st });
                            if (u.username!==currentUser?.username && st._id) {
                              fetch(`${API}/status/${u.username}/${st._id}/view`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } })
                                .then(r=>r.json()).then(data => {
                                  setStatuses(prev => prev.map(user => user.username===u.username ? { ...user, statuses: user.statuses.map(s => s._id===st._id ? {...s, views:data.views} : s) } : user));
                                });
                            }
                          }}
                            style={{ width:56, height:56, borderRadius:10, background:'#fdf8f5', border:'2px solid #b76e79', cursor:'pointer', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'transform 0.15s', animation:'statusRing 2s ease infinite' }}>
                            {st.type==='text' && <div style={{ fontSize:9, color:'#f0e6de', padding:3, textAlign:'center', overflow:'hidden', lineHeight:1.3 }}>{st.content?.slice(0,20)}</div>}
                            {st.type==='image' && <img src={st.fileUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                            {st.type==='video' && <div style={{ fontSize:18 }}>🎬</div>}
                            {st.type==='audio' && <div style={{ fontSize:18 }}>🎵</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            </>
          )}

          {/* Requests tab */}
          {tab==='requests' && (
            requests.length===0
              ? (
                <div style={{ padding:'40px 20px', textAlign:'center', color:'#7a5c52' }}>
                  <div className="anim-float" style={{ fontSize:36, marginBottom:10 }}>🔔</div>
                  <div style={{ fontSize:13 }}>No pending requests</div>
                </div>
              )
              : requests.map(r => (
                <div key={r} className="anim-fadeUp sidebar-item" style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid #f0e6de' }}>
                  <Avatar name={r} size={40} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:'#2d1f1a', marginBottom:6 }}>{r}</div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => acceptRequest(r)} style={{ padding:'5px 12px', background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:7, color:'#6aab8e', fontSize:11, cursor:'pointer', fontWeight:600 }}>✓ Accept</button>
                      <button onClick={() => rejectRequest(r)} style={{ padding:'5px 12px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7, color:'#c4685a', fontSize:11, cursor:'pointer', fontWeight:600 }}>✕ Reject</button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{ margin:'12px', padding:'11px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:11, color:'#c4685a', cursor:'pointer', fontSize:13, fontWeight:600, transition:'background 0.2s' }}
        >
          🚪 Sign Out
        </button>
      </div>


      {/* ── CHAT AREA ── */}
      <div style={{ flex:1, minWidth:0, width: isMobile ? '100vw' : 'auto', height:'100vh', display: isMobile && !activeContact ? 'none' : 'flex', flexDirection:'column', background:'#f7f0eb', overflow:'hidden', position: isMobile ? 'fixed' : 'relative', top:0, left:0, right:0, bottom:0 }}>

        {!activeContact ? (
          <div className="anim-fadeIn" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#7a5c52', gap:12 }}>
            <div className="anim-float" style={{ fontSize:56, color:'#b76e79' }}>✦</div>
            <div className="grad-text" style={{ fontSize:22, fontWeight:800 }}>Whispera</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#7a5c52' }}>Select a friend to start chatting</div>
            <div style={{ fontSize:13, color:'#f0e6de' }}>Search users → Add friends → Chat!</div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ padding: isMobile ? '10px 12px' : '14px 20px', background:'#fdf8f5', borderBottom:'1px solid #f0e6de', display:'flex', alignItems:'center', gap: isMobile ? 8 : 12, flexShrink:0, paddingTop: isMobile ? 'max(10px,env(safe-area-inset-top))' : '14px' }}>
              {isMobile && (
                <button onClick={() => setActiveContact(null)} style={{ background:'none', border:'none', color:'#d4b8a8', fontSize:22, cursor:'pointer', padding:'0 4px', flexShrink:0 }}>←</button>
              )}
              <div style={{ position:'relative', flexShrink:0 }}>
                <Avatar name={activeContact} src={friendDetails[activeContact]?.profilePic} size={40} />
                {onlineFriends.includes(activeContact) && (
                  <span style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:'#6aab8e', border:'2px solid #fdf8f5' }} />
                )}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize: isMobile ? 14 : 15, color:'#2d1f1a' }}>{activeContact}</div>
                <div style={{ fontSize:12 }}>
                  {typingUsers[activeContact]
                    ? <span style={{ color:'#b76e79', fontStyle:'italic' }}>typing...</span>
                    : onlineFriends.includes(activeContact)
                      ? <span style={{ color:'#6aab8e' }}><OnlineDot />Online • AI-powered</span>
                      : <span style={{ color:'#a88070' }}>{lastSeenStr(activeContact) || 'Offline'}</span>
                  }
                </div>
              </div>

              {/* Message search toggle */}
              <button onClick={() => setShowMsgSearch(p => !p)} style={{ background:'none', border:'none', color:'#a88070', fontSize:18, cursor:'pointer', padding:'4px 8px' }} title="Search messages">🔍</button>

              {/* 3-dot menu */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <button onClick={() => setShowContactMenu(p => !p)} style={{ background:'none', border:'none', color:'#a88070', fontSize:22, cursor:'pointer', padding:'4px 8px' }}>⋮</button>
                {showContactMenu && (
                  <div className="anim-fadeDown" style={{ position:'absolute', right:0, top:40, background:'#f0e6de', border:'1px solid #e8d5c8', borderRadius:12, minWidth:170, zIndex:100, boxShadow:'0 12px 32px rgba(0,0,0,0.5)', overflow:'hidden' }}
                    onClick={() => setShowContactMenu(false)}>
                    <button onClick={() => unfriend(activeContact)} style={{ width:'100%', padding:'12px 16px', background:'none', border:'none', color:'#c4685a', fontSize:13, cursor:'pointer', textAlign:'left', borderBottom:'1px solid #e8d5c8' }}>👤 Unfriend</button>
                    <button onClick={() => blockUser(activeContact)} style={{ width:'100%', padding:'12px 16px', background:'none', border:'none', color:'#c9963a', fontSize:13, cursor:'pointer', textAlign:'left' }}>🚫 Block</button>
                  </div>
                )}
              </div>
            </div>

            {/* Message search bar */}
            {showMsgSearch && (
              <div className="anim-fadeDown" style={{ padding:'8px 16px', background:'#fdf8f5', borderBottom:'1px solid #f0e6de', display:'flex', gap:8, alignItems:'center' }}>
                <input
                  className="input-glow"
                  style={{ flex:1, padding:'8px 12px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:9, color:'#2d1f1a', fontSize:13, outline:'none' }}
                  placeholder="Search messages..."
                  value={msgSearch}
                  onChange={e => setMsgSearch(e.target.value)}
                  autoFocus
                />
                <button onClick={() => { setShowMsgSearch(false); setMsgSearch(''); }} style={{ background:'none', border:'none', color:'#a88070', cursor:'pointer', fontSize:18 }}>✕</button>
              </div>
            )}

            {/* Messages */}
            <div className="chat-scroll" style={{ flex:1, minHeight:0, overflowY:'auto', padding: isMobile ? '12px' : '20px', display:'flex', flexDirection:'column', gap:10, WebkitOverflowScrolling:'touch' }}>
              {activeMessages.length===0
                ? (
                  <div className="anim-fadeIn" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#7a5c52', gap:8, paddingTop:60 }}>
                    <div className="anim-float" style={{ fontSize:44 }}>👋</div>
                    <div style={{ fontSize:15, fontWeight:600 }}>No messages yet</div>
                    <div style={{ fontSize:13 }}>Say hi to {activeContact}!</div>
                  </div>
                )
                : activeMessages.map((c, i) => {
                    const mine = c.sender === currentUser?.username;
                    return (
                      <div key={i} className="msg-row" style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems:'flex-end', gap:8, width:'100%' }}
                        onClick={() => { setShowEmojiFor(null); setMsgContextMenu(null); }}>
                        {!mine && <Avatar name={activeContact} src={friendDetails[activeContact]?.profilePic} size={30} />}
                        <div style={{ maxWidth:'70%', display:'inline-flex', flexDirection:'column' }}>
                          {/* Reply preview */}
                          {c.replyTo && (
                            <div style={{ background:'rgba(255,255,255,0.05)', borderLeft:'3px solid #b76e79', borderRadius:'8px 8px 0 0', padding:'6px 10px', fontSize:11, color:'#7a5c52', marginBottom:2 }}>
                              <span style={{ color:'#d4a882', fontWeight:600 }}>{c.replyTo.sender}: </span>
                              {c.replyTo.fileType ? `📎 ${c.replyTo.fileType}` : c.replyTo.text?.slice(0,60)}
                            </div>
                          )}
                          <div style={{ position:'relative' }}>
                            <div
                              className="msg-bubble"
                              onContextMenu={e => { e.preventDefault(); setMsgContextMenu({ msgId:c._id, x:e.clientX, y:e.clientY, seenAt:c.seenAt, mine }); }}
                              style={{ display:'inline-block', padding:'10px 14px', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? 'linear-gradient(135deg,#b76e79,#a05a64)' : '#f0e6de', border: mine ? 'none' : '1px solid #e8d5c8', color:'#2d1f1a', fontSize:14, lineHeight:1.6, wordBreak:'normal', overflowWrap:'break-word', whiteSpace:'pre-wrap', boxShadow: mine ? '0 4px 16px rgba(183,110,121,0.25)' : 'none' }}
                            >
                              {c.fileType==='image' && <img src={c.fileUrl} alt="img" style={{ maxWidth:'100%', borderRadius:8, display:'block', marginBottom: c.text ? 6 : 0 }} />}
                              {c.fileType==='video' && <video src={c.fileUrl} controls style={{ maxWidth:'100%', borderRadius:8, display:'block', marginBottom: c.text ? 6 : 0 }} />}
                              {c.fileType==='audio' && <audio src={c.fileUrl} controls style={{ width:'100%', marginBottom: c.text ? 6 : 0 }} />}
                              {c.fileType==='file' && <a href={c.fileUrl} target="_blank" rel="noreferrer" style={{ color:'#d4b8a8', fontSize:13, display:'block', marginBottom: c.text ? 6 : 0 }}>📎 {c.fileName}</a>}
                              {c.text && <span>{c.text}</span>}
                              {!c.text && !c.fileType && <span style={{ color:'#7a5c52', fontSize:12 }}>📎 File</span>}
                            </div>

                            {/* Action buttons */}
                            <div style={{ display:'flex', gap:4, marginTop:4, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                              <button className="emoji-btn" onClick={e => { e.stopPropagation(); setShowEmojiFor(showEmojiFor===c._id ? null : c._id); }}
                                style={{ background:'none', border:'none', fontSize:14, cursor:'pointer', opacity:0.5, padding:'2px 4px' }}>😊</button>
                              <button onClick={e => { e.stopPropagation(); setReplyingTo(c); }}
                                style={{ background:'none', border:'none', fontSize:11, cursor:'pointer', opacity:0.5, color:'#7a5c52', padding:'2px 6px' }}>↩ Reply</button>
                            </div>

                            {/* Emoji picker */}
                            {showEmojiFor===c._id && (
                              <div className="anim-popIn" onClick={e => e.stopPropagation()} style={{ position:'absolute', [mine?'right':'left']:0, bottom:44, background:'#f0e6de', border:'1px solid #e8d5c8', borderRadius:14, padding:'8px 12px', display:'flex', gap:8, zIndex:50, boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
                                {['❤️','😂','😮','😢','👍','🔥'].map(emoji => (
                                  <button key={emoji} className="emoji-btn" onClick={() => reactToMsg(c._id, emoji)}
                                    style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>{emoji}</button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Reactions */}
                          {c.reactions?.length > 0 && (
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:4, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                              {Object.entries(c.reactions.reduce((acc, r) => { acc[r.emoji]=(acc[r.emoji]||0)+1; return acc; }, {})).map(([emoji, count]) => (
                                <span key={emoji} onClick={() => reactToMsg(c._id, emoji)}
                                  style={{ background:'#f0e6de', border:'1px solid #e8d5c8', borderRadius:20, padding:'2px 8px', fontSize:12, cursor:'pointer', transition:'transform 0.1s' }}>
                                  {emoji}{count > 1 ? ` ${count}` : ''}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Meta */}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, justifyContent: mine ? 'flex-end' : 'flex-start', flexWrap:'wrap' }}>
                            <span style={{ fontSize:10, color:'#7a5c52' }}>{c.time}</span>
                            {mine && c.seenAt && <span style={{ fontSize:10, color:'#b76e79' }}>✓✓</span>}
                            {mine && !c.seenAt && <span style={{ fontSize:10, color:'#7a5c52' }}>✓</span>}
                            {c.sentiment && c.text && (
                              <span style={{ background: sentimentColor(c.sentiment).bg, color: sentimentColor(c.sentiment).color, fontSize:10, padding:'2px 7px', borderRadius:20, fontWeight:600 }}>{c.sentiment}</span>
                            )}
                          </div>
                        </div>
                        {mine && <Avatar name={currentUser.username} src={currentUser.profilePic} size={30} />}
                      </div>
                    );
                  })
              }
              {/* Typing indicator */}
              {typingUsers[activeContact] && (
                <div className="anim-fadeUp" style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
                  <Avatar name={activeContact} src={friendDetails[activeContact]?.profilePic} size={30} />
                  <TypingIndicator />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Notification banner */}
            {notification && (
              <div className="toast" style={{ margin:'0 16px 8px', padding:'10px 14px', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, fontSize:13, color:'#6aab8e' }}>{notification}</div>
            )}
            {warning && (
              <div className="toast" style={{ margin:'0 16px 8px', padding:'10px 14px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12, fontSize:13, color:'#c9963a' }}>⚠️ {warning}</div>
            )}

            {/* Context menu */}
            {msgContextMenu && (
              <div onClick={() => setMsgContextMenu(null)} style={{ position:'fixed', inset:0, zIndex:200 }}>
                <div className="anim-scaleIn" onClick={e => e.stopPropagation()} style={{ position:'fixed', top: Math.min(msgContextMenu.y, window.innerHeight-130), left: Math.min(msgContextMenu.x, window.innerWidth-200), background:'#f0e6de', border:'1px solid #e8d5c8', borderRadius:12, padding:'6px 0', minWidth:180, boxShadow:'0 12px 32px rgba(0,0,0,0.5)', zIndex:201, overflow:'hidden' }}>
                  {msgContextMenu.mine && (
                    <div style={{ padding:'10px 16px', fontSize:13, color: msgContextMenu.seenAt ? '#6aab8e' : '#a88070', borderBottom:'1px solid #e8d5c8' }}>
                      {msgContextMenu.seenAt ? `✅ Seen at ${new Date(msgContextMenu.seenAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}` : '🕐 Not seen yet'}
                    </div>
                  )}
                  <div style={{ padding:'10px 16px', fontSize:13, color:'#2d1f1a', cursor:'pointer' }}
                    onClick={() => { const m=activeMessages.find(m=>m._id===msgContextMenu.msgId); if(m) setReplyingTo(m); setMsgContextMenu(null); }}>
                    ↩ Reply
                  </div>
                  <div style={{ padding:'10px 16px', fontSize:13, color:'#2d1f1a', cursor:'pointer', borderTop:'1px solid #e8d5c8' }}
                    onClick={() => { setShowEmojiFor(msgContextMenu.msgId); setMsgContextMenu(null); }}>
                    😊 React
                  </div>
                </div>
              </div>
            )}

            {/* Smart replies */}
            {smartReplies.length > 0 && (
              <div className="anim-fadeUp" style={{ margin:'0 16px 8px', display:'flex', gap:8, flexWrap:'wrap', flexShrink:0, alignItems:'center' }}>
                <span style={{ fontSize:11, color:'#d4a882', fontWeight:700, flexShrink:0 }}>💡</span>
                {smartReplies.map((r, i) => (
                  <button key={i} onClick={() => send(r)}
                    style={{ background:'rgba(183,110,121,0.12)', border:'1px solid rgba(183,110,121,0.4)', color:'#7a3040', fontSize:12, padding:'6px 14px', borderRadius:20, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', transition:'background 0.15s' }}>
                    {r}
                  </button>
                ))}
                <button onClick={() => setSmartReplies([])} style={{ background:'transparent', border:'none', color:'#a88070', cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
            )}

            {/* Input area */}
            <div style={{ position:'relative', padding: isMobile ? '8px 12px' : '12px 20px', background:'#fdf8f5', borderTop:'1px solid #f0e6de', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0, paddingBottom: isMobile ? 'max(8px,env(safe-area-inset-bottom))' : '12px' }}>
              {/* Reply preview */}
              {replyingTo && (
                <div className="anim-fadeDown" style={{ position:'absolute', bottom:'100%', left:0, right:0, background:'#fdf8f5', borderTop:'1px solid #8a4a52', padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:12, color:'#d4a882' }}>
                    <span style={{ fontWeight:600 }}>↩ {replyingTo.sender}: </span>
                    <span style={{ color:'#7a5c52' }}>{replyingTo.fileType ? `📎 ${replyingTo.fileType}` : replyingTo.text?.slice(0,50)}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background:'none', border:'none', color:'#a88070', cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
              )}

              <input type="file" ref={fileInputRef} style={{ display:'none' }} onChange={e => { sendFile(e.target.files[0]); e.target.value=''; }} />
              <button onClick={() => fileInputRef.current.click()} style={{ padding: isMobile ? '10px 12px' : '11px 14px', background:'#f0e6de', border:'1px solid #e8d5c8', borderRadius:12, color:'#a88070', cursor:'pointer', fontSize:18, flexShrink:0, transition:'border-color 0.2s' }} title="Send file">
                {sendingFile ? <div style={{ width:18, height:18, border:'2px solid #7a5c52', borderTop:'2px solid #b76e79', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> : '📎'}
              </button>

              <textarea
                className="input-glow"
                style={{ flex:1, minWidth:0, padding: isMobile ? '10px 12px' : '11px 14px', background:'#fdf8f5', border:'1px solid #e8d5c8', borderRadius:12, color:'#2d1f1a', fontSize:14, outline:'none', resize:'none', fontFamily:'Inter,sans-serif', lineHeight:1.5, maxHeight:100, overflowY:'auto', width:'100%', boxSizing:'border-box', transition:'border-color 0.2s, box-shadow 0.2s' }}
                rows={1}
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={handleKey}
                onFocus={handleFocus}
                placeholder={`Message ${activeContact}...`}
              />

              <button
                onClick={() => send()}
                className={msg.trim() ? 'btn-primary' : ''}
                style={{ padding: isMobile ? '10px 14px' : '11px 18px', background: msg.trim() ? 'linear-gradient(135deg,#b76e79,#a05a64)' : '#f0e6de', border:'1px solid '+(msg.trim() ? 'transparent' : '#e8d5c8'), borderRadius:12, color: msg.trim() ? '#fff' : '#a88070', cursor: msg.trim() ? 'pointer' : 'default', fontWeight:700, fontSize:14, flexShrink:0, transition:'all 0.2s' }}
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
