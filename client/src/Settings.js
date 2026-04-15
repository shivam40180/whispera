import React, { useState, useEffect } from 'react';

const API = 'https://whispera-api.onrender.com';

export default function Settings({ currentUser, token, onUpdate, onClose, onLogout }) {
  const [username, setUsername] = useState(currentUser.username);
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showLastSeen, setShowLastSeen] = useState(currentUser.privacy?.showLastSeen ?? true);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    fetch(API + '/friends/blocked', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBlocked(d.blocked || []));
  }, [token]);

  const save = async () => {
    setLoading(true); setMsg('');
    const body = {};
    if (username !== currentUser.username) body.username = username;
    if (password) body.password = password;
    body.showLastSeen = showLastSeen;
    const res = await fetch(API + '/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setMsg('❌ ' + (data.error || 'Failed')); return; }
    setMsg('✅ Saved successfully!');
    setPassword('');
    onUpdate(data.user, data.token);
    setTimeout(() => setMsg(''), 3000);
  };

  const uploadPic = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch(API + '/settings/profile-pic', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    const data = await res.json();
    if (data.profilePic) {
      setMsg('✅ Profile picture updated!');
      onUpdate({ ...currentUser, profilePic: data.profilePic }, token);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const unblock = async (u) => {
    await fetch(API + '/friends/unblock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: u }),
    });
    setBlocked(prev => prev.filter(b => b !== u));
  };

  const tabs = [
    { key: 'profile', icon: '👤', label: 'Profile' },
    { key: 'privacy', icon: '🔒', label: 'Privacy' },
    { key: 'blocked', icon: '🚫', label: 'Blocked' },
  ];

  const inp = {
    width: '100%', padding: '11px 14px', background: '#fdf8f5',
    border: '1px solid #e8d5c8', borderRadius: 11, color: '#2d1f1a',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'Inter,sans-serif',
  };

  return (
    <div
      className="anim-fadeIn"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="anim-scaleIn glass"
        style={{ borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 32px 80px rgba(0,0,0,0.6)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e8d5c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(183,110,121,0.05)' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2d1f1a' }}>⚙️ Settings</div>
            <div style={{ fontSize: 12, color: '#a88070', marginTop: 2 }}>Manage your account</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #e8d5c8', color: '#7a5c52', fontSize: 16, cursor: 'pointer', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 16px', borderBottom: '1px solid #e8d5c8', background: '#fdf8f5' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className="tab-btn"
              onClick={() => setActiveTab(t.key)}
              style={{ flex: 1, padding: '8px 6px', background: activeTab === t.key ? 'linear-gradient(135deg,#b76e79,#a05a64)' : 'transparent', border: '1px solid ' + (activeTab === t.key ? 'transparent' : '#e8d5c8'), borderRadius: 10, color: activeTab === t.key ? '#fff' : '#a88070', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 16 }}>{t.icon}</div>
              <div style={{ marginTop: 2 }}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Profile tab */}
          {activeTab === 'profile' && (
            <div className="anim-fadeUp">
              {/* Avatar section */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  {currentUser.profilePic
                    ? <img src={currentUser.profilePic} alt="pfp" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #b76e79' }} />
                    : (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#b76e79,#a05a64)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: '#fff', border: '3px solid #b76e79' }}>
                        {currentUser.username[0].toUpperCase()}
                      </div>
                    )
                  }
                  <label style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, background: 'linear-gradient(135deg,#b76e79,#a05a64)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fdf8f5', fontSize: 13 }}>
                    📷
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPic} />
                  </label>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2d1f1a' }}>{currentUser.username}</div>
                <div style={{ fontSize: 12, color: '#a88070' }}>{currentUser.email}</div>
              </div>

              {/* Username */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: '#a88070', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}>👤</span>
                  <input
                    className="input-glow"
                    style={{ ...inp, paddingLeft: 38 }}
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: '#a88070', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15 }}>🔒</span>
                  <input
                    className="input-glow"
                    style={{ ...inp, paddingLeft: 38, paddingRight: 42 }}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#a88070' }}
                  >{showPass ? '🙈' : '👁️'}</button>
                </div>
              </div>

              {msg && (
                <div className="anim-fadeDown" style={{ fontSize: 13, color: msg.startsWith('✅') ? '#6aab8e' : '#c4685a', marginBottom: 14, textAlign: 'center', padding: '10px', background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 10, border: `1px solid ${msg.startsWith('✅') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  {msg}
                </div>
              )}

              <button
                className="btn-primary"
                onClick={save}
                disabled={loading}
                style={{ width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading
                  ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Saving...</>
                  : '💾 Save Changes'
                }
              </button>
            </div>
          )}

          {/* Privacy tab */}
          {activeTab === 'privacy' && (
            <div className="anim-fadeUp">
              <div style={{ fontSize: 13, color: '#a88070', marginBottom: 20 }}>Control what others can see about you.</div>

              {/* Last seen toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#fdf8f5', border: '1px solid #e8d5c8', borderRadius: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, color: '#2d1f1a', fontWeight: 600 }}>Show Last Seen</div>
                  <div style={{ fontSize: 12, color: '#a88070', marginTop: 3 }}>Friends can see when you were last active</div>
                </div>
                <div
                  onClick={() => setShowLastSeen(p => !p)}
                  style={{ width: 46, height: 26, borderRadius: 13, background: showLastSeen ? 'linear-gradient(135deg,#b76e79,#a05a64)' : '#e8d5c8', cursor: 'pointer', position: 'relative', transition: 'background 0.25s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: showLastSeen ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.25s', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(183,110,121,0.05)', border: '1px solid rgba(183,110,121,0.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 13, color: '#d4a882', fontWeight: 600, marginBottom: 6 }}>🔐 Account Security</div>
                <div style={{ fontSize: 12, color: '#a88070', lineHeight: 1.6 }}>Your messages are end-to-end encrypted. Only you and the recipient can read them.</div>
              </div>

              {msg && (
                <div className="anim-fadeDown" style={{ fontSize: 13, color: msg.startsWith('✅') ? '#6aab8e' : '#c4685a', marginTop: 14, textAlign: 'center', padding: '10px', background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 10 }}>
                  {msg}
                </div>
              )}

              <button
                className="btn-primary"
                onClick={save}
                disabled={loading}
                style={{ width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? 'Saving...' : '💾 Save Privacy Settings'}
              </button>
            </div>
          )}

        {/* Blocked tab */}
          {activeTab === 'blocked' && (
            <div className="anim-fadeUp">
              <div style={{ fontSize: 13, color: '#a88070', marginBottom: 16 }}>
                {blocked.length === 0 ? 'No blocked users.' : `${blocked.length} blocked user${blocked.length > 1 ? 's' : ''}.`}
              </div>
              {blocked.length === 0
                ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: '#7a5c52' }}>
                    <div className="anim-float" style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                    <div style={{ fontSize: 13 }}>No blocked users</div>
                  </div>
                )
                : blocked.map(u => (
                  <div key={u} className="anim-fadeUp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fdf8f5', border: '1px solid #e8d5c8', borderRadius: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#b76e79,#a05a64)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                        {u[0].toUpperCase()}
                      </div>
                      <span style={{ color: '#7a5c52', fontSize: 14, fontWeight: 500 }}>{u}</span>
                    </div>
                    <button
                      onClick={() => unblock(u)}
                      style={{ padding: '6px 14px', background: 'rgba(183,110,121,0.1)', border: '1px solid rgba(183,110,121,0.2)', borderRadius: 8, color: '#d4b8a8', fontSize: 12, cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                    >Unblock</button>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Sign Out button */}
        <div style={{ padding: '0 24px 24px' }}>
          <button
            onClick={onLogout}
            style={{ width: '100%', padding: '12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 11, color: '#c4685a', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          >
            🚪 Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
