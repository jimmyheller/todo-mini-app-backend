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

  // Referral system
  referralCode: string;      // Their unique code to share
  referredByCode?: string;   // Code they used to join (optional)

  // Core metrics
  tokens: number;
  currentStreak: number;
  lastVisit: Date;

  // Rewards tracking
  rewardHistory: {
    accountAge: RewardSource;
    premium: RewardSource;
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

  referralCode: { type: String, required: true, unique: true },
  referredByCode: { type: String },

  tokens: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  lastVisit: { type: Date, default: Date.now },

  rewardHistory: {
    accountAge: { type: RewardSourceSchema, default: () => ({}) },
    premium: { type: RewardSourceSchema, default: () => ({}) },
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