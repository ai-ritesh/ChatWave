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
  FileCode
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
  photoURL?: string;
  isGuest?: boolean;
}

interface Chat {
  id: string;
  type: 'dm' | 'group';
  name: string;
  participants: string[];
  groupCode?: string;
  lastMessage?: string;
  lastMessageAt?: any;
  createdBy?: string;
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
  type: 'text' | 'image' | 'video' | 'file' | 'code' | 'call';
  code?: string;
  codeLanguage?: string;
  codeTitle?: string;
  codeLineCount?: number;
  reactions?: Record<string, string[]>;
  isPinned?: boolean;
  createdAt: any;
}

// --- Components ---

const Auth = ({ onAuth }: { onAuth: (user: UserProfile) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (isLogin) {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }
      const user = result.user;
      const profile = {
        uid: user.uid,
        displayName: user.displayName || email.split('@')[0],
        photoURL: getAvatarUrl(user.uid, user.photoURL || undefined),
      };
      await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
      onAuth(profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profile = {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        photoURL: getAvatarUrl(user.uid, user.photoURL || undefined),
      };
      await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
      onAuth(profile);
    } catch (err: any) {
      setError(err.message);
      console.error('Google login failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;
      const profile = {
        uid: user.uid,
        displayName: `Guest_${user.uid.slice(0, 5)}`,
        photoURL: getAvatarUrl(user.uid),
        isGuest: true,
      };
      await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
      onAuth(profile);
    } catch (err: any) {
      setError(err.message);
      console.error('Guest login failed', err);
      if (err.code === 'auth/admin-restricted-operation') {
        setError('Guest login (Anonymous Auth) is not enabled in the Firebase Console. Please enable it in the Authentication > Sign-in method tab.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00a884]/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00a884]/5 blur-[120px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#202c33] p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-[#3b4a54] relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className="bg-[#00a884] p-5 rounded-3xl mb-5 shadow-lg shadow-[#00a884]/20"
          >
            <MessageCircle className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-[#e9edef] tracking-tight">ChatWave</h1>
          <p className="text-[#8696a0] text-sm mt-2 font-medium">Connect instantly, anywhere.</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm mb-8 text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-5 mb-8">
          <div className="space-y-4">
            <input 
              type="email" 
              placeholder="Email address" 
              className="w-full bg-[#2a3942] border border-transparent outline-none text-[#e9edef] rounded-xl px-5 py-4 focus:border-[#00a884] transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full bg-[#2a3942] border border-transparent outline-none text-[#e9edef] rounded-xl px-5 py-4 focus:border-[#00a884] transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#00a884] text-white font-bold py-4 rounded-xl hover:bg-[#008f6f] active:scale-[0.98] transition-all shadow-lg shadow-[#00a884]/20 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
          <p className="text-center text-[#8696a0] text-sm">
            {isLogin ? "New to ChatWave? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#00a884] font-bold hover:underline ml-1"
            >
              {isLogin ? 'Join now' : 'Log in'}
            </button>
          </p>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#3b4a54]"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#202c33] px-4 text-[#8696a0] font-bold tracking-widest">Or</span></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="bg-white text-[#111b21] font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-[#f0f2f5] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Google
          </button>

          <button 
            onClick={handleGuestLogin}
            disabled={loading}
            className="bg-[#3b4a54] text-[#e9edef] font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-[#4a5a64] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Users className="w-5 h-5" />
            Guest
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ChatItem: React.FC<{ chat: Chat, active: boolean, onClick: () => void, currentUserId: string }> = ({ chat, active, onClick, currentUserId }) => {
  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-[#202c33]",
        active ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
      )}
    >
      <div className="relative">
        <img 
          src={getAvatarUrl(chat.id)} 
          className="w-14 h-14 rounded-full bg-[#3b4a54] border-2 border-transparent object-cover" 
          alt={chat.name}
        />
        {chat.type === 'dm' && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#111b21] rounded-full"></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <h3 className="text-[#e9edef] font-semibold truncate">{chat.name}</h3>
          {chat.lastMessageAt && (
            <span className="text-[#8696a0] text-xs">
              {format(chat.lastMessageAt.toDate ? chat.lastMessageAt.toDate() : new Date(chat.lastMessageAt), 'HH:mm')}
            </span>
          )}
        </div>
        <p className="text-[#8696a0] text-sm truncate mt-0.5">
          {chat.lastMessage || (chat.type === 'group' ? 'New group created' : 'Start a conversation')}
        </p>
      </div>
    </motion.div>
  );
};

const MessageBubble: React.FC<{ 
  message: Message; 
  isOwn: boolean; 
  onImageClick?: (url: string) => void;
  onOpenFullscreenCode?: (data: CodeData) => void;
  onReact?: (msgId: string, emoji: string) => void;
  onTogglePin?: (msgId: string, currentPin?: boolean) => void;
  currentUserId?: string;
}> = ({ 
  message, 
  isOwn, 
  onImageClick, 
  onOpenFullscreenCode,
  onReact,
  onTogglePin,
  currentUserId
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const reactionEmojis = ['👍', '❤️', '🚀', '🔥', '💻'];

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

  return (
    <motion.div 
      initial={{ opacity: 0, x: isOwn ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("flex mb-3.5 group relative", isOwn ? "justify-end" : "justify-start")}
    >
      <div className={cn(
        "max-w-[92%] sm:max-w-[80%] md:max-w-[70%] p-3 rounded-2xl shadow-md relative group/bubble",
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

        {/* Code Snippet Message */}
        {message.type === 'code' && (message.code || message.text) && (
          <div className="my-1">
            <CodeSnippetBlock
              code={message.code || message.text || ''}
              language={message.codeLanguage || 'typescript'}
              title={message.codeTitle}
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

        {/* File Attachment */}
        {message.type === 'file' && message.fileUrl && (
          <div className="flex items-center gap-3 p-3 bg-black/25 rounded-xl mb-2 border border-white/10">
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
        )}

        {/* Standard Text (if not a standalone code block) */}
        {!parsedMarkdownCode && message.type !== 'code' && (
          <p className="text-[14px] leading-relaxed pr-14 break-words whitespace-pre-wrap">{message.text}</p>
        )}

        {/* Reactions Chips */}
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
                      ? "bg-[#00a884]/30 border border-[#00a884] text-white" 
                      : "bg-[#111b21]/80 hover:bg-[#111b21] border border-[#3b4a54] text-[#e9edef]"
                  )}
                  title={`${uids.length} reactions`}
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

        {/* Hover Quick Action Buttons (Reactions & Pin) */}
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
              title="Add reaction"
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
        </div>
      </div>
    </motion.div>
  );
};

const ProfileModal = ({ user, onClose, onUpdate, showNotification }: { user: UserProfile, onClose: () => void, onUpdate: (data: Partial<UserProfile>) => void, showNotification: (msg: string) => void }) => {
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
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold text-[#e9edef]">Profile Settings</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-[#e9edef]"><X className="w-5 h-5" /></button>
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
        </form>
      </motion.div>
    </div>
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
  showNotification 
}: { 
  chat: Chat, 
  user: UserProfile, 
  onClose: () => void, 
  onLeave: () => void,
  onCopyInvite: () => void,
  showNotification: (msg: string) => void
}) => {
  const [participants, setParticipants] = useState<{ uid: string, displayName: string, photoURL?: string }[]>([]);
  const [loading, setLoading] = useState(true);

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
              <h4 className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider mb-2">
                Participants ({chat.participants.length})
              </h4>
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

  // Developer Code Sharing & Fullscreen Viewer state (supports 10,000+ lines of code)
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [fullscreenCodeData, setFullscreenCodeData] = useState<CodeData | null>(null);
  const [codeModalInitialCode, setCodeModalInitialCode] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [detectedLargeCode, setDetectedLargeCode] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };
  
  // Call state
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<any>(null);
  const callStatusUnsubRef = useRef<(() => void) | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Instantly unblock UI with auth profile info to eliminate wait time
        const fallbackUser: UserProfile = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? `Guest_${firebaseUser.uid.slice(0, 5)}` : (firebaseUser.email ? firebaseUser.email.split('@')[0] : `User_${firebaseUser.uid.slice(0, 5)}`)),
          photoURL: getAvatarUrl(firebaseUser.uid, firebaseUser.photoURL || undefined),
          isGuest: firebaseUser.isAnonymous,
        };
        setUser(fallbackUser);
        setAuthLoading(false);

        // Fetch custom Firestore profile in background asynchronously
        getDoc(doc(db, 'users', firebaseUser.uid))
          .then((userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data() as UserProfile;
              setUser({
                ...data,
                photoURL: getAvatarUrl(data.uid, data.photoURL)
              });
            }
          })
          .catch((err) => {
            console.warn('Background profile fetch skipped or offline:', err);
          });

        // Check for join code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');
        if (joinCode) {
          setGroupCode(joinCode);
          setShowGroupModal(true);
          // Clear URL param without reload
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
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

  // Call signaling
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ringingCall = snapshot.docs.find(d => d.data().status === 'ringing');
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
      const isCode = file.name.match(/\.(js|jsx|ts|tsx|py|html|css|json|md|sql|rs|go|c|cpp|java|php|rb|sh|yml|yaml)$/i);
      
      // If user uploaded a code file, automatically send as syntax-highlighted code!
      if (isCode && file.size < 1024 * 1024) {
        try {
          const codeText = await file.text();
          const ext = file.name.split('.').pop()?.toLowerCase() || 'typescript';
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
    
    try {
      const chatRef = await addDoc(collection(db, 'chats'), {
        name: newGroupName,
        type: 'group',
        participants: [user.uid],
        groupCode: code,
        createdBy: user.uid,
        lastMessageAt: serverTimestamp(),
      });

      setNewGroupName('');
      setIsCreatingGroup(false);
      setShowGroupModal(false);
      setActiveChat({ id: chatRef.id, name: newGroupName, type: 'group', participants: [user.uid], groupCode: code });
    } catch (error) {
      console.error('Failed to create group', error);
      handleFirestoreError(error, OperationType.CREATE, 'chats');
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
        setActiveChat({ id: existingChat.id, ...existingChat.data() } as Chat);
      } else {
        // Get scanned user's info
        const userDoc = await getDoc(doc(db, 'users', scannedUid));
        const scannedUser = userDoc.data();
        
        const chatRef = await addDoc(collection(db, 'chats'), {
          type: 'dm',
          name: scannedUser?.displayName || `User_${scannedUid.slice(0, 5)}`,
          participants: [user.uid, scannedUid],
          lastMessageAt: serverTimestamp(),
        });
        setActiveChat({ 
          id: chatRef.id, 
          type: 'dm', 
          name: scannedUser?.displayName || `User_${scannedUid.slice(0, 5)}`, 
          participants: [user.uid, scannedUid] 
        });
      }
      showNotification('Chat connected!');
    } catch (error) {
      console.error('Failed to start DM', error);
      showNotification('Could not connect with user.');
    }
  };

  const startCall = async (isAudioOnly = false) => {
    if (!activeChat || !user) return;
    const isGroup = activeChat.type === 'group';

    try {
      let userStream: MediaStream;
      try {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          showNotification('Camera and microphone are not supported in this browser.');
          return;
        }
        userStream = await navigator.mediaDevices.getUserMedia({ 
          video: !isAudioOnly, 
          audio: true 
        });
      } catch (mediaErr) {
        console.warn('Microphone/Camera permission denied or unavailable', mediaErr);
        showNotification('Could not access camera/microphone. Please ensure permissions are granted.');
        return;
      }

      setStream(userStream);
      setIsMuted(false);
      setIsVideoOff(isAudioOnly);

      if (isGroup) {
        const callRef = await addDoc(collection(db, 'calls'), {
          chatId: activeChat.id,
          chatName: activeChat.name,
          callerId: user.uid,
          callerName: user.displayName,
          isGroup: true,
          callType: isAudioOnly ? 'audio' : 'video',
          participants: [user.uid],
          status: 'active',
          createdAt: serverTimestamp(),
        });

        setActiveCall({ 
          id: callRef.id, 
          chatId: activeChat.id,
          chatName: activeChat.name,
          isGroup: true,
          callType: isAudioOnly ? 'audio' : 'video',
          isCaller: true,
          participants: [user.uid]
        });

        // Notify in group chat
        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderId: user.uid,
          senderName: user.displayName,
          text: `📞 Started a group ${isAudioOnly ? 'voice' : 'video'} call`,
          type: 'call',
          createdAt: serverTimestamp(),
        });
      } else {
        const receiverId = activeChat.participants.find(p => p !== user.uid);
        if (!receiverId) return;

        const callRef = await addDoc(collection(db, 'calls'), {
          chatId: activeChat.id,
          callerId: user.uid,
          callerName: user.displayName,
          receiverId: receiverId,
          participants: [user.uid, receiverId],
          isGroup: false,
          callType: isAudioOnly ? 'audio' : 'video',
          status: 'ringing',
          createdAt: serverTimestamp(),
        });

        setActiveCall({ 
          id: callRef.id, 
          receiverId, 
          isGroup: false,
          callType: isAudioOnly ? 'audio' : 'video',
          isCaller: true 
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

      showNotification(`${isGroup ? 'Group' : 'Direct'} ${isAudioOnly ? 'voice' : 'video'} call started!`);
    } catch (err) {
      console.error('Failed to start call', err);
      handleFirestoreError(err, OperationType.CREATE, 'calls');
      showNotification('Failed to initiate call.');
    }
  };

  const joinGroupCall = async (groupCall: any) => {
    if (!user) return;
    try {
      let userStream: MediaStream;
      try {
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
          showNotification('Media devices not supported.');
          return;
        }
        userStream = await navigator.mediaDevices.getUserMedia({
          video: groupCall.callType !== 'audio',
          audio: true
        });
      } catch (mediaErr) {
        console.warn('Microphone/Camera permission denied', mediaErr);
        showNotification('Could not access camera/microphone.');
        return;
      }

      setStream(userStream);
      setIsMuted(false);
      setIsVideoOff(groupCall.callType === 'audio');

      const updated = Array.from(new Set([...(groupCall.participants || []), user.uid]));
      await updateDoc(doc(db, 'calls', groupCall.id), { participants: updated });

      setActiveCall({
        ...groupCall,
        participants: updated,
        isCaller: false
      });
      setActiveGroupCall(null);
      showNotification('Joined group call!');
    } catch (err) {
      console.error('Failed to join group call', err);
      showNotification('Could not join group call.');
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

  const toggleVideo = () => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
      showNotification(!isVideoOff ? 'Camera turned off' : 'Camera turned on');
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
          showNotification('Camera and microphone are not supported in this environment.');
          return;
        }
        userStream = await navigator.mediaDevices.getUserMedia({ 
          video: incomingCall.callType !== 'audio', 
          audio: true 
        });
      } catch (mediaErr) {
        console.warn('Microphone/Camera permission denied or unavailable', mediaErr);
        showNotification('Could not access camera/microphone. Please ensure permissions are granted.');
        return;
      }
      setStream(userStream);
      setIsMuted(false);
      setIsVideoOff(incomingCall.callType === 'audio');
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
    showNotification('Call ended');
  };

  // Call signaling and peer connection
  useEffect(() => {
    if (activeCall && localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [activeCall, stream]);

  useEffect(() => {
    if (!activeCall || !stream) return;

    const callDoc = doc(db, 'calls', activeCall.id);
    let peer: any = null;

    try {
      peer = new Peer({ initiator: activeCall.isCaller, trickle: false, stream });
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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
    } catch (e) {
      console.error('Failed to instantiate Peer:', e);
      return;
    }

    const unsubscribe = onSnapshot(callDoc, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const signalToReceive = activeCall.isCaller ? data?.receiverSignal : data?.callerSignal;
      if (signalToReceive && peer && !peer.destroyed) {
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
  }, [activeCall, stream]);

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
    return <Auth onAuth={setUser} />;
  }

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-[400px] border-r border-[#3b4a54] flex flex-col transition-all",
        activeChat ? "hidden md:flex" : "flex"
      )}>
        {/* Header */}
        <div className="bg-[#202c33] p-4 flex justify-between items-center">
          <button 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-3 hover:bg-[#2a3942] p-1 rounded-lg transition-colors"
          >
            <img src={getAvatarUrl(user.uid, user.photoURL)} className="w-10 h-10 rounded-full border-2 border-[#00a884] object-cover" alt="Profile" />
            <span className="text-[#e9edef] font-medium truncate max-w-[120px]">{user.displayName}</span>
          </button>
          <div className="flex gap-4 text-[#8696a0]">
            <button onClick={() => setShowScanner(true)} title="Scan QR Code" className="hover:text-[#e9edef]"><Scan className="w-5 h-5" /></button>
            <button onClick={() => setShowGroupModal(true)} title="New Group" className="hover:text-[#e9edef]"><Plus /></button>
            <button onClick={() => signOut(auth)} title="Log Out" className="hover:text-[#e9edef]"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>

        {isOffline && (
          <div className="bg-amber-600/90 text-white text-xs px-4 py-1.5 flex items-center justify-between">
            <span>Offline mode &mdash; checking connection...</span>
          </div>
        )}

        {/* Search */}
        <div className="p-2 bg-[#111b21]">
          <div className="bg-[#202c33] flex items-center gap-4 px-4 py-1.5 rounded-lg">
            <Search className="w-5 h-5 text-[#8696a0]" />
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              className="bg-transparent border-none outline-none text-[#e9edef] text-sm w-full py-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chatsLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-[#202c33]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#202c33] rounded w-2/3" />
                    <div className="h-3 bg-[#202c33] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                <ChatItem 
                  key={chat.id} 
                  chat={chat} 
                  active={activeChat?.id === chat.id} 
                  onClick={() => setActiveChat(chat)}
                  currentUserId={user.uid}
                />
              ))}
              {chats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <MessageCircle className="w-16 h-16 text-[#3b4a54] mb-4" />
                  <p className="text-[#8696a0]">No chats yet. Create or join a group to start messaging!</p>
                </div>
              )}
            </>
          )}
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
                  <Video className="w-4 h-4" />
                  <span>Group {activeGroupCall.callType === 'audio' ? 'voice' : 'video'} call in progress ({activeGroupCall.participants?.length || 1} connected)</span>
                </div>
                <button 
                  onClick={() => joinGroupCall(activeGroupCall)}
                  className="bg-[#111b21] hover:bg-black text-white px-4 py-1 rounded-full text-xs font-bold transition shadow"
                >
                  Join Call
                </button>
              </div>
            )}

            {/* Chat Header */}
            <div className="bg-[#202c33] p-3 flex items-center justify-between shadow-md z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveChat(null)} className="md:hidden text-[#8696a0] mr-2">
                  <ArrowLeft />
                </button>
                <img 
                  src={getAvatarUrl(activeChat.id)} 
                  className="w-10 h-10 rounded-full object-cover" 
                  alt={activeChat.name}
                />
                <div>
                  <h3 className="text-[#e9edef] font-medium">{activeChat.name}</h3>
                  <p className="text-[#8696a0] text-xs">
                    {activeChat.type === 'group' ? `${activeChat.participants.length} participants` : 'online'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[#8696a0]">
                <button onClick={() => startCall(false)} title="Start video call" className="hover:text-[#e9edef] p-1.5 transition">
                  <Video className="w-5 h-5" />
                </button>
                <button onClick={() => startCall(true)} title="Start voice call" className="hover:text-[#e9edef] p-1.5 transition">
                  <Phone className="w-5 h-5" />
                </button>
                <button onClick={() => setShowQR(activeChat.groupCode || activeChat.id)} title="Group QR" className="hover:text-[#e9edef] p-1.5 transition">
                  <QrCode className="w-5 h-5" />
                </button>
                
                {/* Three Dots Menu */}
                <div className="relative">
                  <button 
                    onClick={() => setShowChatMenu(!showChatMenu)} 
                    title="More options" 
                    className="p-1.5 hover:bg-[#3b4a54]/50 rounded-full hover:text-[#e9edef] transition"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  {showChatMenu && (
                    <div className="absolute right-0 top-10 w-52 bg-[#202c33] rounded-xl shadow-2xl border border-[#3b4a54] py-1.5 z-50 text-sm">
                      <button 
                        onClick={() => { setShowGroupInfo(true); setShowChatMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                      >
                        <Info className="w-4 h-4 text-[#00a884]" />
                        <span>{activeChat.type === 'group' ? 'Group info' : 'Contact info'}</span>
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
                        onClick={() => { handleClearChat(); setShowChatMenu(false); }}
                        className="w-full px-4 py-2.5 text-left text-[#e9edef] hover:bg-[#111b21] flex items-center gap-2.5 transition"
                      >
                        <Trash2 className="w-4 h-4 text-[#8696a0]" />
                        <span>Clear messages</span>
                      </button>

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

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="flex flex-col">
                {messages.map(msg => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    isOwn={msg.senderId === user.uid} 
                    onImageClick={(url) => setLightboxImage(url)}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-[#202c33] p-2 flex items-center gap-2 relative">
              {/* Attachment options dropdown */}
              <div className="relative">
                <button 
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
                </button>

                {showAttachMenu && (
                  <div className="absolute bottom-14 left-0 bg-[#202c33] rounded-2xl shadow-2xl border border-[#3b4a54] p-2 flex flex-col gap-1 z-50 w-52 text-sm">
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
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder={isUploading ? "Uploading..." : "Type a message"} 
                  className="flex-1 bg-[#2a3942] border-none outline-none text-[#e9edef] rounded-lg px-4 py-2"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={isUploading}
                />
                <button 
                  type="submit" 
                  className="p-2 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] transition-colors"
                  disabled={!newMessage.trim() || isUploading}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="text-center p-8">
            <div className="bg-[#202c33] p-8 rounded-full inline-block mb-6">
              <MessageCircle className="w-24 h-24 text-[#3b4a54]" />
            </div>
            <h2 className="text-3xl font-light text-[#e9edef] mb-2">ChatWave Web</h2>
            <p className="text-[#8696a0] max-w-md mx-auto">
              Send and receive messages without keeping your phone online. Use ChatWave on up to 4 linked devices and 1 phone at the same time.
            </p>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#202c33] p-6 rounded-2xl w-full max-w-sm border border-[#3b4a54]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-[#e9edef]">{isCreatingGroup ? 'Create Group' : 'Join Group'}</h2>
                <button onClick={() => setShowGroupModal(false)} className="text-[#8696a0] hover:text-[#e9edef]"><X /></button>
              </div>
              {isCreatingGroup ? (
                <div className="space-y-4">
                  <input type="text" placeholder="Group Name" className="w-full bg-[#2a3942] border-none outline-none text-[#e9edef] rounded-lg px-4 py-3" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  <button onClick={handleCreateGroup} className="w-full bg-[#00a884] text-white font-bold py-3 rounded-lg hover:bg-[#008f6f]">Create</button>
                  <button onClick={() => setIsCreatingGroup(false)} className="w-full text-[#00a884] text-sm font-medium">Join an existing group instead</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input type="text" placeholder="6-digit code" maxLength={6} className="w-full bg-[#2a3942] border-none outline-none text-[#e9edef] rounded-lg px-4 py-3 text-center text-2xl tracking-widest" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} />
                  <button onClick={handleJoinGroup} className="w-full bg-[#00a884] text-white font-bold py-3 rounded-lg hover:bg-[#008f6f]">Join</button>
                  <button onClick={() => setIsCreatingGroup(true)} className="w-full text-[#00a884] text-sm font-medium">Create a new group instead</button>
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

      {/* Call Overlays */}
      <AnimatePresence>
        {incomingCall && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] backdrop-blur-xl">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-[#00a884] flex items-center justify-center mb-6 animate-pulse">
                {incomingCall.callType === 'audio' ? <Phone className="w-12 h-12 text-white" /> : <Video className="w-12 h-12 text-white" />}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Incoming {incomingCall.callType === 'audio' ? 'Voice' : 'Video'} Call
              </h2>
              <p className="text-[#8696a0] mb-12">from {incomingCall.callerName || 'Someone'}</p>
              <div className="flex gap-8">
                <button 
                  onClick={endCall} 
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition active:scale-95 shadow-lg shadow-red-500/30"
                  title="Decline"
                >
                  <Phone className="w-8 h-8 rotate-[135deg]" />
                </button>
                <button 
                  onClick={acceptCall} 
                  className="w-16 h-16 bg-[#00a884] hover:bg-[#008f6f] rounded-full flex items-center justify-center text-white transition active:scale-95 shadow-lg shadow-[#00a884]/30"
                  title="Accept"
                >
                  {incomingCall.callType === 'audio' ? <Phone className="w-8 h-8" /> : <Video className="w-8 h-8" />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCall && (
          <div className="fixed inset-0 bg-[#111b21] z-[100] flex flex-col">
            <div className="bg-[#202c33] p-4 flex items-center justify-between border-b border-[#3b4a54]">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <div>
                  <h3 className="text-white font-medium text-base">
                    {activeCall.chatName || (activeCall.isGroup ? 'Group Call' : 'Direct Call')}
                  </h3>
                  <p className="text-xs text-[#8696a0]">
                    {activeCall.callType === 'audio' ? 'Voice Call' : 'Video Call'} • {activeCall.participants?.length || 1} participant(s)
                  </p>
                </div>
              </div>
              <button 
                onClick={endCall} 
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
              >
                Leave
              </button>
            </div>

            <div className="flex-1 relative bg-[#0b141a] flex items-center justify-center overflow-hidden">
              {activeCall.callType === 'audio' || isVideoOff ? (
                <div className="text-center p-8">
                  <div className="w-32 h-32 rounded-full bg-[#202c33] border-4 border-[#00a884] mx-auto mb-6 flex items-center justify-center shadow-2xl animate-pulse">
                    <Users className="w-16 h-16 text-[#00a884]" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{activeCall.chatName || 'Call In Progress'}</h2>
                  <p className="text-[#8696a0] text-sm">
                    {activeCall.isGroup ? `${activeCall.participants?.length || 1} active connected` : 'Connected'}
                  </p>
                </div>
              ) : (
                <div className="w-full h-full relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-[#202c33] flex items-center justify-center">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                  {/* PiP Local Video Preview */}
                  <div className="absolute top-6 right-6 w-36 h-52 bg-black rounded-2xl overflow-hidden border-2 border-[#00a884] shadow-2xl">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  </div>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="bg-[#202c33] p-6 flex justify-center items-center gap-6 border-t border-[#3b4a54]">
              <button 
                onClick={toggleMute}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                  isMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-[#3b4a54] text-[#e9edef] hover:bg-[#4a5a64]"
                )}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button 
                onClick={toggleVideo}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
                  isVideoOff ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-[#3b4a54] text-[#e9edef] hover:bg-[#4a5a64]"
                )}
                title={isVideoOff ? "Turn on camera" : "Turn off camera"}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>

              <button 
                onClick={endCall} 
                className="w-16 h-16 bg-red-600 hover:bg-red-700 active:scale-95 rounded-full flex items-center justify-center text-white transition-all shadow-xl shadow-red-600/30"
                title="End call"
              >
                <Phone className="w-8 h-8 rotate-[135deg]" />
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* In-app Toast Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-[#202c33] text-[#e9edef] px-6 py-3 rounded-xl border border-[#00a884] shadow-2xl flex items-center gap-3 text-sm font-medium"
          >
            <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></span>
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
