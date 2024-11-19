import User from '../models/User';
import {getInitials} from "./userService";
import {getUserRank} from "../utils/userRank";

interface FriendsResponse {
    total: number;
    user: {
        username: string;
        balance: number;
        rank: string;
        referralCode: string;
        initials: string;
        profilePhoto?: {
            smallFileUrl?: string;
            largeFileUrl?: string;
        };
    };
    friends: Array<{
        username: string;
        balance: number;
        initials: string;
        profilePhoto?: {
            smallFileUrl?: string;
            largeFileUrl?: string;
        };
    }>;
}

export const getUserWithFriends = async (telegramId: number): Promise<FriendsResponse> => {
    try {
        const user = await User.findOne({telegramId});
        if (!user) {
            throw new Error('User not found');
        }

        const rank = await getUserRank(telegramId);

        // Get total count of all friends (referrals)
        const totalFriends = await User.countDocuments({
            referredByCode: user.referralCode
        });

        const friends = await User.find({
            referredByCode: user.referralCode
        })
            .select('username firstName lastName tokens profilePhoto createdAt')
            .sort({createdAt: -1})
            .limit(100);


        return {
            total: totalFriends,
            user: {
                username: user.username,
                balance: user.tokens,
                rank: rank.toString(),
                referralCode: user.referralCode,
                initials: getInitials(user.username),
                profilePhoto: user.profilePhoto ? {
                    smallFileUrl: user.profilePhoto.smallFileUrl,
                    largeFileUrl: user.profilePhoto.largeFileUrl
                } : undefined
            },
            friends: friends.map(friend => ({
                username: friend.username,
                balance: friend.tokens,
                initials: getInitials(friend.username),
                profilePhoto: friend.profilePhoto ? {
                    smallFileUrl: friend.profilePhoto.smallFileUrl,
                    largeFileUrl: friend.profilePhoto.largeFileUrl
                } : undefined
            }))
        };
    } catch (error) {
        console.error('Error in getUserWithFriends:', error);
        throw error;
    }
};