import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username: string;
  firstName: string;
  lastName?: string;
  languageCode?: string;
  isPremium: boolean;
  tokens: number;
  currentStreak: number;
  lastVisit: Date;
  referralCode: string;
  referredBy?: string;
}

const UserSchema: Schema = new Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  languageCode: { type: String },
  isPremium: { type: Boolean, default: false },
  tokens: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  lastVisit: { type: Date, default: Date.now },
  referralCode: { type: String, required: true, unique: true },
  referredBy: { type: String },
});

export default mongoose.model<IUser>('User', UserSchema);