// src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';

interface RewardSource {
  lastCalculated: Date;
  totalAwarded: number;
}

export interface IUser extends Document {
  // Basic user info
  telegramId: number;
  username: string;
  firstName: string;
  lastName: string;
  isPremium: boolean;
  isBot: boolean;
  isFake: boolean;
  isScam: boolean;
  hidden: boolean;
  profilePhoto?: {
    smallFileId: string;    // Small size photo file_id
    largeFileId: string;    // Large size photo file_id
    smallFileUrl: string;   // URL for small photo
    largeFileUrl: string;   // URL for large photo
    lastUpdated: Date;
  };

  // Referral system
  referralCode: string;      // Their unique code to share
  referredByCode?: string;   // Code they used to join (optional)

  // Core metrics
  tokens: number;
  currentStreak: number;
  lastVisit: Date;

  // Rewards tracking
  rewardHistory: {
    dailyCheckin: RewardSource;
    referrals: RewardSource;
    [key: string]: RewardSource;  // Allow for dynamic addition of new reward types
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const RewardSourceSchema = new Schema({
  lastCalculated: { type: Date, default: Date.now },
  totalAwarded: { type: Number, default: 0 }
}, { _id: false });

const UserSchema = new Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String, required: true },
  lastName: { type: String },
  isPremium: { type: Boolean, default: false },
  isBot: { type: Boolean, default: false },
  isFake: { type: Boolean, default: false },
  isScam: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  profilePhoto: {
    smallFileId: String,
    largeFileId: String,
    smallFileUrl: String,
    largeFileUrl: String,
    lastUpdated: Date
  },

  referralCode: { type: String, required: true, unique: true },
  referredByCode: { type: String },

  tokens: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  lastVisit: { type: Date, default: Date.now },

  rewardHistory: {
    dailyCheckin: { type: RewardSourceSchema, default: () => ({}) },
    referrals: { type: RewardSourceSchema, default: () => ({}) }
  }
}, {
  timestamps: true
});

// Index for referral queries
UserSchema.index({ referralCode: 1 }, { unique: true });
UserSchema.index({ referredByCode: 1 });

// Index for general queries
UserSchema.index({ telegramId: 1 }, { unique: true });
UserSchema.index({ username: 1 });

const User = mongoose.model<IUser>('User', UserSchema);

export default User;