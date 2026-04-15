require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const User = require('./models/User');
const Message = require('./models/Message');
const { analyzeMessage } = require('./utils/ai');

const app = express();
const BASE = 'https://whispera-api.onrender.com';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ DB Error:', err.message));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const onlineUsers = {};

const storage = (folder) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, `uploads/${folder}`),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const uploadChat    = multer({ storage: storage('chat'),    limits: { fileSize: 50*1024*1024 } });
const uploadProfile = multer({ storage: storage('profiles'),limits: { fileSize: 5*1024*1024  } });
const uploadStatus  = multer({ storage: storage('status'),  limits: { fileSize: 50*1024*1024 } });

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

// ── Socket ──────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('register-online', async (username) => {
    onlineUsers[username] = socket.id;
    socket.join(username);
    socket.broadcast.emit('userOnline', username);
    socket.emit('onlineFriendsList', Object.keys(onlineUsers));
  });

  socket.on('logout', async (username) => {
    if (username) {
      socket.leave(username);
      delete onlineUsers[username];
      socket.broadcast.emit('userOffline', username);
      await User.findOneAndUpdate({ username }, { lastSeen: new Date() });
    }
  });

  socket.on('typing', ({ from, to }) => { io.to(to).emit('typing', { from }); });

  socket.on('getSuggestion', async (data) => {
    if (!data?.text || !data?.requester) return;
    const ai = await analyzeMessage(data.text);
    if (ai.replies?.length) io.to(data.requester).emit('smartReplies', ai.replies);
  });

  socket.on('sendMessage', async (data) => {
    if ((!data?.text && !data?.fileUrl) || !data?.sender || !data?.receiver) return;
    const ai = data.text ? await analyzeMessage(data.text) : { toxic: false, sentiment: 'Neutral 😐', replies: [] };
    if (ai.toxic) { socket.emit('warning', 'Toxic message ⚠️'); return; }
    try {
      const msg = new Message({
        sender: data.sender, receiver: data.receiver,
        text: data.text || '', sentiment: ai.sentiment,
        fileUrl: data.fileUrl || null, fileType: data.fileType || null,
        fileName: data.fileName || null, replyTo: data.replyTo || null
      });
      await msg.save();
      const saved = msg.toObject();
      io.to(data.receiver).emit('receiveMessage', saved);
      if (data.sender !== data.receiver) io.to(data.sender).emit('receiveMessage', saved);
    } catch (err) { socket.emit('error', 'Message could not be saved'); }
  });

  socket.on('disconnect', async () => {
    for (const [username, sid] of Object.entries(onlineUsers)) {
      if (sid === socket.id) {
        delete onlineUsers[username];
        socket.broadcast.emit('userOffline', username);
        await User.findOneAndUpdate({ username }, { lastSeen: new Date() });
        break;
      }
    }
  });

  // WebRTC signaling
  socket.on('call:offer',  ({ to, from, offer })   => io.to(to).emit('call:offer',  { from, offer }));
  socket.on('call:answer', ({ to, answer })         => io.to(to).emit('call:answer', { answer }));
  socket.on('call:ice',    ({ to, candidate })      => io.to(to).emit('call:ice',    { candidate }));
  socket.on('call:reject', ({ to })                 => io.to(to).emit('call:rejected'));
  socket.on('call:end',    ({ to })                 => io.to(to).emit('call:ended'));
  socket.on('call:busy',   ({ to })                 => io.to(to).emit('call:busy'));
});

// ── Auth ─────────────────────────────────────────────────
app.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('username').trim().notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const badWords = ['sex','porn','nude','naked','fuck','shit','ass','dick','pussy','cock','boob','nigger','nigga','bitch','slut','whore','rape','xxx','18+','adult','nsfw'];
    if (badWords.some(w => req.body.username.toLowerCase().includes(w))) return res.status(400).json({ error: 'Username contains inappropriate content' });
    const existing = await User.findOne({ $or: [{ email: req.body.email }, { username: req.body.username }] });
    if (existing) return res.status(409).json({ error: 'Email or username already taken' });
    const hash = await bcrypt.hash(req.body.password, 10);
    await new User({ username: req.body.username, email: req.body.email, password: hash }).save();
    res.status(201).json({ message: 'User registered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) return res.status(401).json({ error: 'Wrong password' });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, profilePic: user.profilePic, privacy: user.privacy } });
  } catch { res.status(500).json({ error: 'Login failed' }); }
});

