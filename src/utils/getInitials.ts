
export const getInitials = (userName: string): string => {
    return userName.charAt(0).toUpperCase() + userName.charAt(1).toUpperCase();
}