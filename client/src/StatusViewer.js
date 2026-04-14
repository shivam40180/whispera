import React, { useState, useEffect, useRef } from 'react';

const API = 'http://192.168.0.102:5001';

function timeAgo(d) {
  const diff = Date.now() - new Date(d);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function expiresIn(d) {
  const msLeft = new Date(d).getTime() + 24 * 60 * 60 * 1000 - Date.now();
  if (msLeft <= 0) return 'Expired';
  const h = Math.floor(msLeft / 3600000);
  const m = Math.floor((msLeft % 3600000) / 60000);
  if (h > 0) return `Expires in ${h}h ${m}m`;
  return `Expires in ${m}m`;
}

function postedAt(d) {
  return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StatusViewer({ token, currentUser, onClose }) {
  const [statuses, setStatuses] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [newText, setNewText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('view');
  const [progress, setProgress] = useState(0);
  const [menuFor, setMenuFor] = useState(null);
  const timerRef = useRef(null);

  const reloadStatuses = async () => {
    const res = await fetch(API + '/statuses', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setStatuses(Array.isArray(data) ? data : []);
  };

  useEffect(() => { reloadStatuses(); }, [token]);

  useEffect(() => {
    if (!viewing) return;
    setProgress(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { goNext(); return 0; }
        return p + 1;
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [viewing]);

  const goNext = () => {
    if (!viewing) return;
    const user = statuses[viewing.userIndex];
    if (!user) return;
    if (viewing.statusIndex < user.statuses.length - 1) {
      setViewing(v => ({ ...v, statusIndex: v.statusIndex + 1 }));
    } else if (viewing.userIndex < statuses.length - 1) {
      setViewing({ userIndex: viewing.userIndex + 1, statusIndex: 0 });
    } else {
      setViewing(null);
    }
  };

  const goPrev = () => {
    if (!viewing) return;
    if (viewing.statusIndex > 0) {
      setViewing(v => ({ ...v, statusIndex: v.statusIndex - 1 }));
    } else if (viewing.userIndex > 0) {
      const prevUser = statuses[viewing.userIndex - 1];
      setViewing({ userIndex: viewing.userIndex - 1, statusIndex: prevUser.statuses.length - 1 });
    }
  };

  const openStatus = (userIndex, statusIndex = 0) => {
    setViewing({ userIndex, statusIndex });
    const user = statuses[userIndex];
    const st = user?.statuses[statusIndex];
    if (user && st && user.username !== currentUser.username && st._id) {
      fetch(`${API}/status/${user.username}/${st._id}/view`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()).then(data => {
        setStatuses(prev => prev.map(u => u.username === user.username ? {
          ...u, statuses: u.statuses.map(s => s._id === st._id ? { ...s, views: data.views } : s)
        } : u));
      });
    }
  };

  const deleteStatus = async (statusId) => {
    await fetch(`${API}/status/${statusId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setMenuFor(null);
    setViewing(null);
    await reloadStatuses();
  };

  const postTextStatus = async () => {
    if (!newText.trim()) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('type', 'text');
    fd.append('content', newText);
    await fetch(API + '/status', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    setUploading(false);
    setNewText('');
    setTab('view');
    await reloadStatuses();
  };

  const postFileStatus = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', file);
    await fetch(API + '/status', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    setUploading(false);
    setTab('view');
    await reloadStatuses();
  };

  // ── Fullscreen story viewer ──
  if (viewing !== null) {
    const user = statuses[viewing.userIndex];
    const st = user?.statuses[viewing.statusIndex];
    if (!user || !st) { setViewing(null); return null; }
    const isOwn = user.username === currentUser.username;

    return (
      <div className="anim-fadeIn" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' }}
        onClick={() => setMenuFor(null)}>

        {/* Progress bars */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 16px 8px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
          {user.statuses.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#fff', borderRadius: 2, width: i < viewing.statusIndex ? '100%' : i === viewing.statusIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ position: 'absolute', top: 28, left: 0, right: 0, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#b76e79,#a05a64)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', border: '2px solid rgba(255,255,255,0.3)' }}>
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                {isOwn ? 'My Status' : user.username}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>📅 {postedAt(st.createdAt)}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>•</span>
                <span style={{ color: 'rgba(255,200,80,0.85)', fontSize: 11 }}>⏳ {expiresIn(st.createdAt)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* 3-dot menu for own status */}
            {isOwn && (
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setMenuFor(menuFor === st._id ? null : st._id)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >⋮</button>
                {menuFor === st._id && (
                  <div className="anim-fadeDown" style={{ position: 'absolute', right: 0, top: 42, background: '#f0e6de', border: '1px solid #d4b8a8', borderRadius: 12, minWidth: 160, boxShadow: '0 12px 32px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 20 }}>
                    <button
                      onClick={() => deleteStatus(st._id)}
                      style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#c4685a', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
                    >🗑️ Delete Status</button>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setViewing(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Tap zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 5 }}>
          <div style={{ flex: 1 }} onClick={goPrev} />
          <div style={{ flex: 1 }} onClick={goNext} />
        </div>

        {/* Content */}
        <div className="anim-scaleIn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
          {st.type === 'text' && <div style={{ fontSize: 28, color: '#fff', fontWeight: 700, lineHeight: 1.5, textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{st.content}</div>}
          {st.type === 'image' && <img src={st.fileUrl} alt="status" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12, objectFit: 'contain' }} />}
          {st.type === 'video' && <video src={st.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12 }} />}
          {st.type === 'audio' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎵</div>
              <audio src={st.fileUrl} controls autoPlay style={{ width: '100%' }} />
            </div>
          )}
        </div>

        {/* Bottom bar — always visible */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '16px 20px 28px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Time info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>📅 Posted {postedAt(st.createdAt)}</span>
              <span style={{ color: 'rgba(255,200,80,0.9)', fontSize: 12 }}>⏳ {expiresIn(st.createdAt)}</span>
              {isOwn && (
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>👁️ {st.views?.length || 0} view{st.views?.length !== 1 ? 's' : ''}{st.views?.length > 0 ? ` · ${st.views.slice(0,3).join(', ')}${st.views.length > 3 ? '...' : ''}` : ''}</span>
              )}
            </div>

            {/* 3-dot delete menu for own status */}
            {isOwn && (
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setMenuFor(menuFor === st._id ? null : st._id)}
                  style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
                >⋮</button>
                {menuFor === st._id && (
                  <div className="anim-fadeDown" style={{ position: 'absolute', right: 0, bottom: 48, background: '#f0e6de', border: '1px solid #d4b8a8', borderRadius: 12, minWidth: 160, boxShadow: '0 12px 32px rgba(0,0,0,0.7)', overflow: 'hidden', zIndex: 20 }}>
                    <button
                      onClick={() => deleteStatus(st._id)}
                      style={{ width: '100%', padding: '13px 16px', background: 'none', border: 'none', color: '#c4685a', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}
                    >🗑️ Delete Status</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main modal ──
  return (
    <div className="anim-fadeIn" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={() => { setMenuFor(null); onClose(); }}>
      <div className="anim-scaleIn glass" style={{ borderRadius: 20, width: '100%', maxWidth: 440, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #e8d5c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#2d1f1a' }}>📸 Status</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #e8d5c8', color: '#7a5c52', fontSize: 16, cursor: 'pointer', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid #e8d5c8', background: '#fdf8f5' }}>
          {[['view', '👁️ View'], ['add', '➕ Add Status']].map(([key, label]) => (
            <button key={key} className="tab-btn" onClick={() => setTab(key)}
              style={{ flex: 1, padding: '9px', background: tab === key ? 'linear-gradient(135deg,#b76e79,#a05a64)' : 'transparent', border: '1px solid ' + (tab === key ? 'transparent' : '#e8d5c8'), borderRadius: 10, color: tab === key ? '#fff' : '#a88070', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} onClick={() => setMenuFor(null)}>

          {tab === 'view' && (
            statuses.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#7a5c52' }}>
                  <div className="anim-float" style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No statuses yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Be the first to post one!</div>
                </div>
              )
              : statuses.map((u, userIndex) => (
                <div key={u.username} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#b76e79,#a05a64)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', border: '2px solid #b76e79' }}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2d1f1a' }}>
                        {u.username === currentUser.username ? '👤 My Status' : u.username}
                      </div>
                      <div style={{ fontSize: 11, color: '#a88070' }}>{u.statuses.length} update{u.statuses.length > 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {u.statuses.map((st, i) => (
                      <div key={st._id || i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        {/* Thumbnail — no overflow hidden so 3-dot menu is visible */}
                        <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
                          <div
                            onClick={() => openStatus(userIndex, i)}
                            style={{ width: '100%', height: '100%', borderRadius: 12, background: '#fdf8f5', border: '2px solid #b76e79', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(183,110,121,0.4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            {st.type === 'text' && <div style={{ fontSize: 9, color: '#f0e6de', padding: 4, textAlign: 'center', overflow: 'hidden', lineHeight: 1.3 }}>{st.content?.slice(0, 20)}</div>}
                            {st.type === 'image' && <img src={st.fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            {st.type === 'video' && <div style={{ fontSize: 22 }}>🎬</div>}
                            {st.type === 'audio' && <div style={{ fontSize: 22 }}>🎵</div>}
                          </div>
                          {/* 3-dot button — outside overflow:hidden container */}
                          {u.username === currentUser.username && (
                            <div style={{ position: 'absolute', top: -8, right: -8, zIndex: 10 }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setMenuFor(menuFor === (st._id + i) ? null : (st._id + i))}
                                style={{ width: 22, height: 22, borderRadius: '50%', background: '#b76e79', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, lineHeight: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
                              >⋮</button>
                              {menuFor === (st._id + i) && (
                                <div className="anim-fadeDown" style={{ position: 'absolute', right: 0, top: 26, background: '#f0e6de', border: '1px solid #d4b8a8', borderRadius: 10, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100, overflow: 'hidden' }}>
                                  <button
                                    onClick={() => deleteStatus(st._id)}
                                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#c4685a', fontSize: 12, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                                  >🗑️ Delete</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Time info */}
                        <div style={{ fontSize: 9, color: '#7a5c52', textAlign: 'center', lineHeight: 1.4 }}>
                          <div>{timeAgo(st.createdAt)}</div>
                          <div style={{ color: 'rgba(245,158,11,0.7)' }}>{expiresIn(st.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}

          {tab === 'add' && (
            <div className="anim-fadeUp">
              <div style={{ fontSize: 13, color: '#a88070', marginBottom: 16 }}>Share a moment. Status expires automatically in 24 hours.</div>
              <textarea
                className="input-glow"
                style={{ width: '100%', padding: '12px 14px', background: '#fdf8f5', border: '1px solid #e8d5c8', borderRadius: 12, color: '#2d1f1a', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box', marginBottom: 12, minHeight: 90, lineHeight: 1.6 }}
                placeholder="✏️ Write a text status..."
                value={newText}
                onChange={e => setNewText(e.target.value)}
              />
              {newText.trim() && (
                <button className="btn-primary" onClick={postTextStatus} disabled={uploading}
                  style={{ width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {uploading
                    ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Posting...</>
                    : '✏️ Post Text Status'}
                </button>
              )}
              <div style={{ fontSize: 12, color: '#7a5c52', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Or upload media</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['image', '🖼️ Photo', '.jpg,.jpeg,.png,.gif,.webp', 'rgba(183,110,121,0.08)', 'rgba(183,110,121,0.2)', '#d4b8a8'],
                  ['video', '🎬 Video', '.mp4,.mov,.webm', 'rgba(236,72,153,0.08)', 'rgba(236,72,153,0.2)', '#f9a8d4'],
                  ['audio', '🎵 Audio', '.mp3,.wav,.ogg,.m4a', 'rgba(20,184,166,0.08)', 'rgba(20,184,166,0.2)', '#5eead4'],
                ].map(([type, label, accept, bg, border, color]) => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: bg, border: `1px solid ${border}`, borderRadius: 12, color, fontSize: 14, cursor: 'pointer', fontWeight: 500, transition: 'transform 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
                    {label}
                    <input type="file" accept={accept} style={{ display: 'none' }} onChange={e => postFileStatus(e, type)} />
                  </label>
                ))}
              </div>
              {uploading && (
                <div style={{ textAlign: 'center', color: '#d4a882', fontSize: 13, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #8a4a52', borderTop: '2px solid #b76e79', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Uploading...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
