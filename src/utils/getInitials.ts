export const getInitials = (userName: string = '', telegramId: number, firstName: string = '', lastName: string = ''): string => {
    // First priority: Check firstName and lastName
    if (firstName && lastName) {
        return `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase()}`;
    }

    // Third priority: Check if username exists
    if (userName) {
        return `${userName.charAt(0).toUpperCase()}${userName.charAt(1)?.toUpperCase() || userName.charAt(0).toUpperCase()}`;
    }

    // Final fallback: Use telegramId
    const idString = telegramId.toString();
    return `${idString.charAt(0)}${idString.charAt(1)}`;
};