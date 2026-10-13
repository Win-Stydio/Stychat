type User = {
    id: number;
    username: string;
    displayName?: string;
    status?: string;
    avatarEmoji?: string;
};
type Message = {
    id: number;
    senderId: number;
    recipientId: number;
    otherUserId?: number;
    body: string;
    createdAt: string;
    readAt?: string | null;
    senderUsername: string;
};
type Group = {
    id: number;
    name: string;
    description: string;
    ownerId: number;
    memberCount: number;
};
type GroupMessage = {
    id: number;
    groupId: number;
    senderId: number;
    body: string;
    createdAt: string;
    senderUsername: string;
    senderDisplayName: string;
};
type Session = {
    token: string;
    user: User;
};
type Tab = 'chats' | 'groups' | 'contacts';
type GroupMember = User & { role: 'owner' | 'member' };

export type { User, Message, Group, GroupMessage, Session, Tab, GroupMember };
