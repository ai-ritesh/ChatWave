import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  auth, 
  db, 
  storage,
  onAuthStateChanged, 
  signInWithPopup, 
  googleProvider, 
  signInAnonymously,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  updateDoc,
  getDocs,
  deleteDoc,
  limit,
  ref,
  uploadBytes,
  getDownloadURL
} from './lib/firebase';
import { 
  MessageCircle, 
  Users, 
  Video, 
  Image as ImageIcon, 
  Send, 
  Plus, 
  LogOut, 
  QrCode, 
  Phone, 
  PhoneOff,
  X, 
  Search, 
  MoreVertical,
  ArrowLeft,
  Camera,
  Mic,
  MicOff,
  VideoOff,
  User,
  Settings,
  Paperclip,
  Play,
  Pause,
  Volume2,
  Maximize2,
  Scan,
  Check,
  Copy,
  Share2,
  Info,
  Trash2,
  FileText,
  Download,
  Code,
  Pin,
  Smile,
  FileCode,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Ban,
  CheckSquare,
  Square,
  ChevronDown,
  UserPlus,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import Peer from 'simple-peer';
import { cn } from './lib/utils';
import { 
  CodeSnippetBlock, 
  CodeSnippetModal, 
  FullscreenCodeModal, 
  CodeData 
} from './components/CodeSnippetViewer';

// Fast local SVG avatar generator (0ms network latency, zero external API dependencies)
export function getAvatarUrl(seed: string, customPhoto?: string): string {
  if (customPhoto && customPhoto.trim() && !customPhoto.includes('dicebear')) {
    return customPhoto;
  }
  const colorPairs = [
    ['#00a884', '#005c4b'],
    ['#0284c7', '#0369a1'],
    ['#8b5cf6', '#6d28d9'],
    ['#d946ef', '#a21caf'],
    ['#f59e0b', '#b45309'],
    ['#10b981', '#047857'],
    ['#ec4899', '#be185d'],
    ['#06b6d4', '#0e7490']
  ];
  let hash = 0;
  const safeSeed = seed || 'CW';
  for (let i = 0; i < safeSeed.length; i++) {
    hash = safeSeed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colorPairs.length;
  const [c1, c2] = colorPairs[colorIndex];
  const initial = (safeSeed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'CW').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g_${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g_${Math.abs(hash)})"/><text x="50" y="55" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Client-side image optimization (resizes to maxDim and compresses to JPEG, typically 50-120KB)
export function compressImage(file: File, maxDim = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(e.target?.result as string);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  isGuest?: boolean;
  isTemporary?: boolean;
  createdAt?: any;
  createdAtMs?: number;
  expiresAt?: number;
  guestCreatedAt?: number;
  blockedUsers?: string[];
}

interface Chat {
  id: string;
  type: 'dm' | 'group';
  name: string;
  participants: string[];
  participantsDetails?: Record<string, { displayName: string; photoURL?: string }>;
  groupCode?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  createdBy?: string;
  clearedAt?: Record<string, any>;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  type: 'text' | 'image' | 'video' | 'file' | 'code' | 'call' | 'audio';
  audioUrl?: string;
  audioDuration?: number;
  code?: string;
  codeLanguage?: string;
  codeTitle?: string;
  codeLineCount?: number;
  reactions?: Record<string, string[]>;
  isPinned?: boolean;
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  createdAt: any;
}

// Helpers for displaying correct name and avatar (Friend's name for direct chats)
const getChatDisplayName = (chat: Chat, currentUserId: string, cachedName?: string): string => {
  if (chat.type === 'group') return chat.name;
  const otherId = chat.participants.find(p => p !== currentUserId);
  if (otherId && chat.participantsDetails?.[otherId]?.displayName) {
    return chat.participantsDetails[otherId].displayName;
  }
  if (cachedName) return cachedName;
  // If stored chat name contains "&", extract other name if possible
  if (chat.name && chat.name.includes('&')) {
    const parts = chat.name.split('&').map(s => s.trim());
    const otherPart = parts.find(p => !p.toLowerCase().includes('you'));
    if (otherPart) return otherPart;
  }
  return chat.name || `User_${otherId?.slice(0, 5) || 'Direct'}`;
};

const getChatAvatar = (chat: Chat, currentUserId: string, cachedPhoto?: string): string => {
  if (chat.type === 'group') return getAvatarUrl(chat.id);
  const otherId = chat.participants.find(p => p !== currentUserId);
  if (otherId && chat.participantsDetails?.[otherId]?.photoURL) {
    return chat.participantsDetails[otherId].photoURL;
  }
  if (cachedPhoto) return cachedPhoto;
  return getAvatarUrl(otherId || chat.id);
};

// --- Components ---

const NameEntryScreen: React.FC<{ onJoin: (user: UserProfile) => void }> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const previewAvatar = useMemo(() => {
    return getAvatarUrl(name.trim() || 'CW');
  }, [name]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to start chatting');
      return;
    }
    if (trimmed.length > 30) {
      setError('Name must be 30 characters or fewer');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Optional anonymous sign-in in background
      let authUid = '';
      try {
        const cred = await signInAnonymously(auth);
        authUid = cred.user.uid;
      } catch (err) {
        console.warn('Anonymous auth omitted or skipped:', err);
      }

      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const uid = authUid || `user_${Date.now().toString(36)}_${uniqueSuffix}`;
      const now = Date.now();
      const expiresAt = now + 2 * 60 * 60 * 1000; // 2 hours

      const profile: UserProfile = {
        uid,
        displayName: trimmed,
        username: trimmed.toLowerCase().replace(/\s+/g, '_'),
        photoURL: getAvatarUrl(uid),
        createdAt: now,
        createdAtMs: now,
        expiresAt: expiresAt,
        isTemporary: true
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', uid), {
        uid: profile.uid,
        displayName: profile.displayName,
        username: profile.username,
        photoURL: profile.photoURL,
        createdAt: serverTimestamp(),
        createdAtMs: now,
        expiresAt: expiresAt,
        isTemporary: true,
        lastActiveAt: serverTimestamp()
      });

      // Save session to localStorage
      localStorage.setItem('chatwave_user_session', JSON.stringify(profile));
      onJoin(profile);
    } catch (err: any) {
      console.error('Failed to create user session', err);
      setError('Unable to join chat. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-[#00a884]/15 blur-[130px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-[#00a884]/10 blur-[130px] rounded-full pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-[#202c33] p-7 sm:p-9 rounded-[2rem] shadow-2xl w-full max-w-md border border-[#3b4a54]/80 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="bg-gradient-to-tr from-[#00a884] to-[#008f6f] p-4 sm:p-5 rounded-3xl mb-4 shadow-xl shadow-[#00a884]/25 relative"
          >
            <MessageCircle className="w-10 h-10 text-white" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#202c33] animate-pulse"></span>
          </motion.div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#e9edef] tracking-tight">ChatWave</h1>
          <p className="text-[#8696a0] text-xs sm:text-sm mt-1.5 font-medium text-center">
            Instant messaging • No email or passwords required
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-xs sm:text-sm mb-6 text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Live Avatar Preview */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-2">
            <img 
              src={previewAvatar} 
              alt="Avatar preview" 
              className="w-20 h-20 rounded-full border-2 border-[#00a884] shadow-lg object-cover transition-all"
            />
            <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#202c33] flex items-center justify-center text-[10px] text-white">
              ✓
            </span>
          </div>
          <span className="text-xs text-[#8696a0] font-mono">
            {name.trim() ? `@${name.trim().toLowerCase().replace(/\s+/g, '_')}` : '@your_username'}
          </span>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#00a884] block mb-2 uppercase tracking-wider">
              Enter Your Name
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="What should we call you? (e.g. Alex, Ritesh)" 
                className="w-full bg-[#2a3942] border border-[#3b4a54] outline-none text-[#e9edef] rounded-xl px-4 py-3.5 text-sm focus:border-[#00a884] transition-all placeholder:text-[#8696a0]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                autoFocus
                required
              />
            </div>
            <p className="text-[11px] text-[#8696a0] mt-1.5 leading-relaxed">
              Your name is your username. Anyone can search your name, chat with you, and add you to groups.
            </p>
          </div>

          {/* 2-Hour ID info card */}
          <div className="bg-[#111b21] p-3 rounded-xl border border-[#3b4a54]/50 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-[11px] text-[#8696a0] leading-snug">
              <span className="font-semibold text-[#e9edef] block">2-Hour Temporary Session</span>
              Your ID and session auto-delete after 2 hours for zero-trace privacy.
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#00a884]/25 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Joining ChatWave...</span>
              </>
            ) : (
              <>
                <span>Start Chatting</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#3b4a54]/40 grid grid-cols-3 gap-2 text-center">
          <div className="text-[10px] text-[#8696a0]">
            <span className="block text-[#e9edef] font-semibold text-xs mb-0.5">🔍 Searchable</span>
            By your name
          </div>
          <div className="text-[10px] text-[#8696a0]">
            <span className="block text-[#e9edef] font-semibold text-xs mb-0.5">👥 Groups</span>
            Add anyone
          </div>
          <div className="text-[10px] text-[#8696a0]">
            <span className="block text-[#e9edef] font-semibold text-xs mb-0.5">⏱️ 2-Hour ID</span>
            Auto-deletes
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const FindPeopleModal: React.FC<{
  user: UserProfile;
  chats: Chat[];
  onClose: () => void;
  onStartChat: (targetUser: UserProfile) => void;
}> = ({
  user,
  chats,
  onClose,
  onStartChat
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const now = Date.now();
        const list: UserProfile[] = [];
        snap.forEach(d => {
          const u = d.data() as UserProfile;
          if (u.uid === user.uid) return;
          if (u.expiresAt && now > u.expiresAt) return;
          list.push({ ...u, photoURL: getAvatarUrl(u.uid, u.photoURL) });
        });
        list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
        if (isMounted) {
          setAllUsers(list);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load users', err);
        if (isMounted) setLoading(false);
      }
    };
    fetchUsers();
    return () => { isMounted = false; };
  }, [user.uid]);

  const filtered = allUsers.filter(u => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (u.displayName || '').toLowerCase().includes(term) || (u.username || '').toLowerCase().includes(term);
  });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-[#202c33] p-6 rounded-2xl w-full max-w-md border border-[#3b4a54] max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e9edef] leading-tight">Find People</h2>
              <p className="text-[11px] text-[#8696a0]">Search any active user by their name</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef] p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Search input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-[#8696a0] absolute left-3 top-3" />
          <input 
            type="text" 
            placeholder="Type a name or username..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111b21] border border-[#3b4a54] text-sm text-[#e9edef] rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-[#00a884] transition placeholder:text-[#8696a0]"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[160px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-[#8696a0] gap-2">
              <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Finding active users...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-[#8696a0]">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium text-[#e9edef] mb-1">
                {searchTerm ? `No users matching "${searchTerm}"` : 'No other users online right now'}
              </p>
              <p className="text-[11px]">
                Tell a friend to open the app, enter their name, and they'll appear here instantly!
              </p>
            </div>
          ) : (
            filtered.map((u) => {
              const hasChat = chats.some(c => c.type === 'dm' && c.participants.includes(u.uid));
              const now = Date.now();
              const timeLeftMin = u.expiresAt ? Math.max(0, Math.floor((u.expiresAt - now) / 60000)) : 120;
              return (
                <div key={u.uid} className="flex items-center justify-between p-2.5 rounded-xl bg-[#111b21] hover:bg-[#182229] border border-[#2e3b43] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={u.photoURL || getAvatarUrl(u.uid)} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#e9edef] truncate">{u.displayName}</p>
                      <p className="text-[11px] text-[#8696a0] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>Active · {timeLeftMin}m left</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onStartChat(u)}
                    className="px-3.5 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{hasChat ? 'Open' : 'Chat'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[#3b4a54]/40 text-center text-[11px] text-[#8696a0]">
          Your name: <span className="text-[#e9edef] font-semibold">{user.displayName}</span> • Anyone can search you by this name
        </div>
      </motion.div>
    </div>
  );
};

const ChatItem: React.FC<{ chat: Chat, active: boolean, onClick: () => void, currentUserId: string, cachedName?: string, cachedPhoto?: string }> = ({ chat, active, onClick, currentUserId, cachedName, cachedPhoto }) => {
  const displayName = getChatDisplayName(chat, currentUserId, cachedName);
  const avatarUrl = getChatAvatar(chat, currentUserId, cachedPhoto);

  return (
    <motion.div 
      whileHover={{ backgroundColor: active ? "rgba(42, 57, 66, 1)" : "rgba(32, 44, 51, 0.7)" }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 p-3.5 cursor-pointer transition-all border-b border-[#202c33]/70 relative select-none",
        active 
          ? "bg-[#2a3942] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-1 before:bg-[#00a884] before:rounded-r-full" 
          : "hover:bg-[#202c33]/60"
      )}
    >
      <div className="relative shrink-0">
        <img 
          src={avatarUrl} 
          className={cn(
            "w-12 h-12 rounded-full bg-[#3b4a54] object-cover transition-transform duration-200",
            active ? "ring-2 ring-[#00a884] shadow-md shadow-[#00a884]/20" : ""
          )} 
          alt={displayName}
        />
        {chat.type === 'dm' ? (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#111b21] rounded-full shadow-sm"></div>
        ) : (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#00a884] text-white rounded-full flex items-center justify-center text-[9px] border border-[#111b21]">
            <Users className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <h3 className={cn("font-medium text-sm truncate", active ? "text-white font-semibold" : "text-[#e9edef]")}>
            {displayName}
          </h3>
          {chat.lastMessageAt && (
            <span className="text-[#8696a0] text-[11px] font-mono shrink-0 ml-2">
              {format(chat.lastMessageAt.toDate ? chat.lastMessageAt.toDate() : new Date(chat.lastMessageAt), 'HH:mm')}
            </span>
          )}
        </div>
        <p className={cn("text-xs truncate leading-relaxed flex items-center gap-1", active ? "text-[#aebac1]" : "text-[#8696a0]")}>
          {chat.lastMessage || (chat.type === 'group' ? '👥 Group ready' : 'Tap to chat')}
        </p>
      </div>
    </motion.div>
  );
};

const VoiceNotePlayer: React.FC<{ 
  audioUrl: string; 
  duration?: number; 
  isOwn: boolean; 
}> = ({ audioUrl, duration = 0, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.warn('Audio play failed', e));
    }
  };

  const cycleRate = () => {
    const rates = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalTime = audioDuration || duration || 0;
  const progressPercent = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/25 max-w-[280px] sm:max-w-[320px] my-1 backdrop-blur-sm border border-white/5">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        type="button"
        onClick={togglePlay}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 shadow-md",
          isOwn ? "bg-white text-[#005c4b] hover:bg-white/90" : "bg-[#00a884] text-white hover:bg-[#008f6f]"
        )}
        title={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
      </motion.button>

      <div className="flex-1 min-w-0">
        <div className="relative flex items-center h-6">
          {/* Animated dynamic waveform bars */}
          <div className="absolute inset-0 flex items-center gap-0.5 pointer-events-none">
            {[40, 75, 30, 90, 60, 40, 80, 50, 100, 45, 65, 85, 30, 75, 45, 95, 55, 35, 70, 50].map((h, i) => {
              const active = (i / 20) * 100 <= progressPercent;
              return (
                <motion.div 
                  key={i} 
                  className={cn(
                    "flex-1 rounded-full transition-colors",
                    active ? (isOwn ? "bg-white" : "bg-[#00a884]") : "bg-white/25"
                  )}
                  animate={isPlaying ? {
                    height: [`${Math.max(20, h * 0.45)}%`, `${Math.min(100, h * 1.2)}%`, `${h}%`]
                  } : {
                    height: `${h}%`
                  }}
                  transition={isPlaying ? {
                    repeat: Infinity,
                    duration: 0.5 + (i % 4) * 0.12,
                    ease: "easeInOut"
                  } : { duration: 0.2 }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min="0"
            max={totalTime || 1}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full opacity-0 cursor-pointer h-6 z-10"
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-[#8696a0] mt-0.5 select-none">
          <span className="font-mono text-[#e9edef]">{formatSeconds(isPlaying ? currentTime : totalTime)}</span>
          <div className="flex items-center gap-1.5">
            <Mic className="w-3 h-3 text-[#00a884]" />
            <button 
              type="button" 
              onClick={cycleRate}
              className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 text-[#e9edef] font-mono font-medium text-[10px] transition active:scale-95"
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{ 
  message: Message; 
  isOwn: boolean; 
  onImageClick?: (url: string) => void;
  onOpenFullscreenCode?: (data: CodeData) => void;
  onReact?: (msgId: string, emoji: string) => void;
  onTogglePin?: (msgId: string, currentPin?: boolean) => void;
  onDeleteMessage?: (msg: Message) => void;
  currentUserId?: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (msgId: string) => void;
}> = ({ 
  message, 
  isOwn, 
  onImageClick, 
  onOpenFullscreenCode,
  onReact,
  onTogglePin,
  onDeleteMessage,
  currentUserId,
  isSelectMode,
  isSelected,
  onToggleSelect
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBubbleMenu, setShowBubbleMenu] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // Check if standard text contains markdown code block (```lang ... ```)
  const isMarkdownCode = useMemo(() => {
    if (message.type !== 'text' || !message.text) return false;
    const trimmed = message.text.trim();
    return trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.length > 6;
  }, [message.type, message.text]);

  const parsedMarkdownCode = useMemo(() => {
    if (!isMarkdownCode || !message.text) return null;
    const match = message.text.trim().match(/^```([a-zA-Z0-9_-]*)\n?([\s\S]+)```$/);
    if (match) {
      return {
        language: match[1] || 'typescript',
        code: match[2].trim()
      };
    }
    return null;
  }, [isMarkdownCode, message.text]);

  // If message was deleted for everyone (WhatsApp style)
  if (message.deletedForEveryone) {
    return (
      <div className={cn("flex mb-2 items-center gap-2", isOwn ? "justify-end" : "justify-start")}>
        {isSelectMode && (
          <button 
            type="button"
            onClick={() => onToggleSelect?.(message.id)}
            className="text-[#8696a0] hover:text-[#e9edef] p-1"
          >
            {isSelected ? <CheckSquare className="w-4 h-4 text-[#00a884]" /> : <Square className="w-4 h-4" />}
          </button>
        )}
        <div className={cn(
          "px-4 py-2 rounded-2xl text-xs italic flex items-center gap-2 border border-white/5 select-none",
          isOwn ? "bg-[#005c4b]/50 text-[#8696a0]" : "bg-[#202c33]/70 text-[#8696a0]"
        )}>
          <Trash2 className="w-3.5 h-3.5 text-[#8696a0]" />
          <span>🚫 This message was deleted</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: isOwn ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("flex mb-3.5 group relative items-center gap-2", isOwn ? "justify-end" : "justify-start")}
    >
      {/* Multi-Select Checkbox for Batch Deleting particular messages */}
      {isSelectMode && (
        <button 
          type="button"
          onClick={() => onToggleSelect?.(message.id)}
          className="text-[#8696a0] hover:text-[#e9edef] p-1 transition"
          title="Select this message"
        >
          {isSelected ? <CheckSquare className="w-5 h-5 text-[#00a884]" /> : <Square className="w-5 h-5" />}
        </button>
      )}

      <div className={cn(
        "max-w-[94%] sm:max-w-[85%] md:max-w-[75%] p-3 rounded-2xl shadow-md relative group/bubble",
        isOwn ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none" : "bg-[#202c33] text-[#e9edef] rounded-tl-none"
      )}>
        {/* Pinned Badge */}
        {message.isPinned && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#00a884] mb-1.5 pb-1 border-b border-white/10">
            <Pin className="w-3 h-3 text-[#00a884] fill-[#00a884]" />
            <span>Pinned Message</span>
          </div>
        )}

        {!isOwn && <p className="text-xs font-bold text-[#00a884] mb-1.5">{message.senderName}</p>}

        {/* Voice Note Audio Player */}
        {(message.type === 'audio' || message.audioUrl) && (
          <VoiceNotePlayer 
            audioUrl={message.audioUrl!} 
            duration={message.audioDuration} 
            isOwn={isOwn} 
          />
        )}

        {/* Code Snippet Message or Previewable Code File */}
        {((message.type === 'code' && (message.code || message.text)) || (message.code && (message.type === 'file' || showFilePreview))) && (
          <div className="my-1">
            <CodeSnippetBlock
              code={message.code || message.text || ''}
              language={message.codeLanguage || 'typescript'}
              title={message.codeTitle || message.fileName}
              onOpenFullscreen={onOpenFullscreenCode}
            />
          </div>
        )}

        {/* Markdown Code Block inside standard text */}
        {parsedMarkdownCode && (
          <div className="my-1">
            <CodeSnippetBlock
              code={parsedMarkdownCode.code}
              language={parsedMarkdownCode.language}
              onOpenFullscreen={onOpenFullscreenCode}
            />
          </div>
        )}

        {/* Image Attachment */}
        {message.type === 'image' && message.imageUrl && (
          <div 
            onClick={() => onImageClick?.(message.imageUrl!)}
            className="relative group mb-2 cursor-pointer rounded-xl overflow-hidden"
          >
            <img 
              src={message.imageUrl} 
              className="rounded-xl max-w-full max-h-80 object-cover" 
              alt="Shared" 
              referrerPolicy="no-referrer" 
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
              <Maximize2 className="text-white w-7 h-7 drop-shadow" />
            </div>
          </div>
        )}

        {/* Video Attachment */}
        {message.type === 'video' && message.videoUrl && (
          <div className="relative group rounded-xl overflow-hidden mb-2 bg-black/40">
            <video src={message.videoUrl} className="max-w-full max-h-80 rounded-xl" controls />
          </div>
        )}

        {/* File Attachment Card (with direct preview toggle if code/text) */}
        {message.type === 'file' && message.fileUrl && !message.code && (
          <div className="p-3 bg-black/25 rounded-xl mb-2 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#00a884]/20 rounded-lg text-[#00a884]">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e9edef] truncate">{message.fileName || 'Attachment'}</p>
                {message.fileSize && (
                  <p className="text-[11px] text-[#8696a0]">
                    {(message.fileSize / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <a 
                  href={message.fileUrl} 
                  download={message.fileName || 'file'} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-2 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] rounded-lg transition"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Standard Text (if not a standalone code block or voice note) */}
        {!parsedMarkdownCode && message.type !== 'code' && message.type !== 'audio' && message.text && (
          <p className="text-[14px] leading-relaxed pr-14 break-words whitespace-pre-wrap">{message.text}</p>
        )}

        {/* WhatsApp-Style Reaction Chips */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-1 border-t border-white/10">
            {Object.entries(message.reactions).map(([emoji, uids]) => {
              if (!uids || uids.length === 0) return null;
              const hasReacted = currentUserId ? uids.includes(currentUserId) : false;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact?.(message.id, emoji)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition shadow-sm",
                    hasReacted 
                      ? "bg-[#00a884]/30 border border-[#00a884] text-white font-medium" 
                      : "bg-[#111b21]/80 hover:bg-[#111b21] border border-[#3b4a54] text-[#e9edef]"
                  )}
                  title={`${uids.length} reactions - click to toggle`}
                >
                  <span>{emoji}</span>
                  <span className="font-mono text-[10px]">{uids.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Timestamp & Status */}
        <div className="flex items-center gap-1 absolute bottom-1.5 right-2.5 select-none">
          <span className="text-[10px] text-[#8696a0]">
            {message.createdAt ? format(message.createdAt.toDate ? message.createdAt.toDate() : new Date(message.createdAt), 'HH:mm') : ''}
          </span>
          {isOwn && <Check className="w-3 h-3 text-[#53bdeb]" />}
        </div>

        {/* Quick Menu Dropdown Chevron on the message bubble (WhatsApp Style) */}
        <div className="absolute top-1.5 right-1.5 z-20">
          <button
            type="button"
            onClick={() => setShowBubbleMenu(!showBubbleMenu)}
            className="opacity-0 group-hover/bubble:opacity-100 focus:opacity-100 p-1 text-[#8696a0] hover:text-[#e9edef] rounded-md transition"
            title="Message options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {showBubbleMenu && (
            <div className="absolute right-0 top-6 w-44 bg-[#182229] border border-[#3b4a54] rounded-xl shadow-2xl py-1 z-30 text-xs">
              <button
                type="button"
                onClick={() => {
                  onDeleteMessage?.(message);
                  setShowBubbleMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-red-400 hover:bg-[#202c33] flex items-center gap-2 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete message</span>
              </button>
              {message.text && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(message.text || '');
                    setShowBubbleMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-[#e9edef] hover:bg-[#202c33] flex items-center gap-2 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-[#8696a0]" />
                  <span>Copy text</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onTogglePin?.(message.id, message.isPinned);
                  setShowBubbleMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-[#e9edef] hover:bg-[#202c33] flex items-center gap-2 transition"
              >
                <Pin className="w-3.5 h-3.5 text-[#8696a0]" />
                <span>{message.isPinned ? 'Unpin message' : 'Pin message'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Hover Quick Action Buttons (Reactions, Pin & WhatsApp Delete) */}
        <div className={cn(
          "absolute -top-3.5 z-20 hidden group-hover/bubble:flex items-center gap-1 bg-[#182229] border border-[#3b4a54] rounded-full px-2 py-0.5 shadow-xl",
          isOwn ? "right-2" : "left-2"
        )}>
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:text-[#00a884] text-[#8696a0] transition"
              title="Add reaction (WhatsApp style)"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-6 left-0 flex items-center gap-1 bg-[#111b21] border border-[#3b4a54] rounded-full px-2 py-1 shadow-2xl z-30 animate-in fade-in">
                {reactionEmojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact?.(message.id, emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="hover:scale-125 transition-transform px-1 py-0.5 text-base"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pin Button */}
          <button
            type="button"
            onClick={() => onTogglePin?.(message.id, message.isPinned)}
            className="p-1 hover:text-[#00a884] text-[#8696a0] transition"
            title={message.isPinned ? "Unpin message" : "Pin message"}
          >
            <Pin className={cn("w-3.5 h-3.5", message.isPinned && "text-[#00a884] fill-[#00a884]")} />
          </button>

          {/* WhatsApp Delete Button for this particular text */}
          <button
            type="button"
            onClick={() => onDeleteMessage?.(message)}
            className="p-1 hover:text-red-400 text-[#8696a0] transition"
            title="Delete this message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const ProfileModal = ({ 
  user, 
  onClose, 
  onUpdate, 
  showNotification,
  onToggleBlock,
  usersCache,
  remainingSeconds,
  onDeleteSession
}: { 
  user: UserProfile, 
  onClose: () => void, 
  onUpdate: (data: Partial<UserProfile>) => void, 
  showNotification: (msg: string) => void,
  onToggleBlock?: (uid: string) => void,
  usersCache?: Record<string, any>,
  remainingSeconds?: number | null,
  onDeleteSession?: () => void
}) => {
  const [name, setName] = useState(user.displayName);
  const [photo, setPhoto] = useState(user.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direct Profile URL for sharing
  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/?user=${user.uid}` : '';

  const handleCopyProfileUrl = () => {
    if (profileUrl) {
      navigator.clipboard.writeText(profileUrl).then(() => {
        setCopiedLink(true);
        showNotification('Profile URL copied to clipboard!');
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(() => {
        showNotification('Failed to copy. Please select and copy manually.');
      });
    }
  };

  const handleCopyUid = () => {
    if (user.uid) {
      navigator.clipboard.writeText(user.uid).then(() => {
        setCopiedUid(true);
        showNotification('User ID copied to clipboard!');
        setTimeout(() => setCopiedUid(false), 2000);
      }).catch(() => {
        showNotification('Failed to copy. Please select and copy manually.');
      });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 0.8);
      setPhoto(compressed);
      showNotification('Avatar photo updated!');
    } catch (err) {
      console.warn('Failed to compress avatar photo', err);
      showNotification('Failed to load image file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: name,
        photoURL: photo
      });
      onUpdate({ displayName: name, photoURL: photo });
      showNotification('Profile updated successfully!');
      onClose();
    } catch (err) {
      console.error('Failed to update profile', err);
      showNotification('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#202c33] p-6 rounded-2xl w-full max-w-sm border border-[#3b4a54] max-h-[92vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#e9edef]">Profile Settings</h2>
            <p className="text-xs text-[#8696a0]">Your name is your username on ChatWave</p>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]"><X className="w-5 h-5" /></button>
        </div>

        {/* 2-Hour ID Lifetime Countdown */}
        <div className="mb-4 bg-[#111b21] p-3 rounded-xl border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div>
              <p className="text-xs font-semibold text-[#e9edef]">2-Hour Temporary ID</p>
              <p className="text-[10px] text-[#8696a0]">Auto-deletes when timer ends</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-lg">
            {remainingSeconds !== null && remainingSeconds !== undefined
              ? `${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s`
              : '2 hours'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-2">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer"
              title="Click to choose profile picture"
            >
              <img src={getAvatarUrl(user.uid, photo)} className="w-24 h-24 rounded-full mb-2 border-2 border-[#00a884] object-cover shadow-lg" alt="Preview" />
              <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="text-white w-6 h-6" />
              </div>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handlePhotoUpload}
            />
            <div className="flex items-center gap-2 mt-1">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className="text-xs text-[#00a884] hover:underline font-medium"
              >
                Upload Photo
              </button>
              <span className="text-[#8696a0] text-xs">•</span>
              <button 
                type="button" 
                onClick={() => setPhoto('')} 
                className="text-xs text-[#8696a0] hover:text-[#e9edef]"
              >
                Reset Avatar
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#00a884] font-medium block mb-1">Display Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#2a3942] border border-[#3b4a54] outline-none text-[#e9edef] rounded-lg px-3.5 py-2 text-sm focus:border-[#00a884] transition"
              placeholder="Your name"
              required
            />
          </div>

          {/* User ID section */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#00a884] font-medium">Your User ID</label>
              {copiedUid && (
                <span className="text-[11px] text-[#00a884] font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Copied!
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-[#111b21] rounded-lg p-2 border border-[#3b4a54]">
              <input 
                type="text" 
                readOnly 
                value={user.uid}
                className="w-full bg-transparent border-none outline-none text-[#e9edef] text-xs font-mono select-all truncate"
              />
              <button 
                type="button" 
                onClick={handleCopyUid}
                className="px-3 py-1.5 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] text-xs font-semibold rounded-md flex items-center gap-1.5 transition shrink-0"
                title="Copy User ID"
              >
                {copiedUid ? <Check className="w-3.5 h-3.5 text-[#00a884]" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUid ? 'Copied' : 'Copy ID'}
              </button>
            </div>
            <p className="text-[#8696a0] text-[11px] mt-1">Friends can paste this User ID directly in their scanner to chat with you.</p>
          </div>

          {/* Profile URL section */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-[#00a884] font-medium">Your Profile Link</label>
              {copiedLink && (
                <span className="text-[11px] text-[#00a884] font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Copied!
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-[#111b21] rounded-lg p-2 border border-[#3b4a54]">
              <input 
                type="text" 
                readOnly 
                value={profileUrl}
                className="w-full bg-transparent border-none outline-none text-[#e9edef] text-xs font-mono select-all truncate"
              />
              <button 
                type="button" 
                onClick={handleCopyProfileUrl}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition shrink-0"
                title="Copy Profile URL"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
            </div>
            <p className="text-[#8696a0] text-[11px] mt-1">Others can open this link to message you directly.</p>
          </div>

          {/* Blocked Contacts Section */}
          <div className="bg-[#111b21] p-3 rounded-xl border border-[#3b4a54]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[#00a884] font-medium flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-red-400" />
                <span>Blocked Contacts ({user.blockedUsers?.length || 0})</span>
              </label>
            </div>
            {user.blockedUsers && user.blockedUsers.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {user.blockedUsers.map((blockedUid) => (
                  <div key={blockedUid} className="flex items-center justify-between p-1.5 rounded-lg bg-[#202c33] text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={getAvatarUrl(blockedUid, usersCache?.[blockedUid]?.photoURL)} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                      <span className="text-[#e9edef] truncate font-medium">{usersCache?.[blockedUid]?.displayName || `User (${blockedUid.slice(0, 5)})`}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleBlock?.(blockedUid)}
                      className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-medium rounded text-[10px] transition shrink-0"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#8696a0]">No blocked contacts. You can block contacts directly from their chat info.</p>
            )}
          </div>

          <div className="bg-[#111b21] p-4 rounded-xl flex flex-col items-center border border-[#3b4a54]">
            <p className="text-[#00a884] text-xs font-bold mb-2.5 uppercase tracking-wider">Your Personal QR Code</p>
            <div className="bg-white p-2.5 rounded-xl shadow-md">
              <QRCodeSVG value={profileUrl || user.uid} size={130} />
            </div>
            <p className="text-[#8696a0] text-[10px] mt-2 text-center">Anyone can scan this to start a direct chat with you</p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#00a884] text-white font-bold py-2.5 rounded-xl hover:bg-[#008f6f] transition disabled:opacity-50 text-sm shadow-md"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>

          {onDeleteSession && (
            <button 
              type="button"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete your temporary ID and exit? All profile data will be permanently deleted.")) {
                  onClose();
                  onDeleteSession();
                }
              }}
              className="w-full py-2.5 px-4 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-medium text-xs rounded-xl border border-red-500/30 transition flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>End Session & Delete My ID Now</span>
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
};

const ContactProfileModal: React.FC<{ 
  contact?: { uid: string; displayName: string; photoURL?: string }; 
  user?: { uid: string; displayName: string; photoURL?: string }; 
  currentUserId?: string;
  isBlocked: boolean; 
  onToggleBlock: (uid: string) => void; 
  onClose: () => void; 
  onStartCall?: () => void;
  showNotification?: (msg: string) => void; 
}> = ({ contact, user, isBlocked, onToggleBlock, onClose, onStartCall, showNotification }) => {
  const target = contact || user || { uid: '', displayName: 'Unknown' };
  const [copiedUid, setCopiedUid] = useState(false);
  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/?user=${target.uid}` : '';

  const handleCopyUid = () => {
    navigator.clipboard.writeText(target.uid).then(() => {
      setCopiedUid(true);
      showNotification?.('User ID copied to clipboard!');
      setTimeout(() => setCopiedUid(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-[#202c33] p-6 rounded-2xl w-full max-w-sm border border-[#3b4a54] max-h-[92vh] overflow-y-auto space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#e9edef]">Contact Info</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <img 
              src={getAvatarUrl(target.uid, target.photoURL)} 
              className={cn("w-24 h-24 rounded-full object-cover shadow-lg border-2", isBlocked ? "border-red-500/80" : "border-[#00a884]")} 
              alt={target.displayName} 
            />
            {isBlocked && (
              <span className="absolute bottom-0 right-0 p-1 bg-red-500 text-white rounded-full shadow">
                <Ban className="w-4 h-4" />
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-[#e9edef] flex items-center gap-1.5">
            {target.displayName}
          </h3>
          {isBlocked ? (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold mt-1">
              Blocked Contact
            </span>
          ) : (
            <span className="text-xs text-[#8696a0] mt-0.5">ChatWave Contact</span>
          )}
        </div>

        {/* Quick Voice Call button from profile */}
        {!isBlocked && onStartCall && (
          <button
            type="button"
            onClick={onStartCall}
            className="w-full py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition shadow-md"
          >
            <Phone className="w-4 h-4" />
            <span>Voice Call {target.displayName}</span>
          </button>
        )}

        {/* User ID */}
        <div className="bg-[#111b21] p-3 rounded-xl border border-[#3b4a54] space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[#8696a0]">User ID</span>
            <button 
              onClick={handleCopyUid}
              className="text-[#00a884] hover:underline flex items-center gap-1 font-medium"
            >
              {copiedUid ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedUid ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs font-mono text-[#e9edef] select-all truncate">{target.uid}</p>
        </div>

        {/* QR Code */}
        <div className="bg-[#111b21] p-3.5 rounded-xl flex flex-col items-center border border-[#3b4a54]">
          <div className="bg-white p-2 rounded-lg shadow-sm mb-2">
            <QRCodeSVG value={profileUrl || target.uid} size={110} />
          </div>
          <p className="text-[11px] text-[#8696a0]">Direct conversation QR</p>
        </div>

        {/* Block / Unblock Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onToggleBlock(target.uid)}
            className={cn(
              "w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md",
              isBlocked 
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40" 
                : "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40"
            )}
          >
            {isBlocked ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Unblock Contact</span>
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                <span>Block Contact</span>
              </>
            )}
          </button>
          <p className="text-[11px] text-[#8696a0] text-center mt-1.5">
            {isBlocked 
              ? 'Unblocking will allow you and this user to message and voice call each other.' 
              : 'Blocked contacts cannot call you or send you messages.'}
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const VoiceNoteRecorder: React.FC<{
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  showNotification?: (msg: string) => void;
}> = ({ onSend, onCancel, showNotification }) => {
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showNotification?.('Microphone recording is not supported in this browser.');
      onCancel();
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (!isMounted) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(200);
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }).catch((err) => {
      console.warn('Microphone permission denied', err);
      showNotification?.('Microphone access denied. Please allow microphone permissions.');
      onCancel();
    });

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handleStopAndSend = () => {
    if (!mediaRecorderRef.current) return;
    const dur = seconds;
    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      onSend(audioBlob, dur);
    };
    try { mediaRecorderRef.current.stop(); } catch (e) {}
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex-1 flex items-center justify-between bg-[#1f2c34] rounded-2xl px-4 py-2 text-[#e9edef] border border-red-500/30 shadow-lg shadow-red-500/5"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500 animate-ping absolute opacity-70"></div>
          <div className="w-3 h-3 rounded-full bg-red-500 relative z-10 shadow-sm shadow-red-500"></div>
        </div>
        <span className="text-red-400 font-mono font-bold text-sm tracking-wide">{formatTime(seconds)}</span>
        
        {/* Animated Sound Wave Visualizer while recording */}
        <div className="flex items-center gap-1 h-5 px-1">
          {[14, 26, 16, 28, 12, 22, 10, 25, 18, 15, 24, 12].map((h, idx) => (
            <motion.div
              key={idx}
              animate={{ height: [6, h, 8, Math.max(8, h * 0.75), 6] }}
              transition={{ repeat: Infinity, duration: 0.65, delay: idx * 0.07, ease: "easeInOut" }}
              className="w-1 bg-red-400/85 rounded-full"
            />
          ))}
        </div>
        <span className="text-xs text-[#8696a0] hidden md:inline font-medium">Recording voice note...</span>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={handleCancelRecording}
          className="p-2 text-[#8696a0] hover:text-red-400 hover:bg-red-500/10 rounded-full transition"
          title="Discard recording"
        >
          <Trash2 className="w-5 h-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={handleStopAndSend}
          className="p-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full transition shadow-md shadow-[#00a884]/25 flex items-center justify-center"
          title="Send voice note"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const QRScannerModal = ({ onClose, onScan, showNotification }: { onClose: () => void, onScan: (uid: string) => void, showNotification?: (msg: string) => void }) => {
  const [loadingScanner, setLoadingScanner] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanAndScan = (rawText: string) => {
    let clean = rawText.trim();
    if (clean.includes('?user=')) {
      const match = clean.match(/[?&]user=([^&]+)/);
      if (match && match[1]) clean = decodeURIComponent(match[1]);
    } else if (clean.includes('?chatWith=')) {
      const match = clean.match(/[?&]chatWith=([^&]+)/);
      if (match && match[1]) clean = decodeURIComponent(match[1]);
    } else if (clean.includes('?join=')) {
      const match = clean.match(/[?&]join=([^&]+)/);
      if (match && match[1]) clean = decodeURIComponent(match[1]);
    } else if (clean.includes('/u/')) {
      const parts = clean.split('/u/');
      if (parts[1]) clean = parts[1].split(/[?#/]/)[0];
    }
    // Strip quotes and trailing slashes if accidentally pasted
    clean = clean.replace(/['"]/g, '').replace(/\/+$/, '').trim();
    onScan(clean);
  };

  useEffect(() => {
    let html5QrCode: any = null;
    let isMounted = true;

    // Load html5-qrcode
    import('html5-qrcode')
      .then(({ Html5Qrcode }) => {
        if (!isMounted) return;
        const readerElement = document.getElementById('qr-reader');
        if (!readerElement) {
          if (isMounted) {
            setLoadingScanner(false);
            setCameraError(true);
          }
          return;
        }

        const scanner = new Html5Qrcode('qr-reader');
        html5QrCode = scanner;

        scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            scanner.stop().then(() => {
              cleanAndScan(decodedText);
            }).catch(() => {
              cleanAndScan(decodedText);
            });
          },
          () => {} // Frame scanning errors are benign
        )
        .then(() => {
          if (isMounted) setLoadingScanner(false);
        })
        .catch((err: any) => {
          console.warn('Camera scanner initialization failed:', err);
          if (isMounted) {
            setLoadingScanner(false);
            setCameraError(true);
          }
        });
      })
      .catch((err) => {
        console.error('Failed to load Html5Qrcode', err);
        if (isMounted) {
          setLoadingScanner(false);
          setCameraError(true);
        }
      });

    return () => {
      isMounted = false;
      if (html5QrCode) {
        try {
          html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
        } catch (e) {
          console.warn('Error clearing scanner', e);
        }
      }
    };
  }, []);

  const handleFileUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      // Create hidden element if needed
      let cacheEl = document.getElementById('qr-file-cache');
      if (!cacheEl) {
        cacheEl = document.createElement('div');
        cacheEl.id = 'qr-file-cache';
        cacheEl.style.display = 'none';
        document.body.appendChild(cacheEl);
      }
      const fileScanner = new Html5Qrcode('qr-file-cache');
      const decodedText = await fileScanner.scanFile(file, true);
      fileScanner.clear();
      showNotification('QR code recognized from image!');
      cleanAndScan(decodedText);
    } catch (err) {
      console.warn('File scan failed', err);
      showNotification('No QR code found in selected image. Please try another image or enter ID.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    cleanAndScan(manualCode);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#202c33] p-6 rounded-2xl w-full max-w-md border border-[#3b4a54] max-h-[92vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-[#00a884]" />
            <h2 className="text-xl font-bold text-[#e9edef]">Scan QR Code</h2>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]"><X className="w-5 h-5" /></button>
        </div>

        {/* Camera container */}
        <div className="overflow-hidden rounded-xl bg-black min-h-[240px] flex items-center justify-center relative border border-[#3b4a54]">
          <div id="qr-reader" className="w-full h-full min-h-[240px]" />
          
          {loadingScanner && !cameraError && (
            <div className="absolute inset-0 bg-[#111b21] flex flex-col items-center justify-center gap-2 text-[#8696a0] p-6">
              <div className="w-8 h-8 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-medium">Starting camera...</p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 bg-[#111b21] flex flex-col items-center justify-center p-6 text-center">
              <Camera className="w-10 h-10 text-[#8696a0] mb-2" />
              <p className="text-sm font-semibold text-[#e9edef] mb-1">Camera is restricted or unavailable</p>
              <p className="text-xs text-[#8696a0] mb-4">You can still upload a QR code image or enter the User ID manually below.</p>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <ImageIcon className="w-4 h-4" /> Upload QR Code Image
              </button>
            </div>
          )}
        </div>

        {/* Alternate actions */}
        <div className="mt-4 space-y-3">
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileUploadScan} 
          />

          {!cameraError && (
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] text-xs font-medium rounded-lg flex items-center justify-center gap-2 border border-[#3b4a54] transition"
            >
              <ImageIcon className="w-4 h-4 text-[#00a884]" /> Choose QR Image from Gallery
            </button>
          )}

          {/* Manual Entry */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-[#3b4a54]">
            <label className="text-xs text-[#8696a0] block mb-1.5 font-medium">Or enter User ID, Profile link, or Group code manually:</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="User ID (e.g. 9VzYk...) or profile link..."
                className="flex-1 bg-[#111b21] border border-[#3b4a54] outline-none text-xs text-[#e9edef] rounded-lg px-3 py-2 font-mono focus:border-[#00a884]"
              />
              <button 
                type="submit"
                disabled={!manualCode.trim()}
                className="bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold px-4 py-2 rounded-lg transition disabled:opacity-50 shrink-0"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const GroupInfoModal = ({ 
  chat, 
  user, 
  onClose, 
  onLeave, 
  onCopyInvite,
  showNotification,
  onAddMember,
  activeUsers = []
}: { 
  chat: Chat, 
  user: UserProfile, 
  onClose: () => void, 
  onLeave: () => void,
  onCopyInvite: () => void,
  showNotification: (msg: string) => void,
  onAddMember?: (member: UserProfile) => void,
  activeUsers?: UserProfile[]
}) => {
  const [participants, setParticipants] = useState<{ uid: string, displayName: string, photoURL?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchParticipants = async () => {
      try {
        const userPromises = chat.participants.map(async (uid) => {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            return { uid, displayName: data.displayName || 'User', photoURL: data.photoURL };
          }
          return { uid, displayName: uid === user.uid ? (user.displayName || 'You') : `User (${uid.slice(0, 5)})` };
        });
        const users = await Promise.all(userPromises);
        if (isMounted) {
          setParticipants(users);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load participants', err);
        if (isMounted) setLoading(false);
      }
    };
    fetchParticipants();
    return () => { isMounted = false; };
  }, [chat.participants]);

  const candidatesToAdd = activeUsers.filter(u => 
    !chat.participants.includes(u.uid) && 
    (!memberSearch.trim() || (u.displayName || '').toLowerCase().includes(memberSearch.toLowerCase().trim()))
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#202c33] p-6 rounded-2xl w-full max-w-md border border-[#3b4a54] max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#e9edef]">{chat.type === 'group' ? 'Group Info' : 'Chat Info'}</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-5">
          <div className="flex flex-col items-center text-center">
            <img src={getAvatarUrl(chat.id)} className="w-20 h-20 rounded-full object-cover border-2 border-[#00a884] mb-3 shadow-lg" alt={chat.name} />
            <h3 className="text-lg font-bold text-[#e9edef]">{chat.name}</h3>
            <p className="text-xs text-[#8696a0]">{chat.type === 'group' ? `Group • ${chat.participants.length} participants` : 'Direct Conversation'}</p>
          </div>

          {chat.type === 'group' && chat.groupCode && (
            <div className="bg-[#111b21] p-4 rounded-xl border border-[#3b4a54] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#00a884] font-semibold uppercase tracking-wider">Group Code</span>
                <button 
                  onClick={onCopyInvite}
                  className="text-xs text-[#00a884] hover:underline flex items-center gap-1 font-medium"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </button>
              </div>
              <p className="text-xl font-mono font-bold text-[#e9edef] tracking-widest">{chat.groupCode}</p>
              <p className="text-[11px] text-[#8696a0]">Share this code or invite link so others can join this group.</p>
            </div>
          )}

          {chat.type === 'group' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
                  Participants ({chat.participants.length})
                </h4>
                {onAddMember && (
                  <button
                    type="button"
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="text-xs text-[#00a884] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddMember ? 'Cancel' : 'Add by Name'}</span>
                  </button>
                )}
              </div>

              {/* Add member inline drawer */}
              {showAddMember && (
                <div className="mb-3 p-3 bg-[#111b21] rounded-xl border border-[#3b4a54] space-y-2">
                  <p className="text-xs font-semibold text-[#e9edef]">Search active users to add:</p>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-2.5 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Type name..." 
                      value={memberSearch} 
                      onChange={e => setMemberSearch(e.target.value)} 
                      className="w-full bg-[#202c33] border border-[#3b4a54] text-xs text-[#e9edef] rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-[#00a884]" 
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {candidatesToAdd.length === 0 ? (
                      <p className="text-[11px] text-[#8696a0] text-center py-2">No users to add</p>
                    ) : (
                      candidatesToAdd.map(cand => (
                        <div key={cand.uid} className="flex items-center justify-between p-1.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={cand.photoURL || getAvatarUrl(cand.uid)} className="w-5 h-5 rounded-full object-cover" alt="" />
                            <span className="text-[#e9edef] truncate font-medium">{cand.displayName}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              onAddMember?.(cand);
                              setShowAddMember(false);
                            }} 
                            className="px-2 py-0.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded text-[10px] font-semibold transition"
                          >
                            Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {participants.map((p) => (
                  <div key={p.uid} className="flex items-center justify-between p-2 rounded-lg bg-[#111b21] border border-[#2a3942]">
                    <div className="flex items-center gap-2.5">
                      <img src={getAvatarUrl(p.uid, p.photoURL)} className="w-8 h-8 rounded-full object-cover" alt="" />
                      <div>
                        <p className="text-sm font-medium text-[#e9edef]">{p.displayName} {p.uid === user.uid && '(You)'}</p>
                        <p className="text-[10px] text-[#8696a0] font-mono">{p.uid.slice(0, 8)}...</p>
                      </div>
                    </div>
                    {p.uid === chat.createdBy && (
                      <span className="text-[10px] bg-[#00a884]/20 text-[#00a884] px-2 py-0.5 rounded-full font-medium">Admin</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {chat.type === 'group' && (
            <button 
              onClick={onLeave}
              className="w-full py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4" /> Exit Group
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupCode, setGroupCode] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showQR, setShowQR] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [showEmojiTray, setShowEmojiTray] = useState(false);

  // Developer Code Sharing & Fullscreen Viewer state (supports 10,000+ lines of code)
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [fullscreenCodeData, setFullscreenCodeData] = useState<CodeData | null>(null);
  const [codeModalInitialCode, setCodeModalInitialCode] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [detectedLargeCode, setDetectedLargeCode] = useState<string | null>(null);

  // WhatsApp-style message deletion & selection mode states
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState<Message | null>(null);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  // User Profile Viewing & Blocking state
  const [contactProfileModalUser, setContactProfileModalUser] = useState<{ uid: string; displayName: string; photoURL?: string } | null>(null);

  // Voice Note Recording state
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);

  // Direct chat user caching for accurate friend's name and avatar display
  const [usersCache, setUsersCache] = useState<Record<string, { displayName: string; photoURL?: string }>>({});

  // Universal 2-hour temporary ID session timer
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | null>(null);

  // Active Users and User Search by Name state
  const [searchedUsers, setSearchedUsers] = useState<UserProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showFindPeopleModal, setShowFindPeopleModal] = useState(false);
  const [activeUsersList, setActiveUsersList] = useState<UserProfile[]>([]);

  // Group creation member selection state
  const [selectedGroupMemberUids, setSelectedGroupMemberUids] = useState<string[]>([]);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };
  
  // Voice Call state (Voice-only with real WebRTC audio playback)
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [activeCallSeconds, setActiveCallSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const callStatusUnsubRef = useRef<(() => void) | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    // Check stored 2-hour session from localStorage
    try {
      const stored = localStorage.getItem('chatwave_user_session');
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        const now = Date.now();
        if (parsed.expiresAt && now >= parsed.expiresAt) {
          // Expired
          localStorage.removeItem('chatwave_user_session');
          deleteDoc(doc(db, 'users', parsed.uid)).catch(() => {});
          setUser(null);
          setAuthLoading(false);
          showNotification('Your previous 2-hour session expired and your ID was deleted.');
        } else {
          setUser(parsed);
          setAuthLoading(false);
          // Sync with Firestore in background
          getDoc(doc(db, 'users', parsed.uid)).then(snap => {
            if (snap.exists()) {
              const remote = snap.data() as UserProfile;
              setUser(prev => prev ? { ...prev, ...remote, photoURL: getAvatarUrl(remote.uid, remote.photoURL) } : null);
            } else {
              // The user document was deleted (fresh database reset)
              localStorage.removeItem('chatwave_user_session');
              setUser(null);
            }
          }).catch(() => {});
        }
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    } catch {
      setUser(null);
      setAuthLoading(false);
    }

    // Check for join code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    if (joinCode) {
      setGroupCode(joinCode);
      setShowGroupModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setChatsLoading(false);
      return;
    }

    setChatsLoading(true);

    // Query participants without combining orderBy to prevent missing composite index errors
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      // In-memory sort by lastMessageAt descending
      chatList.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : (a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0);
        const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : (b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0);
        return timeB - timeA;
      });
      setChats(chatList);
      setChatsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
      setChatsLoading(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!activeChat) return;

    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgList);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`);
    });

    return unsubscribe;
  }, [activeChat]);

  // Resolve user profiles for DMs so Friend sees Mine name and Mine sees Friend's name
  useEffect(() => {
    if (!user || chats.length === 0) return;
    chats.forEach(chat => {
      if (chat.type === 'dm') {
        const otherId = chat.participants.find(p => p !== user.uid);
        if (otherId && !usersCache[otherId] && !chat.participantsDetails?.[otherId]) {
          getDoc(doc(db, 'users', otherId)).then(snap => {
            if (snap.exists()) {
              const uData = snap.data();
              setUsersCache(prev => ({
                ...prev,
                [otherId]: { displayName: uData.displayName || `User_${otherId.slice(0, 5)}`, photoURL: uData.photoURL }
              }));
            }
          }).catch(() => {});
        }
      }
    });
  }, [chats, user]);

  // Auto-delete / Disappearing Messages after 1 hour (WhatsApp-style)
  const ONE_HOUR_MS = 60 * 60 * 1000;

  const visibleMessages = useMemo(() => {
    if (!user) return [];
    const now = Date.now();
    const userClearTime = activeChat?.clearedAt?.[user.uid] 
      ? (activeChat.clearedAt[user.uid]?.toMillis ? activeChat.clearedAt[user.uid].toMillis() : new Date(activeChat.clearedAt[user.uid]).getTime())
      : 0;

    return messages.filter(m => {
      // Hidden if deleted for me
      if (m.deletedFor && m.deletedFor.includes(user.uid)) return false;

      const msgTime = m.createdAt?.toMillis ? m.createdAt.toMillis() : (m.createdAt ? new Date(m.createdAt).getTime() : now);
      // Hidden if before user's clear timestamp
      if (userClearTime && msgTime <= userClearTime) return false;

      // Automatically hide and delete after 1 hour
      if (m.createdAt && (now - msgTime > ONE_HOUR_MS)) {
        return false;
      }
      return true;
    });
  }, [messages, user, activeChat]);

  // Background 1-hour old message permanent cleanup for the active chat
  useEffect(() => {
    if (!activeChat) return;
    const cleanupOldMessages = async () => {
      const now = Date.now();
      const expiredMsgs = messages.filter(m => {
        if (!m.createdAt) return false;
        const msgTime = m.createdAt?.toMillis ? m.createdAt.toMillis() : new Date(m.createdAt).getTime();
        return (now - msgTime > ONE_HOUR_MS);
      });

      for (const expMsg of expiredMsgs) {
        try {
          await deleteDoc(doc(db, 'chats', activeChat.id, 'messages', expMsg.id));
        } catch {}
      }
    };

    cleanupOldMessages();
    const interval = setInterval(cleanupOldMessages, 60000);
    return () => clearInterval(interval);
  }, [activeChat, messages]);

  // Universal 2-hour Temporary ID Auto-Deletion & Countdown
  useEffect(() => {
    if (!user) {
      setSessionRemainingSeconds(null);
      return;
    }

    const checkExpiry = async () => {
      const now = Date.now();
      const expiresAt = user.expiresAt || (now + 2 * 60 * 60 * 1000);
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setSessionRemainingSeconds(remaining);

      if (remaining <= 0) {
        try {
          await deleteDoc(doc(db, 'users', user.uid));
        } catch (e) {
          console.warn('Failed to delete expired user doc:', e);
        }
        localStorage.removeItem('chatwave_user_session');
        setUser(null);
        setActiveChat(null);
        showNotification('Your 2-hour temporary ID has expired and was automatically deleted.');
      }
    };

    checkExpiry();
    const timer = setInterval(checkExpiry, 1000);
    return () => clearInterval(timer);
  }, [user]);

  // Delete session manually on exit
  const handleDeleteSession = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
    } catch (e) {
      console.warn('Failed to delete user doc:', e);
    }
    localStorage.removeItem('chatwave_user_session');
    setUser(null);
    setActiveChat(null);
    showNotification('Session ended. Your temporary ID has been deleted.');
  };

  // Real-time user search by name across all active users
  useEffect(() => {
    if (!user || !searchQuery.trim()) {
      setSearchedUsers([]);
      setIsSearchingUsers(false);
      return;
    }

    const queryTerm = searchQuery.trim().toLowerCase();
    setIsSearchingUsers(true);

    const debounce = setTimeout(async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const now = Date.now();
        const matches: UserProfile[] = [];

        snap.forEach(d => {
          const u = d.data() as UserProfile;
          if (u.uid === user.uid) return;
          if (u.expiresAt && now > u.expiresAt) return;
          const dName = (u.displayName || '').toLowerCase();
          const uName = (u.username || '').toLowerCase();
          if (dName.includes(queryTerm) || uName.includes(queryTerm)) {
            matches.push({
              ...u,
              photoURL: getAvatarUrl(u.uid, u.photoURL)
            });
          }
        });

        setSearchedUsers(matches);
      } catch (err) {
        console.warn('User search error:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 200);

    return () => clearTimeout(debounce);
  }, [searchQuery, user]);

  const loadActiveUsers = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(collection(db, 'users'));
      const now = Date.now();
      const list: UserProfile[] = [];
      snap.forEach(d => {
        const u = d.data() as UserProfile;
        if (u.uid === user.uid) return;
        if (u.expiresAt && now > u.expiresAt) return;
        list.push({ ...u, photoURL: getAvatarUrl(u.uid, u.photoURL) });
      });
      list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      setActiveUsersList(list);
    } catch (e) {
      console.warn('Failed to load active users:', e);
    }
  };

  const handleStartDirectChat = async (targetUser: UserProfile) => {
    if (!user) return;
    if (targetUser.uid === user.uid) {
      showNotification("You cannot chat with yourself!");
      return;
    }

    try {
      // Check existing in-memory chats
      const existing = chats.find(c => c.type === 'dm' && c.participants.includes(targetUser.uid));
      if (existing) {
        setActiveChat(existing);
        setSearchQuery('');
        setShowFindPeopleModal(false);
        return;
      }

      // Check Firestore
      const q = query(
        collection(db, 'chats'),
        where('type', '==', 'dm'),
        where('participants', 'array-contains', user.uid)
      );
      const snap = await getDocs(q);
      const foundDoc = snap.docs.find(d => (d.data() as Chat).participants.includes(targetUser.uid));

      if (foundDoc) {
        const chatData = { id: foundDoc.id, ...foundDoc.data() } as Chat;
        setActiveChat(chatData);
        setSearchQuery('');
        setShowFindPeopleModal(false);
        return;
      }

      const participantsDetails = {
        [user.uid]: { displayName: user.displayName, photoURL: user.photoURL || '' },
        [targetUser.uid]: { displayName: targetUser.displayName, photoURL: targetUser.photoURL || '' }
      };

      const newChatRef = await addDoc(collection(db, 'chats'), {
        type: 'dm',
        name: `${user.displayName} & ${targetUser.displayName}`,
        participants: [user.uid, targetUser.uid],
        participantsDetails,
        lastMessage: '👋 Started a new chat',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      const newChatObj: Chat = {
        id: newChatRef.id,
        type: 'dm',
        name: `${user.displayName} & ${targetUser.displayName}`,
        participants: [user.uid, targetUser.uid],
        participantsDetails,
        lastMessage: '👋 Started a new chat'
      };

      setUsersCache(prev => ({
        ...prev,
        [targetUser.uid]: { displayName: targetUser.displayName, photoURL: targetUser.photoURL }
      }));

      setActiveChat(newChatObj);
      setSearchQuery('');
      setShowFindPeopleModal(false);
      showNotification(`Chat started with ${targetUser.displayName}!`);
    } catch (err) {
      console.error('Failed to start chat', err);
      showNotification('Could not start chat with this user.');
    }
  };

  const handleAddMemberToGroup = async (targetUser: UserProfile) => {
    if (!activeChat || !user) return;
    try {
      const updatedParticipants = Array.from(new Set([...activeChat.participants, targetUser.uid]));
      const updatedDetails = {
        ...(activeChat.participantsDetails || {}),
        [targetUser.uid]: { displayName: targetUser.displayName, photoURL: targetUser.photoURL || '' }
      };

      await updateDoc(doc(db, 'chats', activeChat.id), {
        participants: updatedParticipants,
        participantsDetails: updatedDetails,
        lastMessage: `${user.displayName} added ${targetUser.displayName}`,
        lastMessageAt: serverTimestamp(),
      });

      setActiveChat(prev => prev ? {
        ...prev,
        participants: updatedParticipants,
        participantsDetails: updatedDetails
      } : null);

      showNotification(`Added ${targetUser.displayName} to "${activeChat.name}"`);
    } catch (err) {
      console.error('Failed to add member to group', err);
      showNotification('Failed to add member.');
    }
  };

  // Call signaling (Voice-only, auto-ignoring blocked contacts)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ringingCall = snapshot.docs.find(d => {
        const data = d.data();
        if (data.status !== 'ringing') return false;
        // Don't ring if the caller is in your blocked list
        if (user.blockedUsers && user.blockedUsers.includes(data.callerId)) return false;
        return true;
      });
      if (ringingCall) {
        const callData = { id: ringingCall.id, ...ringingCall.data() };
        setIncomingCall(callData);
      } else {
        setIncomingCall(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return unsubscribe;
  }, [user]);

  // Voice Call Active Timer
  useEffect(() => {
    let timer: any = null;
    if (activeCall) {
      setActiveCallSeconds(0);
      timer = setInterval(() => {
        setActiveCallSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setActiveCallSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.id]);

  // User Blocking & Unblocking logic
  const handleToggleBlock = async (targetUid: string) => {
    if (!user) return;
    const currentBlocked = user.blockedUsers || [];
    const isAlreadyBlocked = currentBlocked.includes(targetUid);
    const updatedBlocked = isAlreadyBlocked
      ? currentBlocked.filter(id => id !== targetUid)
      : [...currentBlocked, targetUid];

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: updatedBlocked
      });
      setUser(prev => prev ? { ...prev, blockedUsers: updatedBlocked } : null);
      showNotification(isAlreadyBlocked ? 'Contact unblocked successfully.' : 'Contact blocked successfully.');
    } catch (err) {
      console.error('Failed to update blocked users', err);
      showNotification('Failed to update block status.');
    }
  };

  // Voice Note sending logic
  const handleSendVoiceNote = async (audioBlob: Blob, duration: number) => {
    if (!activeChat || !user) return;
    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;
          const msgData = {
            chatId: activeChat.id,
            senderId: user.uid,
            senderName: user.displayName,
            type: 'audio',
            audioUrl: base64Audio,
            audioDuration: duration,
            text: '🎤 Voice note',
            createdAt: serverTimestamp(),
          };

          await addDoc(collection(db, 'chats', activeChat.id, 'messages'), msgData);
          await updateDoc(doc(db, 'chats', activeChat.id), {
            lastMessage: `🎤 Voice note (${Math.floor(duration / 60)}:${duration % 60 < 10 ? '0' : ''}${duration % 60})`,
            lastMessageAt: serverTimestamp(),
          });
          setIsRecordingVoiceNote(false);
          showNotification('Voice note sent!');
        } catch (err) {
          console.error('Failed to send voice note', err);
          showNotification('Failed to send voice note.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error('Failed to process voice note', err);
      setIsUploading(false);
      showNotification('Failed to record voice note.');
    }
  };

  // WhatsApp-style Delete for Everyone / Delete for Me (Individual Message Deletion)
  const handleDeleteForEveryone = async (msg: Message) => {
    if (!activeChat) return;
    setDeleteConfirmMessage(null);
    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', msg.id);
      await updateDoc(msgRef, {
        deletedForEveryone: true,
        text: '🚫 This message was deleted',
        imageUrl: null,
        videoUrl: null,
        fileUrl: null,
        audioUrl: null,
        code: null,
        codeTitle: null,
      });
      showNotification('Message deleted for everyone');
    } catch (err) {
      console.error('Failed to delete for everyone', err);
      showNotification('Failed to delete message');
    }
  };

  const handleDeleteForMe = async (msg: Message) => {
    if (!activeChat || !user) return;
    setDeleteConfirmMessage(null);
    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', msg.id);
      const existing = msg.deletedFor || [];
      if (!existing.includes(user.uid)) {
        await updateDoc(msgRef, {
          deletedFor: [...existing, user.uid]
        });
      }
      showNotification('Message deleted for you');
    } catch (err) {
      console.error('Failed to delete for me', err);
      showNotification('Failed to delete message');
    }
  };

  // Multi-Select Batch Deletion Handlers
  const handleBatchDeleteForEveryone = async () => {
    if (!activeChat || !user || selectedMessageIds.length === 0) return;
    setShowBatchDeleteModal(false);
    try {
      const msgsToDelete = messages.filter(m => selectedMessageIds.includes(m.id) && m.senderId === user.uid);
      for (const m of msgsToDelete) {
        const msgRef = doc(db, 'chats', activeChat.id, 'messages', m.id);
        await updateDoc(msgRef, {
          deletedForEveryone: true,
          text: '🚫 This message was deleted',
          imageUrl: null,
          videoUrl: null,
          fileUrl: null,
          audioUrl: null,
          code: null,
          codeTitle: null,
        });
      }
      setSelectedMessageIds([]);
      setIsSelectMode(false);
      showNotification(`${msgsToDelete.length} message(s) deleted for everyone`);
    } catch (err) {
      console.error('Failed to batch delete for everyone', err);
      showNotification('Failed to delete messages');
    }
  };

  const handleBatchDeleteForMe = async () => {
    if (!activeChat || !user || selectedMessageIds.length === 0) return;
    setShowBatchDeleteModal(false);
    try {
      for (const msgId of selectedMessageIds) {
        const msgRef = doc(db, 'chats', activeChat.id, 'messages', msgId);
        const msg = messages.find(m => m.id === msgId);
        const existing = msg?.deletedFor || [];
        if (!existing.includes(user.uid)) {
          await updateDoc(msgRef, {
            deletedFor: [...existing, user.uid]
          });
        }
      }
      setSelectedMessageIds([]);
      setIsSelectMode(false);
      showNotification(`${selectedMessageIds.length} message(s) deleted for you`);
    } catch (err) {
      console.error('Failed to batch delete for me', err);
      showNotification('Failed to delete messages');
    }
  };

  // Incoming Call Ringtone Chime using Web Audio API
  useEffect(() => {
    if (!incomingCall) return;

    let ringInterval: any = null;
    const playChime = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } catch {}
    };

    playChime();
    ringInterval = setInterval(playChime, 2500);

    return () => {
      if (ringInterval) clearInterval(ringInterval);
    };
  }, [incomingCall]);

  const handleClearChatForMe = async () => {
    if (!activeChat || !user) return;
    setShowClearChatModal(false);
    try {
      await updateDoc(doc(db, 'chats', activeChat.id), {
        [`clearedAt.${user.uid}`]: serverTimestamp(),
      });
      showNotification('Chat history cleared for you');
    } catch (err) {
      console.error('Failed to clear chat for me', err);
      showNotification('Failed to clear chat');
    }
  };

  const handleClearChatForEveryone = async () => {
    if (!activeChat) return;
    setShowClearChatModal(false);
    try {
      const q = query(collection(db, 'chats', activeChat.id, 'messages'));
      const snap = await getDocs(q);
      for (const mDoc of snap.docs) {
        await deleteDoc(mDoc.ref);
      }
      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: 'Messages cleared',
        lastMessageAt: serverTimestamp(),
      });
      showNotification('Chat history cleared for everyone');
    } catch (err) {
      console.error('Failed to clear chat for everyone', err);
      showNotification('Failed to clear chat');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const msgText = newMessage;
    setNewMessage('');
    setDetectedLargeCode(null);

    // If message is surrounded by ```...``` markdown code block, save as code message
    const trimmed = msgText.trim();
    const isMarkdownCode = trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.length > 6;

    try {
      if (isMarkdownCode) {
        const match = trimmed.match(/^```([a-zA-Z0-9_-]*)\n?([\s\S]+)```$/);
        const codeLang = match?.[1] || 'typescript';
        const rawCode = match?.[2]?.trim() || trimmed;
        const lineCount = rawCode.split('\n').length;
        const preview = `💻 [${codeLang.toUpperCase()}] Code snippet (${lineCount} lines)`;

        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderId: user.uid,
          senderName: user.displayName,
          text: preview,
          code: rawCode,
          codeLanguage: codeLang,
          codeLineCount: lineCount,
          type: 'code',
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: preview,
          lastMessageAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderId: user.uid,
          senderName: user.displayName,
          text: msgText,
          type: 'text',
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: msgText,
          lastMessageAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Failed to send message', error);
      handleFirestoreError(error, OperationType.WRITE, `chats/${activeChat.id}`);
    }
  };

  const handleSendCode = async (codeData: { code: string; language: string; title?: string }) => {
    if (!activeChat || !user || !codeData.code.trim()) return;

    const lineCount = codeData.code.split('\n').length;
    const preview = codeData.title 
      ? `💻 [${codeData.language.toUpperCase()}] ${codeData.title} (${lineCount} lines)`
      : `💻 [${codeData.language.toUpperCase()}] Code snippet (${lineCount} lines)`;

    try {
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        text: preview,
        code: codeData.code,
        codeLanguage: codeData.language,
        codeTitle: codeData.title || '',
        codeLineCount: lineCount,
        type: 'code',
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: preview,
        lastMessageAt: serverTimestamp(),
      });
      showNotification('Code snippet shared successfully!');
    } catch (error) {
      console.error('Failed to send code snippet', error);
      handleFirestoreError(error, OperationType.WRITE, `chats/${activeChat.id}`);
      showNotification('Failed to send code snippet.');
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!activeChat || !user) return;
    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', messageId);
      const msgDoc = await getDoc(msgRef);
      if (!msgDoc.exists()) return;

      const currentReactions: Record<string, string[]> = msgDoc.data()?.reactions || {};
      const userList = currentReactions[emoji] || [];
      const hasReacted = userList.includes(user.uid);

      const updatedUsers = hasReacted 
        ? userList.filter(id => id !== user.uid)
        : [...userList, user.uid];

      const newReactions = { ...currentReactions };
      if (updatedUsers.length > 0) {
        newReactions[emoji] = updatedUsers;
      } else {
        delete newReactions[emoji];
      }

      await updateDoc(msgRef, { reactions: newReactions });
    } catch (err) {
      console.warn('Reaction update failed', err);
    }
  };

  const handleTogglePin = async (messageId: string, currentPin?: boolean) => {
    if (!activeChat) return;
    try {
      const msgRef = doc(db, 'chats', activeChat.id, 'messages', messageId);
      await updateDoc(msgRef, { isPinned: !currentPin });
      showNotification(!currentPin ? 'Message pinned!' : 'Message unpinned');
    } catch (err) {
      console.warn('Pin toggle failed', err);
    }
  };

  const processFileAndSend = async (file: File) => {
    if (!file || !activeChat || !user) return;

    setShowAttachMenu(false);
    setIsUploading(true);
    try {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const isCodeOrText = file.name.match(/\.(txt|md|log|json|csv|env|py|js|ts|tsx|jsx|html|htm|css|sql|sh|yaml|yml|java|c|cpp|h|hpp|rs|go|xml|php|rb|swift|kt|dart|ini|conf|bash|zsh)$/i) || file.type.startsWith('text/');
      
      // Automatically preview all code and text files inline so download is not needed!
      if (isCodeOrText && file.size < 10 * 1024 * 1024) {
        try {
          const codeText = await file.text();
          const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
          await handleSendCode({
            code: codeText,
            language: ext,
            title: file.name
          });
          setIsUploading(false);
          return;
        } catch (codeReadErr) {
          console.warn('Fallback to standard file for code upload', codeReadErr);
        }
      }

      const msgType: 'image' | 'video' | 'file' = isImg ? 'image' : isVid ? 'video' : 'file';

      let mediaUrl = '';
      if (isImg) {
        try {
          // Fast high-quality compressed image (<50ms, ~50KB)
          mediaUrl = await compressImage(file, 960, 0.72);
        } catch {
          mediaUrl = await readFileAsDataURL(file);
        }
      } else {
        if (file.size > 10 * 1024 * 1024) {
          showNotification('File exceeds 10MB limit. Please choose a smaller file.');
          setIsUploading(false);
          return;
        }
        mediaUrl = await readFileAsDataURL(file);
      }

      // Fast storage upload attempt with strict 1.2s timeout so unconfigured storage never hangs
      try {
        const storagePromise = (async () => {
          const fileRef = ref(storage, `chats/${activeChat.id}/${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          return await getDownloadURL(fileRef);
        })();

        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Storage upload timeout - using fast inline fallback')), 1200)
        );

        const storageUrl = await Promise.race([storagePromise, timeoutPromise]);
        if (storageUrl) mediaUrl = storageUrl;
      } catch (storageErr) {
        console.info('Storage upload skipped, using direct fast transfer:', storageErr);
      }

      const defaultText = msgType === 'image' ? '📷 Photo' : msgType === 'video' ? '🎥 Video' : `📄 ${file.name}`;
      
      await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
        chatId: activeChat.id,
        senderId: user.uid,
        senderName: user.displayName,
        text: defaultText,
        imageUrl: msgType === 'image' ? mediaUrl : null,
        videoUrl: msgType === 'video' ? mediaUrl : null,
        fileUrl: msgType === 'file' ? mediaUrl : null,
        fileName: file.name,
        fileSize: file.size,
        type: msgType,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', activeChat.id), {
        lastMessage: defaultText,
        lastMessageAt: serverTimestamp(),
      });
      showNotification('Media sent successfully!');
    } catch (error) {
      console.error('Upload failed', error);
      showNotification('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaKind: 'media' | 'doc' | 'camera' = 'media') => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileAndSend(file);
    if (e.target) e.target.value = '';
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const allParticipants = Array.from(new Set([user.uid, ...selectedGroupMemberUids]));

    const participantsDetails: Record<string, { displayName: string; photoURL?: string }> = {
      [user.uid]: { displayName: user.displayName, photoURL: user.photoURL || '' }
    };

    selectedGroupMemberUids.forEach(mUid => {
      const found = activeUsersList.find(u => u.uid === mUid) || searchedUsers.find(u => u.uid === mUid) || usersCache[mUid];
      participantsDetails[mUid] = {
        displayName: found?.displayName || `User_${mUid.slice(0, 5)}`,
        photoURL: found?.photoURL || ''
      };
    });
    
    try {
      const chatRef = await addDoc(collection(db, 'chats'), {
        name: newGroupName,
        type: 'group',
        participants: allParticipants,
        participantsDetails,
        groupCode: code,
        createdBy: user.uid,
        lastMessage: `${user.displayName} created group "${newGroupName}"`,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setNewGroupName('');
      setSelectedGroupMemberUids([]);
      setGroupMemberSearch('');
      setIsCreatingGroup(false);
      setShowGroupModal(false);
      setActiveChat({ 
        id: chatRef.id, 
        name: newGroupName, 
        type: 'group', 
        participants: allParticipants, 
        participantsDetails,
        groupCode: code 
      });
      showNotification(`Group "${newGroupName}" created with ${allParticipants.length} members!`);
    } catch (error) {
      console.error('Failed to create group', error);
      handleFirestoreError(error, OperationType.CREATE, 'chats');
      showNotification('Failed to create group.');
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim() || !user) return;

    try {
      // Must include type: 'group' to match security rules for non-participants
      const q = query(
        collection(db, 'chats'), 
        where('type', '==', 'group'),
        where('groupCode', '==', groupCode), 
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showNotification('Invalid group code');
        return;
      }

      const chatDoc = snapshot.docs[0];
      const chatData = chatDoc.data() as Chat;

      if (chatData.participants.includes(user.uid)) {
        showNotification('You are already in this group');
        setActiveChat({ id: chatDoc.id, ...chatData });
        setShowGroupModal(false);
        return;
      }

      await updateDoc(doc(db, 'chats', chatDoc.id), {
        participants: [...chatData.participants, user.uid]
      });

      setActiveChat({ id: chatDoc.id, ...chatData, participants: [...chatData.participants, user.uid] });
      setShowGroupModal(false);
      setGroupCode('');
    } catch (error) {
      console.error('Failed to join group', error);
      handleFirestoreError(error, OperationType.UPDATE, 'chats');
      showNotification('Failed to join group. Please check your permissions or the group code.');
    }
  };

  const handleScanQR = async (scannedUid: string) => {
    if (!user) return;
    setShowScanner(false);

    // If scanned UID matches group code pattern
    try {
      const groupQ = query(collection(db, 'chats'), where('type', '==', 'group'), where('groupCode', '==', scannedUid));
      const groupSnap = await getDocs(groupQ);
      if (!groupSnap.empty) {
        const targetGroup = groupSnap.docs[0];
        const groupData = targetGroup.data() as Chat;
        if (!groupData.participants.includes(user.uid)) {
          const updated = [...groupData.participants, user.uid];
          await updateDoc(doc(db, 'chats', targetGroup.id), { participants: updated });
          showNotification(`Joined group "${groupData.name}"!`);
        }
        setActiveChat({ id: targetGroup.id, ...groupData, participants: Array.from(new Set([...groupData.participants, user.uid])) });
        return;
      }
    } catch (err) {
      console.warn('Group check skipped', err);
    }

    if (scannedUid === user.uid) {
      showNotification("You scanned your own QR code!");
      return;
    }

    try {
      // Check if DM already exists
      const q = query(
        collection(db, 'chats'),
        where('type', '==', 'dm'),
        where('participants', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      let existingChat = snapshot.docs.find(doc => doc.data().participants.includes(scannedUid));

      if (existingChat) {
        const chatData = existingChat.data() as Chat;
        setActiveChat({ id: existingChat.id, ...chatData });
      } else {
        // Get scanned user's info
        const userDoc = await getDoc(doc(db, 'users', scannedUid));
        const scannedUser = userDoc.data();
        const scannedName = scannedUser?.displayName || `User_${scannedUid.slice(0, 5)}`;
        
        const participantsDetails = {
          [user.uid]: { displayName: user.displayName, photoURL: user.photoURL || '' },
          [scannedUid]: { displayName: scannedName, photoURL: scannedUser?.photoURL || '' }
        };

        const chatRef = await addDoc(collection(db, 'chats'), {
          type: 'dm',
          name: `${user.displayName} & ${scannedName}`,
          participants: [user.uid, scannedUid],
          participantsDetails,
          lastMessageAt: serverTimestamp(),
        });

        setUsersCache(prev => ({
          ...prev,
          [scannedUid]: { displayName: scannedName, photoURL: scannedUser?.photoURL }
        }));

        setActiveChat({ 
          id: chatRef.id, 
          type: 'dm', 
          name: `${user.displayName} & ${scannedName}`, 
          participants: [user.uid, scannedUid],
          participantsDetails
        });
      }
      showNotification('Chat connected!');
    } catch (error) {
      console.error('Failed to start DM', error);
      showNotification('Could not connect with user.');
    }
  };

  const startVoiceCall = async () => {
    if (!activeChat || !user) return;
    const otherUid = activeChat.participants.find(p => p !== user.uid);
    if (otherUid && user.blockedUsers?.includes(otherUid)) {
      showNotification('Cannot call a blocked contact. Please unblock first.');
      return;
    }

    const isGroup = activeChat.type === 'group';

    try {
      let userStream: MediaStream;
      try {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          showNotification('Microphone is not supported in this browser.');
          return;
        }
        userStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false 
        });
      } catch (mediaErr) {
        console.warn('Microphone permission denied or unavailable', mediaErr);
        showNotification('Could not access microphone. Please grant permissions.');
        return;
      }

      setStream(userStream);
      setIsMuted(false);

      if (isGroup) {
        const callRef = await addDoc(collection(db, 'calls'), {
          chatId: activeChat.id,
          chatName: activeChat.name,
          callerId: user.uid,
          callerName: user.displayName,
          callerPhoto: user.photoURL || null,
          isGroup: true,
          callType: 'audio',
          participants: [user.uid],
          status: 'active',
          createdAt: serverTimestamp(),
        });

        setActiveCall({ 
          id: callRef.id, 
          chatId: activeChat.id,
          chatName: activeChat.name,
          isGroup: true,
          callType: 'audio',
          isCaller: true,
          participants: [user.uid]
        });

        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderId: user.uid,
          senderName: user.displayName,
          text: `📞 Started a group voice call`,
          type: 'call',
          createdAt: serverTimestamp(),
        });
      } else {
        const receiverId = activeChat.participants.find(p => p !== user.uid);
        if (!receiverId) return;

        const callRef = await addDoc(collection(db, 'calls'), {
          chatId: activeChat.id,
          chatName: activeChat.name,
          callerId: user.uid,
          callerName: user.displayName,
          callerPhoto: user.photoURL || null,
          receiverId: receiverId,
          participants: [user.uid, receiverId],
          isGroup: false,
          callType: 'audio',
          status: 'ringing',
          createdAt: serverTimestamp(),
        });

        setActiveCall({ 
          id: callRef.id, 
          receiverId, 
          chatName: activeChat.name,
          isGroup: false,
          callType: 'audio',
          isCaller: true,
          participants: [user.uid, receiverId]
        });

        if (callStatusUnsubRef.current) {
          callStatusUnsubRef.current();
        }

        callStatusUnsubRef.current = onSnapshot(doc(db, 'calls', callRef.id), (docSnapshot) => {
          const data = docSnapshot.data();
          if (data?.status === 'ended') {
            endCall();
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `calls/${callRef.id}`);
        });
      }

      showNotification(`${isGroup ? 'Group' : 'Direct'} voice call started!`);
    } catch (err) {
      console.error('Failed to start voice call', err);
      handleFirestoreError(err, OperationType.CREATE, 'calls');
      showNotification('Failed to initiate voice call.');
    }
  };

  const joinGroupCall = async (groupCall: any) => {
    if (!user) return;
    try {
      let userStream: MediaStream;
      try {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          showNotification('Microphone not supported.');
          return;
        }
        userStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false
        });
      } catch (mediaErr) {
        console.warn('Microphone permission denied', mediaErr);
        showNotification('Could not access microphone.');
        return;
      }

      setStream(userStream);
      setIsMuted(false);

      const updated = Array.from(new Set([...(groupCall.participants || []), user.uid]));
      await updateDoc(doc(db, 'calls', groupCall.id), { participants: updated });

      setActiveCall({
        ...groupCall,
        participants: updated,
        isCaller: false
      });
      setActiveGroupCall(null);
      showNotification('Joined group voice call!');
    } catch (err) {
      console.error('Failed to join group call', err);
      showNotification('Could not join group voice call.');
    }
  };

  const toggleMute = () => {
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      showNotification(!isMuted ? 'Microphone muted' : 'Microphone unmuted');
    }
  };

  const handleClearChat = async () => {
    if (!activeChat || !user) return;
    showNotification('Messages view cleared.');
    setMessages([]);
  };

  const handleCopyGroupInvite = () => {
    if (!activeChat) return;
    const inviteLink = activeChat.groupCode 
      ? `${window.location.origin}/?join=${activeChat.groupCode}` 
      : window.location.href;
    navigator.clipboard.writeText(inviteLink).then(() => {
      showNotification('Group invite link copied to clipboard!');
    }).catch(() => {
      showNotification(`Group Code: ${activeChat.groupCode}`);
    });
  };

  const handleLeaveGroup = async () => {
    if (!activeChat || !user || activeChat.type !== 'group') return;
    try {
      const updated = activeChat.participants.filter(p => p !== user.uid);
      await updateDoc(doc(db, 'chats', activeChat.id), { participants: updated });
      setActiveChat(null);
      setShowGroupInfo(false);
      showNotification(`Left group "${activeChat.name}"`);
    } catch (err) {
      console.error('Failed to leave group', err);
      showNotification('Failed to leave group.');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    try {
      let userStream: MediaStream;
      try {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          showNotification('Microphone is not supported in this environment.');
          return;
        }
        userStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false 
        });
      } catch (mediaErr) {
        console.warn('Microphone permission denied or unavailable', mediaErr);
        showNotification('Could not access microphone. Please grant permissions.');
        return;
      }
      setStream(userStream);
      setIsMuted(false);
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'active' });
      setActiveCall({ ...incomingCall, isCaller: false });
      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to accept call', err);
      handleFirestoreError(err, OperationType.UPDATE, `calls/${incomingCall.id}`);
    }
  };

  const endCall = async () => {
    const callId = activeCall?.id || incomingCall?.id;
    if (callStatusUnsubRef.current) {
      callStatusUnsubRef.current();
      callStatusUnsubRef.current = null;
    }
    if (callId) {
      try {
        if (activeCall?.isGroup && user) {
          const remaining = (activeCall.participants || []).filter((p: string) => p !== user.uid);
          if (remaining.length === 0) {
            await updateDoc(doc(db, 'calls', callId), { status: 'ended', participants: [] });
          } else {
            await updateDoc(doc(db, 'calls', callId), { participants: remaining });
          }
        } else {
          await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
        }
      } catch (err) {
        console.error('Failed to end call', err);
        handleFirestoreError(err, OperationType.UPDATE, `calls/${callId}`);
      }
    }
    if (peerRef.current) {
      try {
        if (!peerRef.current.destroyed) {
          peerRef.current.destroy();
        }
      } catch (e) {
        console.warn('Error destroying peer:', e);
      }
      peerRef.current = null;
    }
    if (stream) {
      try {
        stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping stream tracks:', e);
      }
    }
    setStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    showNotification('Voice call ended');
  };

  // Active voice call duration timer
  useEffect(() => {
    if (!activeCall) {
      setActiveCallSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveCallSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

  // WebRTC Peer connection with STUN configuration and direct Audio Output
  useEffect(() => {
    if (!activeCall || !stream) return;

    const callDoc = doc(db, 'calls', activeCall.id);
    let peer: any = null;

    try {
      peer = new Peer({ 
        initiator: activeCall.isCaller, 
        trickle: false, 
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      });
      peerRef.current = peer;

      peer.on('error', (err: any) => {
        console.warn('WebRTC peer error:', err);
      });

      peer.on('signal', async (data: any) => {
        try {
          const signalKey = activeCall.isCaller ? 'callerSignal' : 'receiverSignal';
          await updateDoc(callDoc, { [signalKey]: JSON.stringify(data) });
        } catch (e) {
          console.warn('Failed to send peer signal', e);
        }
      });

      peer.on('stream', (remoteStream: MediaStream) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(err => {
            console.warn('Auto-play audio blocked:', err);
          });
        }
      });
    } catch (e) {
      console.error('Failed to instantiate Peer:', e);
      return;
    }

    const appliedSignals = new Set<string>();

    const unsubscribe = onSnapshot(callDoc, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      // If other party ended call
      if (data?.status === 'ended') {
        endCall();
        return;
      }

      const signalToReceive = activeCall.isCaller ? data?.receiverSignal : data?.callerSignal;
      if (signalToReceive && peer && !peer.destroyed && !appliedSignals.has(signalToReceive)) {
        appliedSignals.add(signalToReceive);
        try {
          peer.signal(JSON.parse(signalToReceive));
        } catch (e) {
          console.warn('Failed to parse or apply peer signal', e);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `calls/${activeCall.id}`);
    });

    return () => {
      unsubscribe();
      if (peer && !peer.destroyed) {
        try {
          peer.destroy();
        } catch (e) {
          console.warn('Peer destroy error during cleanup:', e);
        }
      }
      peerRef.current = null;
    };
  }, [activeCall?.id, stream]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111b21] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center text-center"
        >
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-[#00a884]/20 animate-ping absolute inset-0"></div>
            <div className="w-20 h-20 rounded-2xl bg-[#00a884] flex items-center justify-center shadow-lg shadow-[#00a884]/30 relative z-10">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#e9edef] tracking-tight mb-2">ChatWave</h1>
          <div className="flex items-center gap-2 text-[#8696a0] text-sm">
            <div className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></div>
            <span>Connecting securely...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <NameEntryScreen onJoin={(newUser) => setUser(newUser)} />;
  }

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-[400px] border-r border-[#3b4a54] flex flex-col transition-all",
        activeChat ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="bg-[#202c33] px-4 py-3 flex justify-between items-center border-b border-[#2e3b43]/40">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 hover:bg-[#2a3942] p-1.5 rounded-xl transition-colors text-left group"
            title="Edit profile & copy ID"
          >
            <div className="relative">
              <img 
                src={getAvatarUrl(user.uid, user.photoURL)} 
                className="w-10 h-10 rounded-full border-2 border-[#00a884] object-cover group-hover:ring-2 group-hover:ring-[#00a884]/50 transition" 
                alt="Profile" 
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#202c33]"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#e9edef] font-semibold text-sm truncate max-w-[130px] leading-tight group-hover:text-[#00a884] transition">{user.displayName}</span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-semibold" title="2-Hour ID Lifetime">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {sessionRemainingSeconds !== null 
                  ? `${Math.floor(sessionRemainingSeconds / 60)}m ${sessionRemainingSeconds % 60}s left`
                  : '2h left'}
              </span>
            </div>
          </motion.button>

          <div className="flex items-center gap-1 text-[#8696a0]">
            <motion.button 
              whileHover={{ scale: 1.1, color: "#00a884" }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { loadActiveUsers(); setShowFindPeopleModal(true); }} 
              title="Find People by Name" 
              className="p-2 hover:bg-[#2a3942] rounded-full transition-colors text-[#8696a0]"
            >
              <UserPlus className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, color: "#e9edef" }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { loadActiveUsers(); setIsCreatingGroup(true); setShowGroupModal(true); }} 
              title="Create New Group" 
              className="p-2 hover:bg-[#2a3942] rounded-full transition-colors text-[#8696a0]"
            >
              <Plus className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, color: "#e9edef" }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowScanner(true)} 
              title="Scan QR Code" 
              className="p-2 hover:bg-[#2a3942] rounded-full transition-colors text-[#8696a0]"
            >
              <Scan className="w-5 h-5" />
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, color: "#ef4444" }}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (window.confirm("End session and delete your temporary ID now?")) {
                  handleDeleteSession();
                }
              }} 
              title="End Session & Delete ID" 
              className="p-2 hover:bg-[#2a3942] rounded-full transition-colors text-[#8696a0]"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {isOffline && (
          <div className="bg-amber-600/90 text-white text-xs px-4 py-2 flex items-center justify-between shadow-sm animate-pulse">
            <span>Offline mode &mdash; checking connection...</span>
          </div>
        )}

        {/* Search & Filter bar */}
        <div className="p-2.5 bg-[#111b21] space-y-2">
          <div className="bg-[#202c33] flex items-center gap-3 px-3.5 py-1.5 rounded-xl border border-transparent focus-within:border-[#00a884]/60 transition-all">
            <Search className="w-4 h-4 text-[#8696a0] shrink-0" />
            <input 
              type="text" 
              placeholder="Search people by name or chat" 
              className="bg-transparent border-none outline-none text-[#e9edef] text-sm w-full py-1 placeholder:text-[#8696a0]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="text-[#8696a0] hover:text-[#e9edef] p-0.5 rounded-full transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs (All / Direct / Groups) */}
          <div className="flex items-center gap-1.5 px-0.5">
            {(['all', 'direct', 'group'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setChatFilter(tab)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition-all capitalize select-none",
                  chatFilter === tab 
                    ? "bg-[#00a884] text-white shadow-sm font-semibold" 
                    : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                )}
              >
                {tab === 'all' ? 'All' : tab === 'direct' ? 'Direct' : 'Groups'}
              </button>
            ))}
          </div>
        </div>

        {/* Search Results: People Found on ChatWave */}
        {searchQuery.trim() && (
          <div className="bg-[#182229] border-b border-[#2e3b43] p-2.5">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00a884] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>People on ChatWave ({searchedUsers.length})</span>
              </span>
              {isSearchingUsers && (
                <span className="w-3 h-3 border border-[#00a884] border-t-transparent rounded-full animate-spin"></span>
              )}
            </div>

            {searchedUsers.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
                {searchedUsers.map((su) => {
                  const hasChat = chats.some(c => c.type === 'dm' && c.participants.includes(su.uid));
                  const now = Date.now();
                  const timeLeft = su.expiresAt ? Math.max(0, Math.floor((su.expiresAt - now) / 60000)) : 120;
                  return (
                    <div key={su.uid} className="flex items-center justify-between p-2 rounded-xl bg-[#202c33] hover:bg-[#2a3942] transition">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={su.photoURL || getAvatarUrl(su.uid)} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#e9edef] truncate">{su.displayName}</p>
                          <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>{timeLeft}m left</span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartDirectChat(su)}
                        className="px-3 py-1 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-lg transition shrink-0 flex items-center gap-1 shadow-sm"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>{hasChat ? 'Open' : 'Chat'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : !isSearchingUsers ? (
              <div className="p-2 text-center text-[#8696a0] text-xs">
                No active users found matching "{searchQuery}".
              </div>
            ) : null}
          </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chatsLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-[#202c33]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#202c33] rounded w-2/3" />
                    <div className="h-3 bg-[#202c33] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (() => {
            const filteredChats = chats.filter(c => {
              if (chatFilter === 'direct' && c.type !== 'dm') return false;
              if (chatFilter === 'group' && c.type !== 'group') return false;
              const otherUid = c.participants.find(p => p !== user.uid);
              const dName = getChatDisplayName(c, user.uid, otherUid ? usersCache[otherUid]?.displayName : undefined);
              return dName.toLowerCase().includes(searchQuery.toLowerCase());
            });

            if (filteredChats.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center select-none">
                  <div className="w-16 h-16 rounded-2xl bg-[#202c33] flex items-center justify-center text-[#00a884] mb-3 shadow-md">
                    <MessageCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#e9edef] mb-1">
                    {searchQuery ? 'No matching chats' : chatFilter !== 'all' ? `No ${chatFilter} chats yet` : 'No conversations yet'}
                  </h4>
                  <p className="text-xs text-[#8696a0] max-w-xs mb-4">
                    {searchQuery ? 'Try searching a different name or start a new chat.' : 'Scan a friend\'s QR code or start a new group to begin messaging.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => { loadActiveUsers(); setShowFindPeopleModal(true); }}
                      className="px-3.5 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold rounded-xl transition shadow flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Find People by Name</span>
                    </button>
                    <button
                      onClick={() => { loadActiveUsers(); setIsCreatingGroup(true); setShowGroupModal(true); }}
                      className="px-3.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] text-xs font-medium rounded-xl transition border border-[#3b4a54] flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Group</span>
                    </button>
                  </div>
                </div>
              );
            }

            return filteredChats.map(chat => {
              const otherUid = chat.participants.find(p => p !== user.uid);
              return (
                <ChatItem 
                  key={chat.id} 
                  chat={chat} 
                  active={activeChat?.id === chat.id} 
                  onClick={() => setActiveChat(chat)}
                  currentUserId={user.uid}
                  cachedName={otherUid ? usersCache[otherUid]?.displayName : undefined}
                  cachedPhoto={otherUid ? usersCache[otherUid]?.photoURL : undefined}
                />
              );
            });
          })()}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-[#0b141a] relative",
        !activeChat ? "hidden md:flex items-center justify-center" : "flex"
      )}>
        {activeChat ? (
          <>
            {/* Active Group Call Banner */}
            {activeGroupCall && (
              <div className="bg-[#00a884] text-white px-4 py-2.5 flex items-center justify-between text-sm shadow-md animate-pulse z-20">
                <div className="flex items-center gap-2 font-medium">
                  <Phone className="w-4 h-4" />
                  <span>Group voice call in progress ({activeGroupCall.participants?.length || 1} connected)</span>
                </div>
                <button 
                  onClick={() => joinGroupCall(activeGroupCall)}
                  className="bg-[#111b21] hover:bg-black text-white px-4 py-1 rounded-full text-xs font-bold transition shadow"
                >
                  Join Voice Call
                </button>
              </div>
            )}

            {/* Selection Mode Header or Standard Chat Header */}
            {isSelectMode ? (
              <div className="bg-[#202c33] p-3 flex items-center justify-between shadow-md z-10 border-b border-[#00a884]/30">
                <div className="flex items-center gap-3 text-[#e9edef]">
                  <button 
                    onClick={() => { setIsSelectMode(false); setSelectedMessageIds([]); }} 
                    className="p-1.5 hover:bg-[#3b4a54]/50 rounded-full text-[#8696a0] hover:text-white transition"
                    title="Cancel selection"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className="font-semibold text-sm">{selectedMessageIds.length} selected</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMessageIds.length === visibleMessages.length) {
                        setSelectedMessageIds([]);
                      } else {
                        setSelectedMessageIds(visibleMessages.map(m => m.id));
                      }
                    }}
                    className="text-xs text-[#00a884] hover:underline font-medium px-2 py-1"
                  >
                    {selectedMessageIds.length === visibleMessages.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <button
                    type="button"
                    disabled={selectedMessageIds.length === 0}
                    onClick={() => setShowBatchDeleteModal(true)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-red-500/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete ({selectedMessageIds.length})</span>
                  </button>
                </div>
              </div>
            ) : (() => {
              const otherUid = activeChat.participants.find(p => p !== user.uid);
              const isBlocked = otherUid ? (user.blockedUsers?.includes(otherUid) || false) : false;
              const headerDisplayName = getChatDisplayName(activeChat, user.uid, otherUid ? usersCache[otherUid]?.displayName : undefined);
              const headerAvatarUrl = getChatAvatar(activeChat, user.uid, otherUid ? usersCache[otherUid]?.photoURL : undefined);

              return (
                <div className="bg-[#202c33] p-3 flex items-center justify-between shadow-md z-10">
                  <div 
                    onClick={() => {
                      if (activeChat.type === 'dm' && otherUid) {
                        setContactProfileModalUser({ 
                          uid: otherUid, 
                          displayName: headerDisplayName, 
                          photoURL: headerAvatarUrl 
                        });
                      } else {
                        setShowGroupInfo(true);
                      }
                    }}
                    className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition group"
                    title={activeChat.type === 'dm' ? "Click to view profile & block/unblock options" : "Click to view group info"}
                  >
                    <button onClick={(e) => { e.stopPropagation(); setActiveChat(null); }} className="md:hidden text-[#8696a0] mr-2">
                      <ArrowLeft />
                    </button>
                    <div className="relative">
                      <img 
                        src={headerAvatarUrl} 
                        className="w-10 h-10 rounded-full object-cover bg-[#3b4a54] border border-white/10 group-hover:ring-2 group-hover:ring-[#00a884] transition" 
                        alt={headerDisplayName}
                      />
                      {isBlocked && (
                        <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5" title="Blocked">
                          <Ban className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[#e9edef] font-medium leading-tight group-hover:text-[#00a884] transition">{headerDisplayName}</h3>
                        {isBlocked && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-medium">Blocked</span>}
                      </div>
                      <p className="text-[#8696a0] text-xs">
                        {activeChat.type === 'group' 
                          ? `${activeChat.participants.length} participants` 
                          : isBlocked ? 'Blocked contact' : 'online • click for profile'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[#8696a0]">
                    {/* Voice-only calling button */}
                    <button 
                      onClick={startVoiceCall} 
                      title={isBlocked ? "Cannot call a blocked contact" : "Start voice call"} 
                      disabled={isBlocked}
                      className={cn(
                        "p-2 rounded-full transition",
                        isBlocked ? "opacity-30 cursor-not-allowed" : "hover:text-[#00a884] hover:bg-[#3b4a54]/50"
                      )}
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowQR(activeChat.groupCode || activeChat.id)} title="Chat QR" className="hover:text-[#e9edef] p-2 hover:bg-[#3b4a54]/50 rounded-full transition">
                      <QrCode className="w-5 h-5" />
                    </button>
                    
                    {/* Three Dots Menu */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowChatMenu(!showChatMenu)} 
                        title="More options" 
                        className="p-2 hover:bg-[#3b4a54]/50 rounded-full hover:text-[#e9edef] transition"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {showChatMenu && (
                        <div className="absolute right-0 top-10 w-52 bg-[#202c33] rounded-xl shadow-2xl border border-[#3b4a54] py-1.5 z-50 text-sm">
                          <button 
                            onClick={() => { 
                              if (activeChat.type === 'dm' && otherUid) {
                                setContactProfileModalUser({ 
                                  uid: otherUid, 
                                  displayName: headerDisplayName, 
                                  photoURL: headerAvatarUrl 
                                });
                              } else {
                                setShowGroupInfo(true); 
                              }
                              setShowChatMenu(false); 
                            }}
                            className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                          >
                            <Info className="w-4 h-4 text-[#00a884]" />
                            <span>{activeChat.type === 'group' ? 'Group info' : 'Contact profile'}</span>
                          </button>

                          <button 
                            onClick={() => { setIsSelectMode(true); setShowChatMenu(false); }}
                            className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                          >
                            <CheckSquare className="w-4 h-4 text-[#00a884]" />
                            <span>Select messages...</span>
                          </button>

                          {activeChat.type === 'group' && (
                            <button 
                              onClick={() => { handleCopyGroupInvite(); setShowChatMenu(false); }}
                              className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                            >
                              <Share2 className="w-4 h-4 text-[#00a884]" />
                              <span>Copy invite link</span>
                            </button>
                          )}

                          <button 
                            onClick={() => { setShowQR(activeChat.groupCode || activeChat.id); setShowChatMenu(false); }}
                            className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                          >
                            <QrCode className="w-4 h-4 text-[#00a884]" />
                            <span>Show QR Code</span>
                          </button>

                          <button 
                            onClick={() => { setShowClearChatModal(true); setShowChatMenu(false); }}
                            className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                          >
                            <Trash2 className="w-4 h-4 text-[#8696a0]" />
                            <span>Clear chat...</span>
                          </button>

                          {activeChat.type === 'dm' && otherUid && (
                            <button 
                              onClick={() => { handleToggleBlock(otherUid); setShowChatMenu(false); }}
                              className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition border-t border-[#3b4a54]/50"
                            >
                              <Ban className="w-4 h-4 text-red-400" />
                              <span>{isBlocked ? 'Unblock contact' : 'Block contact'}</span>
                            </button>
                          )}

                          {activeChat.type === 'group' && (
                            <button 
                              onClick={() => { handleLeaveGroup(); setShowChatMenu(false); }}
                              className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2.5 transition border-t border-[#3b4a54]/50"
                            >
                              <LogOut className="w-4 h-4 text-red-400" />
                              <span>Exit group</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 chat-wallpaper custom-scrollbar flex flex-col">
              <div className="flex flex-col flex-1">
                {/* 1-Hour Disappearing Message Notice */}
                <div className="flex justify-center mb-3">
                  <div className="bg-[#182229]/90 border border-[#00a884]/30 rounded-xl px-3.5 py-1.5 text-center text-xs text-[#8696a0] max-w-md shadow-sm backdrop-blur-sm">
                    <span className="text-[#00a884] font-semibold">⏱️ Disappearing Messages:</span> Chats & code automatically delete after 1 hour.
                  </div>
                </div>

                {visibleMessages.length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center my-auto py-12 text-center select-none"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-[#202c33]/80 border border-[#3b4a54]/50 text-[#00a884] flex items-center justify-center mb-3 shadow-inner">
                      <MessageCircle className="w-8 h-8" />
                    </div>
                    <p className="text-[#e9edef] font-semibold text-sm mb-1">No messages here yet</p>
                    <p className="text-[#8696a0] text-xs max-w-xs leading-relaxed">
                      Say hello, share a voice note, or drop code snippets. All messages disappear automatically in 1 hour.
                    </p>
                  </motion.div>
                )}

                {visibleMessages.map(msg => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    isOwn={msg.senderId === user.uid} 
                    onImageClick={(url) => setLightboxImage(url)}
                    onOpenFullscreenCode={(codeData) => setFullscreenCodeData(codeData)}
                    onReact={(msgId, emoji) => handleToggleReaction(msgId, emoji)}
                    onTogglePin={(msgId, currentPin) => handleTogglePin(msgId, currentPin)}
                    onDeleteMessage={(msg) => setDeleteConfirmMessage(msg)}
                    currentUserId={user.uid}
                    isSelectMode={isSelectMode}
                    isSelected={selectedMessageIds.includes(msg.id)}
                    onToggleSelect={(msgId) => {
                      setSelectedMessageIds(prev => 
                        prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]
                      );
                    }}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area (or Blocked Banner) */}
            {(() => {
              const otherUid = activeChat.type === 'dm' ? activeChat.participants.find(p => p !== user.uid) : undefined;
              const isBlocked = otherUid ? (user.blockedUsers?.includes(otherUid) || false) : false;

              if (isBlocked && otherUid) {
                return (
                  <div className="bg-[#202c33] p-4 flex items-center justify-between border-t border-red-500/30">
                    <div className="flex items-center gap-2.5 text-red-400 text-sm">
                      <Ban className="w-5 h-5 shrink-0" />
                      <span>You have blocked this contact. Unblock to send messages or make calls.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleBlock(otherUid)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold rounded-xl border border-red-500/30 text-xs transition"
                    >
                      Unblock
                    </button>
                  </div>
                );
              }

              if (isRecordingVoiceNote) {
                return (
                  <div className="bg-[#202c33] p-2.5 flex items-center border-t border-[#2e3b43]/50">
                    <VoiceNoteRecorder 
                      onSend={handleSendVoiceNote}
                      onCancel={() => setIsRecordingVoiceNote(false)}
                      showNotification={showNotification}
                    />
                  </div>
                );
              }

              return (
                <div className="bg-[#202c33] p-2.5 flex flex-col gap-2 relative border-t border-[#2e3b43]/50">
                  {/* Quick Emoji Tray */}
                  <AnimatePresence>
                    {showEmojiTray && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="bg-[#182229]/95 backdrop-blur-md border border-[#3b4a54] rounded-2xl p-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shadow-xl select-none"
                      >
                        {['😀', '😂', '🔥', '❤️', '👍', '🎉', '✨', '🚀', '👋', '💯', '🙌', '😍', '💡', '😎', '👏', '🙏'].map(emoji => (
                          <motion.button
                            key={emoji}
                            whileHover={{ scale: 1.25 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => {
                              setNewMessage(prev => prev + emoji);
                            }}
                            className="p-1.5 text-lg hover:bg-[#202c33] rounded-lg transition"
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2">
                    {/* Emoji toggle button */}
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      type="button"
                      onClick={() => setShowEmojiTray(!showEmojiTray)}
                      className={cn(
                        "p-2 rounded-full transition-colors",
                        showEmojiTray ? "text-[#00a884] bg-[#2a3942]" : "text-[#8696a0] hover:text-[#e9edef]"
                      )}
                      title="Quick emojis"
                    >
                      <Smile className="w-5 h-5" />
                    </motion.button>

                    {/* Attachment options dropdown */}
                    <div className="relative">
                      <motion.button 
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          showAttachMenu ? "bg-[#3b4a54] text-[#00a884]" : "text-[#8696a0] hover:text-[#e9edef]"
                        )}
                        title="Attach media or document"
                        disabled={isUploading}
                      >
                        <Paperclip className="w-5 h-5" />
                      </motion.button>

                      <AnimatePresence>
                        {showAttachMenu && (
                          <motion.div 
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-14 left-0 bg-[#202c33] rounded-2xl shadow-2xl border border-[#3b4a54] p-2 flex flex-col gap-1 z-50 w-56 text-sm backdrop-blur-md"
                          >
                            <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#111b21] cursor-pointer text-[#e9edef] transition">
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Photos & Videos</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,video/*" 
                                onChange={(e) => handleFileUpload(e, 'media')}
                                disabled={isUploading}
                              />
                            </label>

                            <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#111b21] cursor-pointer text-[#e9edef] transition">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                <FileText className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Document / File</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="*/*" 
                                onChange={(e) => handleFileUpload(e, 'doc')}
                                disabled={isUploading}
                              />
                            </label>

                            <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#111b21] cursor-pointer text-[#e9edef] transition">
                              <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                                <Camera className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Camera</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                capture="environment" 
                                onChange={(e) => handleFileUpload(e, 'camera')}
                                disabled={isUploading}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachMenu(false);
                                setShowCodeModal(true);
                              }}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#111b21] cursor-pointer text-[#e9edef] transition text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <Code className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Code Snippet (10k+ lines)</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Quick Code Share Button */}
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      type="button"
                      onClick={() => setShowCodeModal(true)}
                      className="p-2 text-[#8696a0] hover:text-[#00a884] rounded-full transition-colors hidden sm:flex"
                      title="Share code snippet (10,000+ lines)"
                    >
                      <Code className="w-5 h-5" />
                    </motion.button>

                    <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                      <div className="flex-1 bg-[#2a3942] rounded-xl px-4 py-2 border border-transparent focus-within:border-[#00a884]/60 transition-all flex items-center">
                        <input 
                          type="text" 
                          placeholder={isUploading ? "Uploading file..." : "Type a message"} 
                          className="w-full bg-transparent border-none outline-none text-[#e9edef] text-sm placeholder:text-[#8696a0]"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          disabled={isUploading}
                        />
                      </div>

                      <AnimatePresence mode="wait">
                        {newMessage.trim() ? (
                          <motion.button 
                            key="send-btn"
                            initial={{ scale: 0.7, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0.7, rotate: 20 }}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            type="submit" 
                            className="p-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full shadow-md shadow-[#00a884]/25 transition flex items-center justify-center shrink-0"
                            disabled={isUploading}
                            title="Send message"
                          >
                            <Send className="w-5 h-5" />
                          </motion.button>
                        ) : (
                          <motion.button
                            key="mic-btn"
                            initial={{ scale: 0.7 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.7 }}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            type="button"
                            onClick={() => setIsRecordingVoiceNote(true)}
                            className="p-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full shadow-md shadow-[#00a884]/25 transition flex items-center justify-center shrink-0"
                            title="Record voice note"
                          >
                            <Mic className="w-5 h-5" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </form>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="text-center p-8 max-w-xl mx-auto flex flex-col items-center justify-center select-none">
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="relative mb-6"
            >
              <div className="w-24 h-24 rounded-3xl bg-[#00a884]/20 animate-pulse absolute inset-0 blur-xl"></div>
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#00a884] to-[#008f6f] flex items-center justify-center shadow-2xl shadow-[#00a884]/30 relative z-10 border border-emerald-400/30">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
            </motion.div>

            <h2 className="text-2xl sm:text-3xl font-bold text-[#e9edef] tracking-tight mb-2">
              ChatWave Secure Messaging
            </h2>
            <p className="text-[#8696a0] text-sm leading-relaxed mb-8 max-w-md">
              Encrypted messaging with peer-to-peer WebRTC voice calling, automatic 1-hour self-destructing messages, and full developer code sharing.
            </p>

            {/* Feature Highlight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8">
              <div className="bg-[#202c33]/70 border border-[#3b4a54]/40 rounded-2xl p-3.5 text-left transition hover:border-[#00a884]/50">
                <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center mb-2 font-bold text-xs">
                  ⏱️
                </div>
                <h4 className="text-xs font-semibold text-[#e9edef] mb-0.5">1-Hr Self Destruct</h4>
                <p className="text-[11px] text-[#8696a0] leading-snug">All messages auto-delete after 1 hour.</p>
              </div>

              <div className="bg-[#202c33]/70 border border-[#3b4a54]/40 rounded-2xl p-3.5 text-left transition hover:border-[#00a884]/50">
                <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center mb-2 font-bold text-xs">
                  📞
                </div>
                <h4 className="text-xs font-semibold text-[#e9edef] mb-0.5">Voice Calling</h4>
                <p className="text-[11px] text-[#8696a0] leading-snug">High-fidelity encrypted WebRTC audio calls.</p>
              </div>

              <div className="bg-[#202c33]/70 border border-[#3b4a54]/40 rounded-2xl p-3.5 text-left transition hover:border-[#00a884]/50">
                <div className="w-8 h-8 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center mb-2 font-bold text-xs">
                  💻
                </div>
                <h4 className="text-xs font-semibold text-[#e9edef] mb-0.5">Code Snippets</h4>
                <p className="text-[11px] text-[#8696a0] leading-snug">Share 10,000+ lines with syntax themes.</p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowScanner(true)}
                className="px-5 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold text-xs rounded-xl transition shadow-lg shadow-[#00a884]/20 flex items-center gap-2"
              >
                <Scan className="w-4 h-4" />
                <span>Scan Friend's QR</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowGroupModal(true)}
                className="px-5 py-2.5 bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] font-medium text-xs rounded-xl transition border border-[#3b4a54] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group</span>
              </motion.button>
            </div>

            <div className="mt-8 flex items-center gap-1.5 text-[11px] text-[#8696a0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></span>
              <span>🔒 End-to-end encrypted & ephemeral</span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showProfileModal && (
          <ProfileModal 
            user={user} 
            onClose={() => setShowProfileModal(false)} 
            onUpdate={(data) => setUser(prev => prev ? { ...prev, ...data } : null)} 
            showNotification={showNotification}
            onToggleBlock={handleToggleBlock}
            usersCache={usersCache}
            remainingSeconds={sessionRemainingSeconds}
            onDeleteSession={handleDeleteSession}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFindPeopleModal && (
          <FindPeopleModal 
            user={user}
            chats={chats}
            onClose={() => setShowFindPeopleModal(false)}
            onStartChat={handleStartDirectChat}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupInfo && activeChat && (
          <GroupInfoModal 
            chat={activeChat} 
            user={user} 
            onClose={() => setShowGroupInfo(false)} 
            onLeave={handleLeaveGroup} 
            onCopyInvite={handleCopyGroupInvite} 
            showNotification={showNotification} 
            onAddMember={handleAddMemberToGroup}
            activeUsers={activeUsersList}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <QRScannerModal 
            onClose={() => setShowScanner(false)} 
            onScan={handleScanQR} 
            showNotification={showNotification}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#202c33] p-6 rounded-2xl w-full max-w-md border border-[#3b4a54] max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[#e9edef]">{isCreatingGroup ? 'Create New Group' : 'Join Group by Code'}</h2>
                  <p className="text-xs text-[#8696a0]">{isCreatingGroup ? 'Add anyone on ChatWave by their name' : 'Enter a 6-digit group invite code'}</p>
                </div>
                <button onClick={() => { setShowGroupModal(false); setSelectedGroupMemberUids([]); setGroupMemberSearch(''); }} className="text-[#8696a0] hover:text-[#e9edef] p-1"><X className="w-5 h-5" /></button>
              </div>

              {isCreatingGroup ? (
                <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                  <div>
                    <label className="text-xs font-semibold text-[#00a884] block mb-1.5 uppercase tracking-wider">Group Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Project Wave, Gaming Squad..." 
                      className="w-full bg-[#2a3942] border border-[#3b4a54] outline-none text-[#e9edef] rounded-xl px-4 py-2.5 text-sm focus:border-[#00a884] transition" 
                      value={newGroupName} 
                      onChange={(e) => setNewGroupName(e.target.value)} 
                      autoFocus
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
                        Add Members by Name ({selectedGroupMemberUids.length} selected)
                      </label>
                    </div>

                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-[#8696a0] absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Search people to add..." 
                        value={groupMemberSearch}
                        onChange={(e) => setGroupMemberSearch(e.target.value)}
                        className="w-full bg-[#111b21] border border-[#3b4a54] text-xs text-[#e9edef] rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-[#00a884]"
                      />
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                      {activeUsersList
                        .filter(cand => cand.uid !== user.uid && (!cand.expiresAt || Date.now() <= cand.expiresAt))
                        .filter(cand => !groupMemberSearch.trim() || (cand.displayName || '').toLowerCase().includes(groupMemberSearch.toLowerCase().trim()))
                        .length === 0 ? (
                        <div className="text-center py-4 text-[#8696a0] text-xs">
                          {activeUsersList.filter(cand => cand.uid !== user.uid).length === 0 
                            ? 'No other users online right now. You can create the group now and share the group code!' 
                            : `No active user matches "${groupMemberSearch}"`}
                        </div>
                      ) : (
                        activeUsersList
                          .filter(cand => cand.uid !== user.uid && (!cand.expiresAt || Date.now() <= cand.expiresAt))
                          .filter(cand => !groupMemberSearch.trim() || (cand.displayName || '').toLowerCase().includes(groupMemberSearch.toLowerCase().trim()))
                          .map(cand => {
                            const isSelected = selectedGroupMemberUids.includes(cand.uid);
                            return (
                              <div 
                                key={cand.uid} 
                                onClick={() => {
                                  setSelectedGroupMemberUids(prev => 
                                    isSelected ? prev.filter(id => id !== cand.uid) : [...prev, cand.uid]
                                  );
                                }}
                                className={cn(
                                  "flex items-center justify-between p-2 rounded-xl cursor-pointer transition text-xs select-none",
                                  isSelected 
                                    ? "bg-[#00a884]/20 border border-[#00a884]/50" 
                                    : "bg-[#111b21] hover:bg-[#182229] border border-[#2e3b43]"
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img src={cand.photoURL || getAvatarUrl(cand.uid)} className="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
                                  <span className="text-[#e9edef] font-medium truncate">{cand.displayName}</span>
                                </div>
                                <div className={cn(
                                  "w-4 h-4 rounded flex items-center justify-center border transition-all",
                                  isSelected ? "bg-[#00a884] border-[#00a884]" : "border-[#8696a0]"
                                )}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={handleCreateGroup} 
                    disabled={!newGroupName.trim()}
                    className="w-full bg-[#00a884] text-white font-bold py-3 rounded-xl hover:bg-[#008f6f] disabled:opacity-50 transition shadow-lg shadow-[#00a884]/20 text-sm flex items-center justify-center gap-2"
                  >
                    <span>Create Group ({selectedGroupMemberUids.length + 1} members)</span>
                  </button>

                  <button 
                    onClick={() => setIsCreatingGroup(false)} 
                    className="w-full text-[#00a884] text-xs font-medium hover:underline text-center"
                  >
                    Have a 6-digit code? Join an existing group instead
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="6-digit code" 
                    maxLength={6} 
                    className="w-full bg-[#2a3942] border border-[#3b4a54] outline-none text-[#e9edef] rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-mono focus:border-[#00a884]" 
                    value={groupCode} 
                    onChange={(e) => setGroupCode(e.target.value)} 
                    autoFocus
                  />
                  <button 
                    onClick={handleJoinGroup} 
                    disabled={groupCode.trim().length !== 6}
                    className="w-full bg-[#00a884] text-white font-bold py-3 rounded-xl hover:bg-[#008f6f] disabled:opacity-50 transition shadow-lg shadow-[#00a884]/20 text-sm"
                  >
                    Join Group
                  </button>
                  <button 
                    onClick={() => { loadActiveUsers(); setIsCreatingGroup(true); }} 
                    className="w-full text-[#00a884] text-xs font-medium hover:underline text-center"
                  >
                    Create a new group instead
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-8 rounded-3xl flex flex-col items-center">
              <h2 className="text-2xl font-bold text-[#111b21] mb-2">Group Invite</h2>
              <p className="text-gray-500 mb-6 font-mono text-lg">Code: {showQR}</p>
              <div className="p-4 bg-white rounded-xl border-4 border-[#00a884]"><QRCodeSVG value={showQR} size={200} /></div>
              <button onClick={() => setShowQR(null)} className="mt-8 bg-[#111b21] text-white px-8 py-2 rounded-full font-medium">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Preview */}
      <AnimatePresence>
        {lightboxImage && (
          <div 
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[200] backdrop-blur-md cursor-zoom-out"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            >
              <button 
                onClick={() => setLightboxImage(null)} 
                className="absolute -top-12 right-0 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
              >
                <X className="w-7 h-7" />
              </button>
              <img 
                src={lightboxImage} 
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl" 
                alt="Enlarged preview" 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice-Only Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] backdrop-blur-xl">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center max-w-sm w-full bg-[#1f2c34] p-8 rounded-3xl border border-[#3b4a54] shadow-2xl">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-[#00a884]/20 animate-ping absolute inset-0"></div>
                <img 
                  src={incomingCall.callerPhoto || getAvatarUrl(incomingCall.callerId, null)} 
                  alt={incomingCall.callerName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#00a884] shadow-lg relative z-10"
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {incomingCall.callerName || 'Unknown Caller'}
              </h2>
              <div className="flex items-center gap-2 text-[#00a884] font-medium text-sm mb-8 animate-pulse">
                <Phone className="w-4 h-4" />
                <span>Incoming Voice Call...</span>
              </div>
              
              <div className="flex items-center justify-center gap-12 w-full">
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={endCall} 
                    className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition active:scale-95 shadow-lg shadow-red-500/30"
                    title="Decline call"
                  >
                    <Phone className="w-8 h-8 rotate-[135deg]" />
                  </button>
                  <span className="text-xs text-[#8696a0]">Decline</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={acceptCall} 
                    className="w-16 h-16 bg-[#00a884] hover:bg-[#008f6f] rounded-full flex items-center justify-center text-white transition active:scale-95 shadow-lg shadow-[#00a884]/30"
                    title="Accept voice call"
                  >
                    <Phone className="w-8 h-8 animate-bounce" />
                  </button>
                  <span className="text-xs text-[#8696a0]">Accept</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Voice-Only Active Call Screen */}
      <AnimatePresence>
        {activeCall && (
          <div className="fixed inset-0 bg-[#0b141a] z-[100] flex flex-col justify-between">
            {/* Hidden audio element receiving remote voice audio stream */}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            {/* Top Bar */}
            <div className="bg-[#1f2c34] p-4 flex items-center justify-between border-b border-[#3b4a54] shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <div>
                  <h3 className="text-white font-medium text-base">
                    {activeCall.chatName || (activeCall.isGroup ? 'Group Voice Call' : 'Direct Voice Call')}
                  </h3>
                  <p className="text-xs text-[#00a884] font-medium flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    <span>Connected • {Math.floor(activeCallSeconds / 60)}:{String(activeCallSeconds % 60).padStart(2, '0')}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={endCall} 
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-semibold transition"
              >
                End Call
              </button>
            </div>

            {/* Middle Voice Pulse Animation */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-6 text-center">
              <div className="relative mb-8 flex items-center justify-center">
                <div className="w-44 h-44 rounded-full bg-[#00a884]/10 animate-ping absolute"></div>
                <div className="w-36 h-36 rounded-full bg-[#00a884]/20 animate-pulse absolute"></div>
                <div className="w-28 h-28 rounded-full bg-[#1f2c34] border-4 border-[#00a884] shadow-2xl flex items-center justify-center relative z-10">
                  <Phone className="w-12 h-12 text-[#00a884]" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-[#e9edef] mb-2">
                {activeCall.chatName || 'In Voice Call'}
              </h2>
              <p className="text-[#8696a0] text-sm max-w-xs mb-4">
                Voice audio is encrypted and connected via WebRTC.
              </p>

              {/* Soundwave bars animation */}
              <div className="flex items-center gap-1.5 h-12">
                {[12, 28, 16, 36, 20, 44, 28, 48, 22, 38, 18, 40, 24, 32, 14, 20].map((maxH, i) => (
                  <motion.div
                    key={i}
                    animate={isMuted ? { height: 4 } : { height: [6, maxH, 10, maxH * 0.8, 6] }}
                    transition={{ repeat: Infinity, duration: 0.65, delay: i * 0.05, ease: "easeInOut" }}
                    className={cn(
                      "w-1.5 rounded-full transition-all",
                      isMuted ? "bg-red-500/40" : "bg-[#00a884] shadow-sm shadow-[#00a884]/50"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Controls Bar */}
            <div className="bg-[#1f2c34] p-6 flex justify-center items-center gap-8 border-t border-[#3b4a54]">
              <button 
                onClick={toggleMute}
                className={cn(
                  "w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95",
                  isMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-[#2a3942] text-[#e9edef] hover:bg-[#3b4a54]"
                )}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button 
                onClick={endCall} 
                className="w-16 h-16 bg-red-600 hover:bg-red-700 active:scale-95 rounded-full flex items-center justify-center text-white transition-all shadow-xl shadow-red-600/30"
                title="End voice call"
              >
                <Phone className="w-8 h-8 rotate-[135deg]" />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* User Blocking & Contact Profile Modal */}
      <AnimatePresence>
        {contactProfileModalUser && (
          <ContactProfileModal
            user={contactProfileModalUser}
            currentUserId={user.uid}
            isBlocked={user.blockedUsers?.includes(contactProfileModalUser.uid) || false}
            onToggleBlock={(uid) => handleToggleBlock(uid)}
            onStartCall={() => {
              setContactProfileModalUser(null);
              startVoiceCall();
            }}
            onClose={() => setContactProfileModalUser(null)}
          />
        )}
      </AnimatePresence>

      {/* Batch Message Deletion Modal */}
      <AnimatePresence>
        {showBatchDeleteModal && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.92, opacity: 0 }} 
              className="bg-[#202c33] p-6 rounded-2xl w-full max-w-sm border border-[#3b4a54] text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#e9edef] mb-1">
                Delete {selectedMessageIds.length} message{selectedMessageIds.length > 1 ? 's' : ''}?
              </h3>
              <p className="text-xs text-[#8696a0] mb-5 leading-relaxed">
                Choose whether to delete these messages for everyone or delete them only from your chat history.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleBatchDeleteForEveryone}
                  className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition shadow"
                >
                  Delete for everyone
                </button>
                <button
                  onClick={handleBatchDeleteForMe}
                  className="w-full py-2.5 px-4 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] text-xs font-semibold rounded-xl transition"
                >
                  Delete for me
                </button>
                <button
                  onClick={() => setShowBatchDeleteModal(false)}
                  className="w-full py-2 text-[#8696a0] hover:text-[#e9edef] text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp-Style Delete Message Modal (Delete for everyone / Delete for me) */}
      <AnimatePresence>
        {deleteConfirmMessage && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.92, opacity: 0 }} 
              className="bg-[#202c33] p-6 rounded-2xl w-full max-w-sm border border-[#3b4a54] text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#e9edef] mb-1">Delete message?</h3>
              <p className="text-xs text-[#8696a0] mb-5 leading-relaxed">
                {deleteConfirmMessage.senderId === user.uid 
                  ? "Choose whether to delete this message for everyone or delete it only from your chat view."
                  : "Remove this message from your chat history."}
              </p>

              <div className="flex flex-col gap-2">
                {deleteConfirmMessage.senderId === user.uid && (
                  <button
                    onClick={() => handleDeleteForEveryone(deleteConfirmMessage)}
                    className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition shadow"
                  >
                    Delete for everyone
                  </button>
                )}
                <button
                  onClick={() => handleDeleteForMe(deleteConfirmMessage)}
                  className="w-full py-2.5 px-4 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] text-xs font-semibold rounded-xl transition"
                >
                  Delete for me
                </button>
                <button
                  onClick={() => setDeleteConfirmMessage(null)}
                  className="w-full py-2 text-[#8696a0] hover:text-[#e9edef] text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Chat Confirmation Modal */}
      <AnimatePresence>
        {showClearChatModal && activeChat && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.92, opacity: 0 }} 
              className="bg-[#202c33] p-6 rounded-2xl w-full max-w-sm border border-[#3b4a54] text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#e9edef] mb-1">Clear messages?</h3>
              <p className="text-xs text-[#8696a0] mb-5 leading-relaxed">
                Clear all chat messages and code history.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleClearChatForEveryone}
                  className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl transition shadow"
                >
                  Clear for everyone
                </button>
                <button
                  onClick={handleClearChatForMe}
                  className="w-full py-2.5 px-4 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] text-xs font-semibold rounded-xl transition"
                >
                  Clear for me
                </button>
                <button
                  onClick={() => setShowClearChatModal(false)}
                  className="w-full py-2 text-[#8696a0] hover:text-[#e9edef] text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* In-app Toast Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[250] bg-[#202c33]/95 backdrop-blur-md text-[#e9edef] px-5 py-2.5 rounded-2xl border border-[#00a884]/60 shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-medium shadow-[#00a884]/10"
          >
            <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping shrink-0"></span>
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
