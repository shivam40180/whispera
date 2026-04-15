const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  type: { type: String, enum: ['text','image','video','audio'], default: 'text' },
  content: String,
  fileUrl: String,
  views: [String],
  createdAt: { type: Date, default: Date.now }
});

const schema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  profilePic: { type: String, default: '' },
  friends: [String],
  requests: [String],
  blocked: [String],
  lastSeen: { type: Date, default: Date.now },
  privacy: {
    showLastSeen: { type: Boolean, default: true }
  },
  statuses: [statusSchema],
  isDeactivated: { type: Boolean, default: false },
  deactivateWarning: { type: String, default: '' }
});

module.exports = mongoose.model('User', schema);
