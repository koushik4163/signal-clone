export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface User {
  id: string;
  phone_number: string;
  username: string | null;
  email?: string | null;
  display_name: string;
  avatar_url: string | null;
  about: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface Contact {
  id: string;
  nickname: string | null;
  user: User;
}

export interface Participant {
  user: User;
  role: "member" | "admin";
}

export interface LastMessagePreview {
  content: string | null;
  sender_id: string | null;
  created_at: string | null;
  status: MessageStatus | null;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
  last_message_at: string;
  participants: Participant[];
  last_message: LastMessagePreview | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  status: MessageStatus;
  reply_to_id: string | null;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  reactions?: Record<string, string[]>; // emoji -> [user_id, ...]
  client_temp_id?: string | null;
  is_pinned?: boolean;
}