// ── Settings ──────────────────────────────────────────────
app.put('/settings', auth, async (req, res) => {
  try {
    const { username, password, showLastSeen } = req.body;
    const user = await User.findById(req.user.id);
    if (username && username !== user.username) {
      const exists = await User.findOne({ username });
      if (exists) return res.status(409).json({ error: 'Username already taken' });
      const badWords = ['sex','porn','nude','naked','fuck','shit','ass','dick','pussy','cock','boob','nigger','nigga','bitch','slut','whore','rape','xxx','18+','adult','nsfw'];
      if (badWords.some(w => username.toLowerCase().includes(w))) return res.status(400).json({ error: 'Username contains inappropriate content' });
      const oldUsername = user.username;
      user.username = username;
      await User.updateMany({ friends: oldUsername }, { $set: { 'friends.$[el]': username } }, { arrayFilters: [{ 'el': oldUsername }] });
      await User.updateMany({ requests: oldUsername }, { $set: { 'requests.$[el]': username } }, { arrayFilters: [{ 'el': oldUsername }] });
      await Message.updateMany({ sender: oldUsername }, { sender: username });
      await Message.updateMany({ receiver: oldUsername }, { receiver: username });
      user.friends.forEach(f => io.to(f).emit('usernameChanged', { oldUsername, newUsername: username }));
    }
    if (password) user.password = await bcrypt.hash(password, 10);
    if (typeof showLastSeen === 'boolean') user.privacy.showLastSeen = showLastSeen;
    await user.save();
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Updated', token, user: { id: user._id, username: user.username, email: user.email, profilePic: user.profilePic, privacy: user.privacy } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/settings/profile-pic', auth, uploadProfile.single('photo'), async (req, res) => {
  try {
    const url = `${BASE}/uploads/profiles/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user.id, { profilePic: url });
    const user = await User.findById(req.user.id).select('friends');
    user.friends.forEach(f => io.to(f).emit('profilePicChanged', { username: req.user.username, profilePic: url }));
    res.json({ profilePic: url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Friends ───────────────────────────────────────────────
app.get('/users/search', auth, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);
  try {
    const me = await User.findById(req.user.id).select('friends');
    const users = await User.find({ username: { $regex: q, $options: 'i' }, _id: { $ne: req.user.id } })
      .select('username profilePic friends').limit(10);
    res.json(users.map(u => ({ _id: u._id, username: u.username, profilePic: u.profilePic, mutuals: u.friends.filter(f => me.friends.includes(f)).length })));
  } catch { res.status(500).json({ error: 'Search failed' }); }
});

app.get('/users/suggested', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('friends blocked');
    const users = await User.find({ _id: { $ne: req.user.id }, username: { $nin: [...me.blocked] } })
      .select('username profilePic friends').limit(15);
    res.json(users.map(u => ({ _id: u._id, username: u.username, profilePic: u.profilePic, mutuals: u.friends.filter(f => me.friends.includes(f)).length })));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/friends', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('friends requests');
    const friendDetails = await User.find({ username: { $in: me.friends } }).select('username profilePic lastSeen privacy');
    res.json({ friends: me.friends, requests: me.requests, friendDetails });
  } catch { res.status(500).json({ error: 'Failed to fetch' }); }
});

app.post('/friends/request', auth, async (req, res) => {
  const { toUsername } = req.body;
  try {
    const me = await User.findById(req.user.id);
    const target = await User.findOne({ username: toUsername });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (me.friends.includes(toUsername)) return res.status(400).json({ error: 'Already friends' });
    if (target.requests.includes(me.username)) return res.status(400).json({ error: 'Request already sent' });
    target.requests.push(me.username);
    await target.save();
    io.to(toUsername).emit('friendRequest', { from: me.username });
    res.json({ message: 'Request sent' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/friends/accept', auth, async (req, res) => {
  const { fromUsername } = req.body;
  try {
    const me = await User.findById(req.user.id);
    const other = await User.findOne({ username: fromUsername });
    if (!other) return res.status(404).json({ error: 'User not found' });
    me.requests = me.requests.filter(r => r !== fromUsername);
    if (!me.friends.includes(fromUsername)) me.friends.push(fromUsername);
    if (!other.friends.includes(me.username)) other.friends.push(me.username);
    await me.save(); await other.save();
    io.to(fromUsername).emit('requestAccepted', { by: me.username });
    res.json({ message: 'Friend added' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/friends/reject', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    me.requests = me.requests.filter(r => r !== req.body.fromUsername);
    await me.save();
    res.json({ message: 'Rejected' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/friends/unfriend', auth, async (req, res) => {
  const { username } = req.body;
  try {
    const me = await User.findById(req.user.id);
    me.friends = me.friends.filter(f => f !== username);
    await me.save();
    await User.findOneAndUpdate({ username }, { $pull: { friends: me.username } });
    res.json({ message: 'Unfriended' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/friends/block', auth, async (req, res) => {
  const { username } = req.body;
  try {
    const me = await User.findById(req.user.id);
    if (!me.blocked.includes(username)) me.blocked.push(username);
    me.friends = me.friends.filter(f => f !== username);
    me.requests = me.requests.filter(r => r !== username);
    await me.save();
    await User.findOneAndUpdate({ username }, { $pull: { friends: me.username, requests: me.username } });
    res.json({ message: 'Blocked' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/friends/unblock', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { blocked: req.body.username } });
    res.json({ message: 'Unblocked' });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/friends/blocked', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('blocked');
    res.json({ blocked: me.blocked });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.get('/user/:username', auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('username profilePic lastSeen privacy');
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ username: user.username, profilePic: user.profilePic, lastSeen: user.privacy?.showLastSeen ? user.lastSeen : null });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Messages ──────────────────────────────────────────────
app.get('/messages/:otherUsername', auth, async (req, res) => {
  try {
    const msgs = await Message.find({
      $or: [{ sender: req.user.username, receiver: req.params.otherUsername }, { sender: req.params.otherUsername, receiver: req.user.username }],
      deletedFor: { $nin: [req.user.username] },
      deletedForEveryone: { $ne: true }
    }).sort({ createdAt: 1 }).limit(100);
    res.json(msgs);
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/messages/seen', auth, async (req, res) => {
  try {
    const now = new Date();
    await Message.updateMany({ sender: req.body.senderUsername, receiver: req.user.username, seenAt: null }, { seenAt: now });
    io.to(req.body.senderUsername).emit('messagesSeen', { by: req.user.username, at: now });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.post('/messages/:id/react', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const existing = msg.reactions.findIndex(r => r.username === req.user.username);
    if (existing >= 0) {
      if (msg.reactions[existing].emoji === req.body.emoji) msg.reactions.splice(existing, 1);
      else msg.reactions[existing].emoji = req.body.emoji;
    } else { msg.reactions.push({ username: req.user.username, emoji: req.body.emoji }); }
    await msg.save();
    const other = msg.sender === req.user.username ? msg.receiver : msg.sender;
    io.to(other).emit('messageReaction', { msgId: msg._id, reactions: msg.reactions });
    io.to(req.user.username).emit('messageReaction', { msgId: msg._id, reactions: msg.reactions });
    res.json({ reactions: msg.reactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/messages/:id', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    const { type } = req.body;
    if (type === 'everyone' && msg.sender === req.user.username) {
      msg.deletedForEveryone = true;
      msg.text = '';
      msg.fileUrl = null;
      await msg.save();
      const other = msg.receiver === req.user.username ? msg.sender : msg.receiver;
      io.to(other).emit('messageDeleted', { msgId: msg._id, type: 'everyone' });
      io.to(req.user.username).emit('messageDeleted', { msgId: msg._id, type: 'everyone' });
    } else {
      if (!msg.deletedFor.includes(req.user.username)) msg.deletedFor.push(req.user.username);
      await msg.save();
      io.to(req.user.username).emit('messageDeleted', { msgId: msg._id, type: 'me' });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/upload/chat', auth, uploadChat.single('file'), async (req, res) => {
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType = 'file';
    if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) fileType = 'image';
    else if (['.mp4','.mov','.avi','.webm'].includes(ext)) fileType = 'video';
    else if (['.mp3','.wav','.ogg','.m4a'].includes(ext)) fileType = 'audio';
    const url = `${BASE}/uploads/chat/${req.file.filename}`;
    res.json({ fileUrl: url, fileType, fileName: req.file.originalname });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Status ────────────────────────────────────────────────
app.post('/status', auth, uploadStatus.single('file'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const statusData = { type: req.body.type || 'text', content: req.body.content || '' };
    if (req.file) statusData.fileUrl = `${BASE}/uploads/status/${req.file.filename}`;
    user.statuses.push(statusData);
    await user.save();
    res.json({ message: 'Status posted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/statuses', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('friends');
    const users = await User.find({ username: { $in: [...me.friends, req.user.username] } }).select('username profilePic statuses');
    res.json(users.filter(u => u.statuses.length > 0).map(u => ({ username: u.username, profilePic: u.profilePic, statuses: u.statuses })));
  } catch { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/status/:statusId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const status = user.statuses.id(req.params.statusId);
    if (!status) return res.status(404).json({ error: 'Not found' });
    status.deleteOne();
    await user.save();
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/status/:username/:statusId/view', auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: 'Not found' });
    const status = user.statuses.id(req.params.statusId);
    if (!status) return res.status(404).json({ error: 'Status not found' });
    if (!status.views.includes(req.user.username)) { status.views.push(req.user.username); await user.save(); }
    res.json({ views: status.views });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// Auto-purge statuses older than 24h every hour
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({ 'statuses.0': { $exists: true } });
    for (const user of users) {
      const before = user.statuses.length;
      user.statuses = user.statuses.filter(s => new Date(s.createdAt) > cutoff);
      if (user.statuses.length !== before) await user.save();
    }
  } catch (err) { console.error('Auto-purge error:', err.message); }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
