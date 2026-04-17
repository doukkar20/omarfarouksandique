/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  where,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Newspaper, 
  Plus, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Send, 
  Download,
  Search,
  Menu,
  X,
  Building2,
  Calendar,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  CreditCard,
  TrendingDown,
  Filter,
  BarChart3,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  ChevronLeft,
  Image as ImageIcon,
  Bell,
  Volume2,
  BellRing,
  Mail,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { generateReceiptNo, generateHash, cn } from './lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

// Types
interface Apartment {
  id: string;
  number: string;
  ownerName: string;
  phone: string;
}

interface AppUser {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  lastLogin: string;
  role: 'admin' | 'user';
}

interface Receipt {
  id: string;
  receiptNo: string;
  apartmentId: string;
  amount: number;
  date: string;
  hash: string;
  status: 'paid' | 'unpaid';
}

interface BuildingContent {
  id: string;
  type: 'news' | 'project';
  title: string;
  details: string;
  imageUrl?: string;
  status: 'pending' | 'completed';
  progress?: number;
  createdAt: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  details: string;
  date: string;
}

interface Feedback {
  id: string;
  userId?: string;
  userEmail?: string;
  type: 'bug' | 'feedback' | 'maintenance';
  description: string;
  screenshotUrl?: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'alert' | 'update';
  createdAt: string;
  sentBy: string;
}

function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-white/5", className)}>
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-white/10 flex items-center justify-center">
          <ImageIcon size={32} className="text-white/10" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-all duration-700",
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-110"
        )}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function ConfirmDialogComponent({ dialog, onClose }: { 
  dialog: { title: string; message: string; onConfirm: () => void; type: 'danger' | 'warning'; requireInput?: string }; 
  onClose: () => void 
}) {
  const [inputValue, setInputValue] = useState('');
  const isConfirmed = !dialog.requireInput || inputValue === dialog.requireInput;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-8 text-center"
      >
        <div className={cn(
          "w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center",
          dialog.type === 'danger' ? "bg-red-500/10 text-red-500" : "bg-accent-gold/10 text-accent-gold"
        )}>
          <AlertTriangle size={32} />
        </div>
        
        <h3 className="text-xl font-bold mb-3">{dialog.title}</h3>
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          {dialog.message}
        </p>

        {dialog.requireInput && (
          <div className="mb-6">
            <input 
              type="text" autoFocus
              placeholder={`أدخل "${dialog.requireInput}" للتأكيد`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-center text-sm focus:border-red-500/50 transition-colors"
            />
          </div>
        )}
        
        <div className="flex flex-col gap-3">
          <button 
            disabled={!isConfirmed}
            onClick={dialog.onConfirm}
            className={cn(
              "w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
              dialog.type === 'danger' ? "bg-red-500 text-white hover:bg-red-600 shadow-red-500/20" : "bg-accent-gold text-background hover:bg-accent-gold/90 shadow-accent-gold/20"
            )}
          >
            تأكيد العملية
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm bg-white/5 border border-border text-text-secondary hover:bg-white/10 transition-all active:scale-95"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'apartments' | 'receipts' | 'content' | 'verify' | 'guide' | 'expenses' | 'feedback' | 'analytics'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Receipt Creation Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState<number>(100);
  const [receiptApartmentId, setReceiptApartmentId] = useState<string>('');
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);

  // Content Management Modal State
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [contentTitle, setContentTitle] = useState('');
  const [contentDetails, setContentDetails] = useState('');
  const [contentType, setContentType] = useState<'news' | 'project'>('news');
  const [contentImageUrl, setContentImageUrl] = useState('');
  const [contentStatus, setContentStatus] = useState<'pending' | 'completed'>('pending');
  const [contentProgress, setContentProgress] = useState<number>(0);
  const [isSubmittingContent, setIsSubmittingContent] = useState(false);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);

  // Apartment Management Modal State
  const [isApartmentModalOpen, setIsApartmentModalOpen] = useState(false);
  const [aptNumber, setAptNumber] = useState('');
  const [aptOwner, setAptOwner] = useState('');
  const [aptPhone, setAptPhone] = useState('');
  const [isSubmittingApartment, setIsSubmittingApartment] = useState(false);

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseDetails, setExpenseDetails] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Expense Filtering State
  const [expenseFilterStart, setExpenseFilterStart] = useState('');
  const [expenseFilterEnd, setExpenseFilterEnd] = useState('');
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('all');
  const [appliedExpenseFilterStart, setAppliedExpenseFilterStart] = useState('');
  const [appliedExpenseFilterEnd, setAppliedExpenseFilterEnd] = useState('');
  const [appliedExpenseFilterCategory, setAppliedExpenseFilterCategory] = useState('all');

  // Receipt Filtering State
  const [receiptFilterStart, setReceiptFilterStart] = useState('');
  const [receiptFilterEnd, setReceiptFilterEnd] = useState('');
  const [receiptFilterStatus, setReceiptFilterStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [receiptSortOrder, setReceiptSortOrder] = useState<'desc' | 'asc'>('desc');

  // Confirmation Dialogue State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
    requireInput?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  // Feedback Modal State
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feedback' | 'maintenance'>('feedback');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [feedbackScreenshotUrl, setFeedbackScreenshotUrl] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Broadcast Modal State (Push Notifications)
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'alert' | 'update'>('info');
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  
  // Read More Modal State
  const [readingItem, setReadingItem] = useState<BuildingContent | null>(null);

  // Data State
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [contents, setContents] = useState<BuildingContent[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Financial Summary
  const totalIncome = receipts.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Verification State
  const [verificationHash, setVerificationHash] = useState<string | null>(null);
  const [verifiedReceipt, setVerifiedReceipt] = useState<(Receipt & { apartment?: Apartment }) | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Update user profile in Firestore
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            name: user.displayName || 'Unnamed User',
            photoURL: user.photoURL || '',
            lastLogin: new Date().toISOString(),
          }, { merge: true });
        } catch (error) {
          console.error("Error updating user profile", error);
        }

        // Check admin role
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const adminEmails = ['doukkar@admin.com', 'benaissa@admin.com', 'doukkar2018@gmail.com'];
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else if (user.email && adminEmails.includes(user.email)) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status", error);
        }
      } else {
        setIsAdmin(false);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Check for hash in URL for verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = params.get('verify');
    if (hash) {
      setVerificationHash(hash);
      setActiveTab('verify');
    }
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!isAuthReady) return;

    // Apartments
    const unsubApartments = onSnapshot(collection(db, 'apartments'), (snapshot) => {
      setApartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Apartment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'apartments'));

    // Receipts
    const unsubReceipts = onSnapshot(query(collection(db, 'receipts'), orderBy('date', 'desc')), (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'receipts'));

    // Content
    const unsubContent = onSnapshot(query(collection(db, 'content'), orderBy('createdAt', 'desc')), (snapshot) => {
      setContents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuildingContent)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'content'));

    // Expenses
    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    // Feedback (Admin only)
    let unsubFeedback = () => {};
    if (isAdmin) {
      unsubFeedback = onSnapshot(query(collection(db, 'feedback'), orderBy('createdAt', 'desc')), (snapshot) => {
        setFeedbacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'feedback'));
    }

    // Notifications (Push simulation)
    const unsubNotifications = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), (snapshot) => {
      const newNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(newNotifs);
      
      // If we've already loaded initial data, identify added ones and show toast
      if (initialLoadComplete) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const addedNotif = { id: change.doc.id, ...change.doc.data() } as AppNotification;
            setActiveToast(addedNotif);
            // Play a subtle sound if possible or just show toast
            // Auto close toast after 8 seconds
            setTimeout(() => setActiveToast(null), 8000);
          }
        });
      }
      setInitialLoadComplete(true);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    // Users Listener (Admin only)
    let unsubUsers = () => {};
    if (isAdmin) {
      unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('lastLogin', 'desc')), (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAppUsers(usersList);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
    }

    return () => {
      unsubApartments();
      unsubReceipts();
      unsubContent();
      unsubExpenses();
      unsubFeedback();
      unsubNotifications();
      unsubUsers();
    };
  }, [isAuthReady, isAdmin]);

  // Verification Logic
  useEffect(() => {
    if (verificationHash) {
      const verify = async () => {
        setIsVerifying(true);
        try {
          const q = query(collection(db, 'receipts'), where('hash', '==', verificationHash));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const receiptData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Receipt;
            const aptDoc = await getDoc(doc(db, 'apartments', receiptData.apartmentId));
            setVerifiedReceipt({
              ...receiptData,
              apartment: aptDoc.exists() ? { id: aptDoc.id, ...aptDoc.data() } as Apartment : undefined
            });
          } else {
            setVerifiedReceipt(null);
          }
        } catch (error) {
          console.error("Verification error", error);
        } finally {
          setIsVerifying(false);
        }
      };
      verify();
    }
  }, [verificationHash]);

  const requestConfirmation = (
    title: string, 
    message: string, 
    onConfirm: () => void | Promise<void>, 
    type: 'danger' | 'warning' = 'danger',
    requireInput?: string
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        await onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      type,
      requireInput
    });
  };

  const handleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, new GoogleAuthProvider());
      setIsLoginModalOpen(false);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError('يرجى تفعيل تسجيل الدخول بـ Google في لوحة تحكم Firebase');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('تم إغلاق نافذة تسجيل الدخول');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore this error or show a subtle message
      } else {
        setAuthError('فشل تسجيل الدخول عبر Google');
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);
    
    // Map usernames to pseudo-emails
    let email = loginEmail;
    if (!email.includes('@')) {
      email = `${email.toLowerCase().trim()}@admin.com`;
    }

    try {
      await signInWithEmailAndPassword(auth, email, loginPassword);
      setIsLoginModalOpen(false);
    } catch (error: any) {
      console.error("Auth failed", error);
      if (error.code === 'auth/user-not-found') setAuthError('المستخدم غير موجود');
      else if (error.code === 'auth/wrong-password') setAuthError('كلمة المرور خاطئة');
      else if (error.code === 'auth/email-already-in-use') setAuthError('البريد الإلكتروني مستخدم بالفعل');
      else if (error.code === 'auth/weak-password') setAuthError('كلمة المرور ضعيفة جداً');
      else if (error.code === 'auth/operation-not-allowed') {
        const projectId = "gen-lang-client-0089842147";
        setAuthError(`يرجى تفعيل (Email/Password) في لوحة تحكم Firebase: https://console.firebase.google.com/project/${projectId}/authentication/providers`);
      }
      else setAuthError('فشلت العملية. يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const sendOverdueReminder = async (apt: Apartment, diffDays: number | string) => {
    // 1. Send WhatsApp Reminder
    const message = `السلام عليكم سيد(ة) ${apt.ownerName}، نود تذكيركم بضرورة تسوية واجبات السانديك المتأخرة لشقتكم رقم ${apt.number}. مدة التأخير: ${typeof diffDays === 'number' ? `${diffDays} يوم` : diffDays}. شكراً لتفهمكم.`;
    const encodedMessage = encodeURIComponent(message);
    
    // Format phone
    let phone = apt.phone.replace(/\s+/g, '');
    if (phone.startsWith('0')) phone = '212' + phone.substring(1);
    if (!phone.startsWith('+') && !phone.startsWith('212')) phone = '212' + phone;

    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');

    // 2. Create In-App Notification for Admin
    try {
      await addDoc(collection(db, 'notifications'), {
        title: 'تم إرسال تذكير أداء',
        body: `تم إرسال تذكير عبر واتساب لمالك الشقة ${apt.number} (${apt.ownerName}) بخصوص التأخير (${typeof diffDays === 'number' ? `${diffDays} يوم` : diffDays}).`,
        type: 'info',
        createdAt: new Date().toISOString(),
        sentBy: 'النظام'
      });
    } catch (err) {
      console.error("Failed to create admin notification", err);
    }
  };

  const generatePDF = (receipt: Receipt, apartment: Apartment) => {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    
    // Header
    doc.setFontSize(22);
    doc.text("Omar Al-Farouq Building", 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text("Payment Receipt", 105, 30, { align: 'center' });
    
    doc.line(20, 35, 190, 35);
    
    doc.setFontSize(12);
    doc.text(`Receipt No: ${receipt.receiptNo}`, 20, 50);
    doc.text(`Date: ${format(new Date(receipt.date), 'yyyy-MM-dd')}`, 140, 50);
    
    doc.text(`Apartment: ${apartment.number}`, 20, 65);
    doc.text(`Owner: ${apartment.ownerName}`, 20, 75);
    
    doc.setFontSize(16);
    doc.text(`Amount: ${receipt.amount} MAD`, 105, 95, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Status: PAID`, 105, 105, { align: 'center' });
    
    doc.text("Scan to Verify:", 105, 130, { align: 'center' });
    const verifyUrl = `${window.location.origin}?verify=${receipt.hash}`;
    doc.setFontSize(8);
    doc.text(verifyUrl, 105, 135, { align: 'center' });
    
    doc.save(`Receipt_${receipt.receiptNo}.pdf`);
  };

  const generateExpenseReport = (type: 'monthly' | 'yearly' | 'filtered') => {
    const doc = new jsPDF();
    const now = new Date();
    
    let reportTitle = "";
    let reportSubtitle = "";
    
    if (type === 'monthly') {
      reportTitle = "Monthly Financial Report";
      reportSubtitle = format(now, 'MMMM yyyy');
    } else if (type === 'yearly') {
      reportTitle = "Yearly Financial Report";
      reportSubtitle = format(now, 'yyyy');
    } else {
      reportTitle = "Custom Financial Report";
      reportSubtitle = `${appliedExpenseFilterStart || 'Start'} to ${appliedExpenseFilterEnd || 'End'} (${appliedExpenseFilterCategory})`;
    }

    doc.setFontSize(20);
    doc.text(`Omar Al-Farouq Building - ${reportTitle}`, 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text(reportSubtitle, 105, 25, { align: 'center' });

    const filteredExpenses = expenses.filter(e => {
      const eDate = new Date(e.date);
      
      if (type === 'monthly') {
        return eDate.getMonth() === now.getMonth() && eDate.getFullYear() === now.getFullYear();
      }
      if (type === 'yearly') {
        return eDate.getFullYear() === now.getFullYear();
      }
      
      // Custom filtering
      let matches = true;
      if (appliedExpenseFilterStart) {
        matches = matches && eDate >= new Date(appliedExpenseFilterStart);
      }
      if (appliedExpenseFilterEnd) {
        const endDateBound = new Date(appliedExpenseFilterEnd);
        endDateBound.setHours(23, 59, 59, 999);
        matches = matches && eDate <= endDateBound;
      }
      if (appliedExpenseFilterCategory !== 'all') {
        matches = matches && e.category === appliedExpenseFilterCategory;
      }
      return matches;
    });

    const filteredReceipts = receipts.filter(r => {
      const rDate = new Date(r.date);
      if (type === 'monthly') {
        return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
      }
      if (type === 'yearly') {
        return rDate.getFullYear() === now.getFullYear();
      }
      
      // Custom filtering for receipts (only date based if applicable)
      let matches = true;
      if (appliedExpenseFilterStart) {
        matches = matches && rDate >= new Date(appliedExpenseFilterStart);
      }
      if (appliedExpenseFilterEnd) {
        const endDateBound = new Date(appliedExpenseFilterEnd);
        endDateBound.setHours(23, 59, 59, 999);
        matches = matches && rDate <= endDateBound;
      }
      return matches;
    });

    const incomeSum = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);
    const expenseSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    doc.setFontSize(12);
    doc.text(`Financial Summary:`, 14, 40);
    doc.text(`Total Income: ${incomeSum} MAD`, 20, 50);
    doc.text(`Total Expenses: ${expenseSum} MAD`, 20, 57);
    doc.text(`Net Balance: ${incomeSum - expenseSum} MAD`, 20, 64);

    doc.text(`Expense Details:`, 14, 80);

    const tableData = filteredExpenses.map(e => [
      format(new Date(e.date), 'yyyy-MM-dd'),
      e.category,
      e.details,
      `${e.amount} MAD`
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Date', 'Category', 'Details', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [197, 160, 89] as any } // gold color
    });

    doc.save(`Financial_Report_${type}_${format(now, 'yyyy-MM-dd')}.pdf`);
  };

  const sendWhatsApp = (receipt: Receipt, apartment: Apartment) => {
    const verifyUrl = `${window.location.origin}?verify=${receipt.hash}`;
    const message = `السلام عليكم سيد(ة) ${apartment.ownerName}،\n\nتم إصدار إيصال الأداء الخاص بشقتكم رقم ${apartment.number}.\nرقم الإيصال: № ${receipt.receiptNo}\nالمبلغ: ${receipt.amount} درهم\nالتاريخ: ${format(new Date(receipt.date), 'yyyy/MM/dd')}\n\nيمكنكم معاينة الإيصال الرقمي والتحقق منه عبر الرابط التالي:\n${verifyUrl}\n\nشكراً لتعاونكم.\nسانديك عمارة عمر الفاروق`;
    const encodedMessage = encodeURIComponent(message);
    // Ensure phone starts with +212 if it's a local number
    let phone = apartment.phone.replace(/\s+/g, '');
    if (phone.startsWith('0')) phone = '212' + phone.substring(1);
    if (!phone.startsWith('+') && !phone.startsWith('212')) phone = '212' + phone;
    
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !broadcastTitle || !broadcastBody) return;

    setIsSubmittingBroadcast(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: broadcastTitle,
        body: broadcastBody,
        type: broadcastType,
        createdAt: new Date().toISOString(),
        sentBy: user?.email || 'Admin'
      });
      setIsBroadcastModalOpen(false);
      setBroadcastTitle('');
      setBroadcastBody('');
      setBroadcastType('info');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

    const overdueCount = apartments.filter(apt => {
    const aptReceipts = receipts.filter(r => r.apartmentId === apt.id);
    if (aptReceipts.length === 0) return true;
    const lastDate = new Date(Math.max(...aptReceipts.map(r => new Date(r.date).getTime())));
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return lastDate < oneMonthAgo;
  }).length;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-text-primary font-sans flex flex-col lg:flex-row" dir="rtl">
        {/* Real-time Toast (Push Notification simulation) */}
        <AnimatePresence>
          {activeToast && (
            <motion.div
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="fixed bottom-6 right-6 z-[200] w-full max-w-sm glass-dark border border-accent-gold/50 rounded-2xl p-6 shadow-2xl overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-1 h-full bg-accent-gold" />
              <div className="flex gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  activeToast.type === 'alert' ? "bg-red-500/20 text-red-400" : 
                  activeToast.type === 'update' ? "bg-blue-500/20 text-blue-400" : "bg-accent-gold/20 text-accent-gold"
                )}>
                  <BellRing size={24} className="animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent-gold">إشعار عاجل</span>
                    <button onClick={() => setActiveToast(null)} className="text-text-secondary hover:text-white transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <h4 className="text-sm font-black mb-1 truncate">{activeToast.title}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{activeToast.body}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          "lg:w-72 bg-card border-l border-border p-8 flex flex-col fixed lg:relative inset-y-0 right-0 z-50 transition-all duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0 shadow-2xl lg:shadow-none"
        )}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-gold flex items-center justify-center shadow-lg shadow-accent-gold/20">
                <Building2 className="text-background" size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tighter text-text-primary leading-none">سانديك</span>
                <span className="text-xs font-bold text-accent-gold uppercase tracking-[3px] mt-1">الفاروق</span>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-text-secondary p-2 hover:bg-white/5 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto scroll-hide">
            <ul className="space-y-1.5">
              <SidebarItem 
                icon={<LayoutDashboard size={20} />} 
                label="لوحة التحكم" 
                active={activeTab === 'dashboard'} 
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
              />
              <SidebarItem 
                icon={<Users size={20} />} 
                label="إدارة الشقق" 
                active={activeTab === 'apartments'} 
                onClick={() => { setActiveTab('apartments'); setIsSidebarOpen(false); }} 
                badge={apartments.length}
              />
              <SidebarItem 
                icon={<FileText size={20} />} 
                label="الإيصالات" 
                active={activeTab === 'receipts'} 
                onClick={() => { setActiveTab('receipts'); setIsSidebarOpen(false); }} 
                badge={receipts.length}
              />
              <SidebarItem 
                icon={<Newspaper size={20} />} 
                label="الأخبار والمشاريع" 
                active={activeTab === 'content'} 
                onClick={() => { setActiveTab('content'); setIsSidebarOpen(false); }} 
                badge={contents.length}
              />
              <SidebarItem 
                icon={<ShieldCheck size={20} />} 
                label="التحقق الرقمي" 
                active={activeTab === 'verify'} 
                onClick={() => { setActiveTab('verify'); setIsSidebarOpen(false); }} 
              />
              <SidebarItem 
                icon={<TrendingDown size={20} />} 
                label="تتبع المصاريف" 
                active={activeTab === 'expenses'} 
                onClick={() => { setActiveTab('expenses'); setIsSidebarOpen(false); }} 
                badge={expenses.length}
              />
              <SidebarItem 
                icon={<HelpCircle size={20} />} 
                label="دليل الاستخدام" 
                active={activeTab === 'guide'} 
                onClick={() => { setActiveTab('guide'); setIsSidebarOpen(false); }} 
              />
              {isAdmin && (
                <>
                  <SidebarItem 
                    icon={<MessageSquare size={20} />} 
                    label="البلاغات والآراء" 
                    active={activeTab === 'feedback'} 
                    onClick={() => { setActiveTab('feedback'); setIsSidebarOpen(false); }} 
                    badge={feedbacks.length}
                  />
                  <SidebarItem 
                    icon={<BarChart3 size={20} />} 
                    label="التحليلات" 
                    active={activeTab === 'analytics'} 
                    onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }} 
                  />
                </>
              )}
            </ul>
          </nav>

          <div className="mt-8 space-y-3">
            {isAdmin && (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsBroadcastModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 transition-all text-sm font-bold border border-accent-gold/20 group"
              >
                <Volume2 size={18} className="group-hover:scale-110 transition-transform" />
                <span>إرسال إشعار عاجل</span>
              </motion.button>
            )}
            
            {user && (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsFeedbackModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm font-bold border border-red-500/10 group"
              >
                <AlertCircle size={18} className="group-hover:rotate-12 transition-transform" />
                <span>بلغ عن مشكلة</span>
              </motion.button>
            )}
            
            <div className="p-4 rounded-2xl bg-white/5 border border-border">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold text-xs font-bold">
                      {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[10px] font-bold text-text-secondary uppercase">المشرف</span>
                      <span className="text-[11px] text-text-primary truncate font-medium">{user.email}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-500/80 hover:text-red-500 transition-colors"
                  >
                    <LogOut size={14} />
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="w-full btn-primary text-xs py-2.5"
                >
                  دخول السانديك
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="text-[9px] text-text-secondary font-mono tracking-widest opacity-50 uppercase">Verify-ID v1.0.4</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                <div className="w-1 h-1 rounded-full bg-success animate-pulse delay-100" />
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="lg:hidden bg-card border-b border-border p-4 flex justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Building2 className="text-accent-gold" size={24} />
            <span className="font-bold text-accent-gold">سانديك الفاروق</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="text-text-secondary">
            <Menu size={24} />
          </button>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-10 flex flex-col gap-8 overflow-y-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl lg:text-3xl font-bold">
              {activeTab === 'dashboard' && "إدارة الملاك والمدفوعات"}
              {activeTab === 'apartments' && "إدارة الشقق"}
              {activeTab === 'receipts' && "سجل الإيصالات"}
              {activeTab === 'content' && "الأخبار والمشاريع"}
              {activeTab === 'expenses' && "سجل المصاريف العامة"}
              {activeTab === 'verify' && "التحقق من الإيصالات"}
              {activeTab === 'guide' && "دليل الاستخدام"}
              {activeTab === 'feedback' && "بلاغات الأخطاء والملاحظات"}
              {activeTab === 'overdue' && "الملاك المتأخرون عن الأداء"}
            </h1>
            {activeTab === 'receipts' && isAdmin && (
              <button onClick={() => {
                setReceiptApartmentId('');
                setReceiptAmount(100);
                setIsReceiptModalOpen(true);
              }} className="btn-primary flex items-center gap-2">
                <Plus size={18} />
                إيصال جديد
              </button>
            )}
            {activeTab === 'apartments' && isAdmin && (
              <button onClick={() => {
                setAptNumber('');
                setAptOwner('');
                setAptPhone('');
                setIsApartmentModalOpen(true);
              }} className="btn-primary flex items-center gap-2">
                <Plus size={18} />
                إضافة شقة
              </button>
            )}
            {activeTab === 'expenses' && isAdmin && (
              <button onClick={() => {
                setExpenseCategory('');
                setExpenseAmount(0);
                setExpenseDetails('');
                setIsExpenseModalOpen(true);
              }} className="btn-primary flex items-center gap-2">
                <Plus size={18} />
                إضافة مصروف
              </button>
            )}
            {activeTab === 'content' && isAdmin && (
              <button onClick={() => {
                setEditingContentId(null);
                setContentTitle('');
                setContentDetails('');
                setContentType('news');
                setContentImageUrl('');
                setContentStatus('pending');
                setContentProgress(0);
                setIsContentModalOpen(true);
              }} className="btn-primary flex items-center gap-2">
                <Plus size={18} />
                إضافة محتوى
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="الرصيد الصافي" 
                    value={`${totalIncome - totalExpenses} د.م.`} 
                    icon={<BarChart3 size={20} />} 
                    isGold 
                    trend={`+${((totalIncome - totalExpenses) / (totalIncome || 1) * 100).toFixed(0)}%`}
                  />
                  <StatCard 
                    title="إجمالي المداخيل" 
                    value={`${totalIncome} د.م.`} 
                    icon={<CreditCard size={20} />} 
                  />
                  <StatCard 
                    title="إجمالي المصاريف" 
                    value={`${totalExpenses} د.م.`} 
                    icon={<TrendingDown size={20} />} 
                  />
                  <StatCard 
                    title="عدد الشقق" 
                    value={apartments.length} 
                    icon={<Building2 size={20} />} 
                  />
                  {isAdmin && (
                    <motion.div 
                      onClick={() => setActiveTab('apartments')}
                      className="cursor-pointer"
                    >
                      <StatCard 
                        title="شقق متأخرة" 
                        value={overdueCount} 
                        icon={<AlertTriangle size={20} />} 
                        trend={overdueCount > 0 ? "تنبيه" : "منتظم"}
                      />
                    </motion.div>
                  )}
                </div>

                {/* Transparency Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="card-base p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold flex items-center gap-2">
                        <ShieldCheck className="text-accent-gold" size={20} />
                        سبورة الحسابات الشفافة
                      </h2>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">تحديث فوري</span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="group p-5 bg-white/3 rounded-2xl border border-border hover:border-success/30 transition-all duration-300">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">المداخيل الكلية</span>
                          <span className="text-lg font-black text-success tracking-tight">+{totalIncome} د.م.</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} animate={{ width: "100%" }}
                            className="h-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          />
                        </div>
                      </div>

                      <div className="group p-5 bg-white/3 rounded-2xl border border-border hover:border-red-500/30 transition-all duration-300">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">المصاريف الكلية</span>
                          <span className="text-lg font-black text-red-500 tracking-tight">-{totalExpenses} د.م.</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${(totalExpenses / (totalIncome || 1)) * 100}%` }}
                            className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                          />
                        </div>
                      </div>

                      <div className="pt-6 border-t border-border flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-accent-gold uppercase tracking-[3px] mb-1">الرصيد المتوفر</span>
                          <span className="text-sm text-text-secondary lowercase">cash on hand</span>
                        </div>
                        <span className="text-4xl font-black text-accent-gold tracking-tighter drop-shadow-2xl">{totalIncome - totalExpenses} <span className="text-sm font-bold opacity-50">MAD</span></span>
                      </div>
                    </div>
                    <p className="text-[10px] text-text-secondary leading-relaxed">
                      * هذه الأرقام تعكس إجمالي المبالغ المسجلة في النظام. الشفافية هي أساس ثقتنا.
                    </p>
                  </div>

                  <div className="card-base p-6 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Newspaper className="text-accent-gold" size={20} />
                      المشاريع الجارية
                    </h2>
                    <div className="space-y-4">
                      {contents.filter(c => c.type === 'project').slice(0, 3).map(project => (
                        <div key={project.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{project.title}</span>
                            <span className="text-accent-gold font-bold">{project.progress || 0}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-border">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${project.progress || 0}%` }}
                              className="h-full bg-accent-gold"
                            />
                          </div>
                        </div>
                      ))}
                      {contents.filter(c => c.type === 'project').length === 0 && (
                        <div className="text-sm text-text-secondary text-center py-10">لا توجد مشاريع جارية حالياً</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-base overflow-hidden">
                  <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                    <h2 className="text-lg font-bold">آخر الإيصالات الصادرة</h2>
                    <button onClick={() => setActiveTab('receipts')} className="text-accent-gold text-sm font-bold hover:underline">عرض الكل</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-white/3">
                          <th className="px-6 py-4 text-xs font-medium text-text-secondary uppercase">رقم الإيصال</th>
                          <th className="px-6 py-4 text-xs font-medium text-text-secondary uppercase">الشقة</th>
                          <th className="px-6 py-4 text-xs font-medium text-text-secondary uppercase">المبلغ</th>
                          <th className="px-6 py-4 text-xs font-medium text-text-secondary uppercase">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {receipts.slice(0, 5).map(receipt => {
                          const apt = apartments.find(a => a.id === receipt.apartmentId);
                          return (
                            <tr key={receipt.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-mono text-sm text-accent-gold">№ {receipt.receiptNo}</td>
                              <td className="px-6 py-4 font-medium">{apt?.number || '---'}</td>
                              <td className="px-6 py-4">{receipt.amount} د.م.</td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20">
                                  مؤدى
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'apartments' && (
              <motion.div
                key="apartments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Overdue Section */}
                {isAdmin && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-red-500 rounded-full" />
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <AlertTriangle className="text-red-500" size={20} />
                        تنبيهات المتأخرات
                      </h2>
                    </div>
                    
                    <div className="card-base overflow-hidden border-red-500/20 bg-red-500/[0.02]">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                          <thead className="bg-red-500/10">
                            <tr>
                              <th className="px-6 py-4 font-bold text-red-500">رقم الشقة</th>
                              <th className="px-6 py-4 font-bold text-red-500">المالك</th>
                              <th className="px-6 py-4 font-bold text-red-500">آخر أداء</th>
                              <th className="px-6 py-4 font-bold text-red-500">مدة التأخير</th>
                              <th className="px-6 py-4 font-bold text-red-500 text-left">الإجراءات والسداد</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-500/10">
                            {apartments.filter(apt => {
                              const aptReceipts = receipts.filter(r => r.apartmentId === apt.id);
                              if (aptReceipts.length === 0) return true;
                              const lastDate = new Date(Math.max(...aptReceipts.map(r => new Date(r.date).getTime())));
                              const thirtyDaysAgo = new Date();
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                              return lastDate < thirtyDaysAgo;
                            }).map(apt => {
                              const aptReceipts = receipts.filter(r => r.apartmentId === apt.id);
                              const lastDate = aptReceipts.length > 0 
                                ? new Date(Math.max(...aptReceipts.map(r => new Date(r.date).getTime())))
                                : null;
                              
                              const diffDays = lastDate 
                                ? Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 3600 * 24))
                                : 'أول مرة';

                              return (
                                <tr key={`overdue-${apt.id}`} className="hover:bg-red-500/5 transition-colors">
                                  <td className="px-6 py-4 font-bold text-red-500">{apt.number}</td>
                                  <td className="px-6 py-4">{apt.ownerName}</td>
                                  <td className="px-6 py-4 text-text-secondary">
                                    {lastDate ? format(lastDate, 'dd/MM/yyyy') : '---'}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="bg-red-500/10 text-red-500 px-2 py-1 rounded-md font-bold text-xs border border-red-500/20">
                                      {typeof diffDays === 'number' ? `${diffDays} يوم` : diffDays}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex gap-3 justify-end lg:justify-start">
                                      <button 
                                        onClick={() => {
                                          setReceiptApartmentId(apt.id);
                                          setReceiptAmount(100);
                                          setIsReceiptModalOpen(true);
                                        }}
                                        className="text-accent-gold text-xs font-bold hover:underline"
                                      >
                                        تسوية الأداء
                                      </button>
                                      <button 
                                        onClick={() => sendOverdueReminder(apt, diffDays)}
                                        className="text-success hover:scale-110 transition-transform"
                                        title="إرسال تذكير عبر واتساب وإخطار الإدارة"
                                      >
                                        <MessageSquare size={16} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {apartments.filter(apt => {
                              const aptReceipts = receipts.filter(r => r.apartmentId === apt.id);
                              if (aptReceipts.length === 0) return true;
                              const lastDate = new Date(Math.max(...aptReceipts.map(r => new Date(r.date).getTime())));
                              const thirtyDaysAgo = new Date();
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                              return lastDate < thirtyDaysAgo;
                            }).length === 0 && (
                              <tr>
                                <td colSpan={5} className="py-12 text-center">
                                  <div className="flex flex-col items-center gap-2 opacity-40">
                                    <CheckCircle size={32} className="text-success" />
                                    <p className="font-bold text-sm">لا توجد أي متأخرات حالياً</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* All Apartments Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-accent-gold rounded-full" />
                    <h2 className="text-xl font-bold">كافة سجلات الشقق</h2>
                  </div>
                  <div className="card-base overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-white/3">
                      <tr>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">رقم الشقة</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">المالك</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">رقم الهاتف</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {apartments.map(apt => (
                        <tr key={apt.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-bold">{apt.number}</td>
                          <td className="px-6 py-4 text-text-secondary">{apt.ownerName}</td>
                          <td className="px-6 py-4 text-text-secondary" dir="ltr">{apt.phone}</td>
                          <td className="px-6 py-4">
                            {isAdmin && (
                              <div className="flex items-center gap-4">
                                <button 
                                  onClick={() => {
                                    setReceiptApartmentId(apt.id);
                                    setReceiptAmount(100);
                                    setIsReceiptModalOpen(true);
                                  }}
                                  className="text-accent-gold text-xs font-bold hover:underline"
                                >
                                  إصدار إيصال
                                </button>
                                <button 
                                  onClick={() => {
                                    requestConfirmation(
                                      'حذف بيانات الشقة',
                                      `تنبيه: أنت على وشك حذف الشقة رقم ${apt.number}. سيتم حذف جميع البيانات المرتبطة بها نهائياً. يرجى كتابة رقم الشقة "${apt.number}" للتأكيد.`,
                                      async () => {
                                        try {
                                          await deleteDoc(doc(db, 'apartments', apt.id));
                                        } catch (err) {
                                          handleFirestoreError(err, OperationType.DELETE, 'apartments');
                                        }
                                      },
                                      'danger',
                                      apt.number
                                    );
                                  }}
                                  className="text-red-500 hover:text-red-400 transition-colors"
                                  title="حذف الشقة"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'receipts' && (
              <motion.div
                key="receipts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="card-base p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white/5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">تاريخ البداية</label>
                    <input 
                      type="date" 
                      value={receiptFilterStart}
                      onChange={(e) => setReceiptFilterStart(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">تاريخ النهاية</label>
                    <input 
                      type="date" 
                      value={receiptFilterEnd}
                      onChange={(e) => setReceiptFilterEnd(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">حالة الأداء</label>
                    <select 
                      value={receiptFilterStatus}
                      onChange={(e) => setReceiptFilterStatus(e.target.value as any)}
                      className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                    >
                      <option value="all">الكل</option>
                      <option value="paid">مؤدى</option>
                      <option value="unpaid">غير مؤدى</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">الترتيب</label>
                      <select 
                        value={receiptSortOrder}
                        onChange={(e) => setReceiptSortOrder(e.target.value as any)}
                        className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                      >
                        <option value="desc">الأحدث أولاً</option>
                        <option value="asc">الأقدم أولاً</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => { 
                        setReceiptFilterStart(''); 
                        setReceiptFilterEnd(''); 
                        setReceiptFilterStatus('all');
                        setReceiptSortOrder('desc');
                      }}
                      className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-white/5 transition-colors self-end"
                      title="إعادة تعيين الكل"
                    >
                      <Filter size={16} />
                    </button>
                  </div>
                </div>

                <div className="card-base overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-white/3">
                      <tr>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">رقم الإيصال</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">الشقة</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">المبلغ</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">التاريخ</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary">الحالة</th>
                        <th className="px-6 py-4 text-xs font-medium text-text-secondary text-left">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {receipts
                        .filter(r => {
                          const rDate = new Date(r.date);
                          if (receiptFilterStart && rDate < new Date(receiptFilterStart)) return false;
                          if (receiptFilterEnd) {
                            const endDate = new Date(receiptFilterEnd);
                            endDate.setHours(23, 59, 59, 999);
                            if (rDate > endDate) return false;
                          }
                          if (receiptFilterStatus !== 'all' && r.status !== receiptFilterStatus) return false;
                          return true;
                        })
                        .sort((a, b) => {
                          const timeA = new Date(a.date).getTime();
                          const timeB = new Date(b.date).getTime();
                          return receiptSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
                        })
                        .map(receipt => {
                        const apt = apartments.find(a => a.id === receipt.apartmentId);
                        return (
                          <tr key={receipt.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-accent-gold">№ {receipt.receiptNo}</td>
                            <td className="px-6 py-4 font-medium">{apt?.number || '---'}</td>
                            <td className="px-6 py-4">{receipt.amount} د.م.</td>
                            <td className="px-6 py-4 text-text-secondary text-xs">{format(new Date(receipt.date), 'yyyy/MM/dd')}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold border",
                                receipt.status === 'paid' ? "bg-success/10 text-success border-success/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                              )}>
                                {receipt.status === 'paid' ? 'مؤدى' : 'غير مؤدى'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3 justify-end lg:justify-start">
                                <button 
                                  onClick={() => apt && generatePDF(receipt, apt)}
                                  className="text-text-secondary hover:text-accent-gold transition-colors"
                                  title="تحميل PDF"
                                >
                                  <Download size={16} />
                                </button>
                                <button 
                                  onClick={() => apt && sendWhatsApp(receipt, apt)}
                                  className="btn-whatsapp"
                                >
                                  واتساب
                                </button>
                                <button 
                                  onClick={() => {
                                    const url = `${window.location.origin}?verify=${receipt.hash}`;
                                    window.open(url, '_blank');
                                  }}
                                  className="text-text-secondary hover:text-accent-gold transition-colors"
                                  title="رابط التحقق"
                                >
                                  <ExternalLink size={16} />
                                </button>
                                {isAdmin && (
                                  <button 
                                    onClick={() => {
                                    requestConfirmation(
                                      'تأكيد حذف الإيصال',
                                      `تنبيه: أنت على وشك حذف الإيصال رقم ${receipt.receiptNo} بقيمة ${receipt.amount} د.م. يرجى كتابة رقم الإيصال "${receipt.receiptNo}" للتأكيد.`,
                                      async () => {
                                        try {
                                          await deleteDoc(doc(db, 'receipts', receipt.id));
                                        } catch (err) {
                                          handleFirestoreError(err, OperationType.DELETE, 'receipts');
                                        }
                                      },
                                      'danger',
                                      receipt.receiptNo
                                    );
                                    }}
                                    className="text-red-500 hover:text-red-400 transition-colors"
                                    title="حذف الإيصال"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'verify' && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-xl mx-auto py-10"
              >
                <div className="text-center mb-10">
                  <ShieldCheck className="h-16 w-16 text-accent-gold mx-auto mb-4" />
                  <h2 className="text-3xl font-bold">التحقق الرقمي</h2>
                  <p className="text-text-secondary mt-2">تأكد من صحة الإيصال عبر قاعدة البيانات المركزية</p>
                </div>

                <div className="card-base p-8 space-y-8">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="أدخل رمز الهاش..." 
                      className="flex-1 bg-background border border-border px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent-gold outline-none text-sm"
                      value={verificationHash || ''}
                      onChange={(e) => setVerificationHash(e.target.value)}
                    />
                    <button className="btn-primary">تحقق</button>
                  </div>

                  {isVerifying ? (
                    <div className="py-10 text-center text-text-secondary">جاري التحقق...</div>
                  ) : verifiedReceipt ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-success/5 border border-success/20 rounded-2xl p-6"
                    >
                      <div className="flex items-center gap-3 text-success mb-6">
                        <CheckCircle size={24} />
                        <span className="text-xl font-bold">إيصال موثق</span>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-sm">
                        <div>
                          <p className="text-text-secondary mb-1">رقم الإيصال</p>
                          <p className="font-bold text-accent-gold">№ {verifiedReceipt.receiptNo}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary mb-1">التاريخ</p>
                          <p className="font-bold">{format(new Date(verifiedReceipt.date), 'dd MMMM yyyy', { locale: ar })}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary mb-1">الشقة</p>
                          <p className="font-bold">{verifiedReceipt.apartment?.number || '---'}</p>
                        </div>
                        <div>
                          <p className="text-text-secondary mb-1">المبلغ</p>
                          <p className="font-bold">{verifiedReceipt.amount} د.م.</p>
                        </div>
                      </div>
                      <div className="mt-8 flex justify-center bg-white p-3 rounded-xl w-fit mx-auto">
                        <QRCodeSVG value={`${window.location.origin}?verify=${verifiedReceipt.hash}`} size={140} />
                      </div>
                    </motion.div>
                  ) : verificationHash ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center"
                    >
                      <XCircle size={48} className="text-red-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-red-500 mb-2">إيصال غير موجود!</h3>
                      <p className="text-text-secondary text-sm">هذا الرمز غير مسجل في قاعدة البيانات. يرجى الحذر من التزوير.</p>
                    </motion.div>
                  ) : null}
                </div>
              </motion.div>
            )}

            {activeTab === 'content' && (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
              >
                {contents.map((item, idx) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="card-base group overflow-hidden flex flex-col relative hover:border-accent-gold/40 transition-all duration-500"
                  >
                    {isAdmin && (
                      <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button 
                          onClick={() => {
                            setEditingContentId(item.id);
                            setContentTitle(item.title);
                            setContentDetails(item.details);
                            setContentType(item.type);
                            setContentImageUrl(item.imageUrl || '');
                            setContentStatus(item.status);
                            setContentProgress(item.progress || 0);
                            setIsContentModalOpen(true);
                          }}
                          className="w-9 h-9 rounded-full bg-accent-gold text-background flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl backdrop-blur-md"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            requestConfirmation(
                              'تأكيد حذف المحتوى',
                              `تنبيه: سيتم حذف "${item.title}" نهائياً. يرجى كتابة "حـذف" للتأكيد.`,
                              async () => {
                                try {
                                  await deleteDoc(doc(db, 'content', item.id));
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.DELETE, 'content');
                                }
                              },
                              'danger',
                              'حذف'
                            );
                          }}
                          className="w-9 h-9 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl backdrop-blur-md"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    
                    <div className="relative aspect-[16/10] overflow-hidden group-hover:shadow-2xl transition-all duration-500">
                      {item.imageUrl ? (
                        <LazyImage 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-accent-gold/20">
                          <Building2 size={48} className="opacity-20" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-80" />
                      
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[2px] backdrop-blur-md border",
                          item.type === 'news' ? "bg-accent-gold/20 text-accent-gold border-accent-gold/30" : "bg-blue-500/20 text-blue-400 border-blue-500/20"
                        )}>
                          {item.type === 'news' ? 'NEWS' : 'PROJECT'}
                        </span>
                      </div>
                    </div>

                    <div className="p-7 flex-1 flex flex-col relative">
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary font-bold uppercase tracking-widest mb-4">
                        <Calendar size={12} className="text-accent-gold" />
                        {format(new Date(item.createdAt), 'dd MMM yyyy', { locale: ar })}
                      </div>

                      <h3 className="text-xl font-black mb-3 group-hover:text-accent-gold transition-colors leading-[1.2] tracking-tight">
                        {item.title}
                      </h3>
                      
                      <div className="relative">
                        <p className="text-text-secondary text-sm leading-relaxed mb-6 line-clamp-3 font-medium">
                          {item.details}
                        </p>
                        {item.details.length > 150 && (
                          <button 
                            onClick={() => setReadingItem(item)}
                            className="text-accent-gold text-xs font-black uppercase tracking-widest hover:underline mb-6 flex items-center gap-1 group/btn"
                          >
                            إقرأ المزيد
                            <ChevronLeft size={14} className="group-hover/btn:-translate-x-1 transition-transform" />
                          </button>
                        )}
                      </div>

                      {item.type === 'project' && (
                        <div className="mt-auto space-y-5 pt-6 border-t border-white/5">
                          <div className="flex items-center justify-between items-end">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-black text-text-secondary uppercase tracking-[2px]">Progress</span>
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-md border",
                                item.status === 'completed' ? "bg-success/10 text-success border-success/20" : "bg-accent-gold/10 text-accent-gold border-accent-gold/20"
                              )}>
                                {item.status === 'completed' ? 'DONE' : 'IN WORK'}
                              </span>
                            </div>
                            <span className="text-2xl font-black text-accent-gold italic tabular-nums leading-none">
                              {item.progress || 0}%
                            </span>
                          </div>
                          
                          <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress || 0}%` }}
                              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                              className="h-full bg-accent-gold shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                            />
                          </div>
                        </div>
                      )}

                      {item.type === 'news' && (
                        <div className="mt-auto pt-4 flex justify-end">
                          <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary group-hover:border-accent-gold group-hover:text-accent-gold transition-all duration-300">
                            <ArrowRight size={18} />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {contents.length === 0 && (
                  <div className="col-span-full py-32 text-center card-base bg-white/[0.02]">
                    <Newspaper size={64} className="mx-auto text-accent-gold/10 mb-6" />
                    <div className="text-text-secondary text-lg font-bold">لا توجد تحديثات منشورة حالياً</div>
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'expenses' && (
              <motion.div
                key="expenses"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Filters */}
                <div className="card-base p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white/5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right block">من تاريخ</label>
                    <input 
                      type="date" 
                      value={expenseFilterStart}
                      onChange={(e) => setExpenseFilterStart(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right block">إلى تاريخ</label>
                    <input 
                      type="date" 
                      value={expenseFilterEnd}
                      onChange={(e) => setExpenseFilterEnd(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest text-right block">الفئة</label>
                    <select 
                      value={expenseFilterCategory}
                      onChange={(e) => setExpenseFilterCategory(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-2.5 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors"
                    >
                      <option value="all">جميع الفئات</option>
                      <option value="صيانة">صيانة</option>
                      <option value="كهرباء">كهرباء</option>
                      <option value="ماء">ماء</option>
                      <option value="نظافة">نظافة</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setAppliedExpenseFilterStart(expenseFilterStart);
                        setAppliedExpenseFilterEnd(expenseFilterEnd);
                        setAppliedExpenseFilterCategory(expenseFilterCategory);
                      }}
                      className="flex-1 btn-primary py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <Search size={16} />
                      تطبيق الفلتر
                    </button>
                    <button 
                      onClick={() => {
                        setExpenseFilterStart('');
                        setExpenseFilterEnd('');
                        setExpenseFilterCategory('all');
                        setAppliedExpenseFilterStart('');
                        setAppliedExpenseFilterEnd('');
                        setAppliedExpenseFilterCategory('all');
                      }}
                      className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-white/5 transition-colors self-end"
                      title="إعادة تعيين"
                    >
                      <Filter size={16} />
                    </button>
                  </div>
                </div>

                {/* Statistics Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 card-base p-6 h-80">
                    <h3 className="text-sm font-bold text-accent-gold mb-6 flex items-center gap-2">
                      <BarChart3 size={16} />
                      توزع المصاريف المفلترة
                    </h3>
                    <div className="w-full h-full pb-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={
                          Object.entries(
                            expenses
                             .filter(e => {
                               const eDate = new Date(e.date);
                               let matches = true;
                               if (appliedExpenseFilterStart) matches = matches && eDate >= new Date(appliedExpenseFilterStart);
                               if (appliedExpenseFilterEnd) {
                                 const endDateBound = new Date(appliedExpenseFilterEnd);
                                 endDateBound.setHours(23, 59, 59, 999);
                                 matches = matches && eDate <= endDateBound;
                               }
                               if (appliedExpenseFilterCategory !== 'all') matches = matches && e.category === appliedExpenseFilterCategory;
                               return matches;
                             })
                             .reduce((acc, e) => {
                               acc[e.category] = (acc[e.category] || 0) + e.amount;
                               return acc;
                             }, {} as Record<string, number>)
                          ).map(([name, value]) => ({ name, value }))
                        }>
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D4AF37" stopOpacity={1} />
                              <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.2} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#64748b" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            stroke="#64748b" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(v) => `${v}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#0c0e14', 
                              border: '1px solid #1e293b', 
                              borderRadius: '16px',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                              fontSize: '12px'
                            }}
                            itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }}
                            cursor={{ fill: 'rgba(212, 175, 55, 0.05)' }}
                          />
                          <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card-base p-6 flex flex-col justify-center space-y-4">
                    <div className="text-center">
                      <TrendingDown className="h-12 w-12 text-red-500 mx-auto mb-2 opacity-20" />
                      <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest">إجمالي المصاريف المعروضة</h3>
                      <p className="text-3xl font-bold text-red-500 mt-2">
                        {expenses
                          .filter(e => {
                            const eDate = new Date(e.date);
                            let matches = true;
                            if (appliedExpenseFilterStart) matches = matches && eDate >= new Date(appliedExpenseFilterStart);
                            if (appliedExpenseFilterEnd) {
                              const endDateBound = new Date(appliedExpenseFilterEnd);
                              endDateBound.setHours(23, 59, 59, 999);
                              matches = matches && eDate <= endDateBound;
                            }
                            if (appliedExpenseFilterCategory !== 'all') matches = matches && e.category === appliedExpenseFilterCategory;
                            return matches;
                          })
                          .reduce((sum, e) => sum + e.amount, 0)
                        } <span className="text-sm font-medium">د.م.</span>
                      </p>
                    </div>
                    
                    <button 
                      onClick={() => generateExpenseReport('filtered')}
                      disabled={!appliedExpenseFilterStart && !appliedExpenseFilterEnd && appliedExpenseFilterCategory === 'all'}
                      className="w-full btn-primary py-3 text-xs flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                      <Download size={14} />
                      تنزيل تقرير مخصص (PDF)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mt-8">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => generateExpenseReport('monthly')}
                      className="bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold px-4 py-2 rounded-xl text-xs font-bold border border-accent-gold/30 transition-all flex items-center gap-2"
                    >
                      <Download size={14} />
                      تحميل تقرير شهري
                    </button>
                    <button 
                      onClick={() => generateExpenseReport('yearly')}
                      className="bg-white/5 hover:bg-white/10 text-text-primary px-4 py-2 rounded-xl text-xs font-bold border border-border transition-all flex items-center gap-2"
                    >
                      <Download size={14} />
                      تحميل تقرير سنوي
                    </button>
                  </div>
                  <div className="text-xs text-text-secondary bg-white/5 px-3 py-1 rounded-full border border-border">
                    مجموع العناصر المفلترة: {
                      expenses.filter(e => {
                        const eDate = new Date(e.date);
                        let matches = true;
                        if (appliedExpenseFilterStart) matches = matches && eDate >= new Date(appliedExpenseFilterStart);
                        if (appliedExpenseFilterEnd) {
                          const endDateBound = new Date(appliedExpenseFilterEnd);
                          endDateBound.setHours(23, 59, 59, 999);
                          matches = matches && eDate <= endDateBound;
                        }
                        if (appliedExpenseFilterCategory !== 'all') matches = matches && e.category === appliedExpenseFilterCategory;
                        return matches;
                      }).length
                    } عنصر
                  </div>
                </div>

                <div className="card-base overflow-hidden">
                  <div className="overflow-x-auto text-right" dir="rtl">
                    <table className="w-full text-sm text-right">
                      <thead>
                        <tr className="bg-white/5 border-b border-border">
                          <th className="px-6 py-4 font-bold text-accent-gold text-right">الفئة</th>
                          <th className="px-6 py-4 font-bold text-accent-gold text-right">المبلغ</th>
                          <th className="px-6 py-4 font-bold text-accent-gold text-right">التفاصيل</th>
                          <th className="px-6 py-4 font-bold text-accent-gold text-right">التاريخ</th>
                          {isAdmin && <th className="px-6 py-4 font-bold text-accent-gold text-left">الإجراءات</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {expenses
                          .filter(e => {
                            const eDate = new Date(e.date);
                            let matches = true;
                            if (appliedExpenseFilterStart) matches = matches && eDate >= new Date(appliedExpenseFilterStart);
                            if (appliedExpenseFilterEnd) {
                              const endDateBound = new Date(appliedExpenseFilterEnd);
                              endDateBound.setHours(23, 59, 59, 999);
                              matches = matches && eDate <= endDateBound;
                            }
                            if (appliedExpenseFilterCategory !== 'all') matches = matches && e.category === appliedExpenseFilterCategory;
                            return matches;
                          })
                          .map(expense => (
                          <tr key={expense.id} className="hover:bg-white/3 transition-colors">
                            <td className="px-6 py-4 font-bold">{expense.category}</td>
                            <td className="px-6 py-4 text-red-500 font-bold">-{expense.amount} د.م.</td>
                            <td className="px-6 py-4 text-text-secondary">{expense.details}</td>
                            <td className="px-6 py-4 text-text-secondary">
                              {format(new Date(expense.date), 'dd/MM/yyyy')}
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4 text-left">
                                <button 
                                  onClick={() => {
                                    requestConfirmation(
                                      'حذف سجل المصروفات',
                                      `هل أنت متأكد من حذف هذا المصروف بقيمة ${expense.amount} د.م.؟ يرجى كتابة المبلغ "${expense.amount}" للتأكيد.`,
                                      async () => {
                                        try {
                                          await deleteDoc(doc(db, 'expenses', expense.id));
                                        } catch (err) {
                                          handleFirestoreError(err, OperationType.DELETE, 'expenses');
                                        }
                                      },
                                      'danger',
                                      String(expense.amount)
                                    );
                                  }}
                                  className="text-red-500 hover:text-red-400 transition-colors"
                                  title="حذف المصروف"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {expenses.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 5 : 4} className="px-6 py-10 text-center text-text-secondary">لا توجد مصاريف مسجلة حالياً</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'guide' && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="card-base p-8 space-y-6">
                  <h2 className="text-2xl font-bold text-accent-gold border-b border-border pb-4">دليل استخدام نظام سانديك الفاروق</h2>
                  
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent-gold text-background flex items-center justify-center text-xs">1</div>
                        إصدار الإيصالات
                      </h3>
                      <p className="text-text-secondary text-sm leading-relaxed">
                        من تبويب "الإيصالات" أو "إدارة الشقق"، اضغط على "إيصال جديد". أدخل المبلغ واختر الشقة. سيقوم النظام بتوليد رقم تسلسلي فريد ورمز هاش (Hash) للتحقق تلقائياً.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent-gold text-background flex items-center justify-center text-xs">2</div>
                        التواصل مع السكان
                      </h3>
                      <p className="text-text-secondary text-sm leading-relaxed">
                        بعد إصدار الإيصال، استخدم زر "واتساب" لإرسال رسالة جاهزة للمالك تحتوي على تفاصيل الدفع ورابط التحقق الرقمي.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent-gold text-background flex items-center justify-center text-xs">3</div>
                        التحقق الرقمي ومنع التزوير
                      </h3>
                      <p className="text-text-secondary text-sm leading-relaxed">
                        كل إيصال يحتوي على رمز QR. عند مسحه، يفتح الموقع صفحة "التحقق الرقمي". إذا كان الإيصال صحيحاً، ستظهر بياناته باللون الأخضر. إذا كان مزوراً أو غير موجود، سيظهر تحذير أحمر.
                      </p>
                    </section>

                    <section className="space-y-3">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent-gold text-background flex items-center justify-center text-xs">4</div>
                        إدارة الأخبار والمشاريع
                      </h3>
                      <p className="text-text-secondary text-sm leading-relaxed">
                        يمكنك إضافة إعلانات أو مشاريع (مثل إصلاح المصعد) مع تحديد نسبة الإنجاز. تظهر هذه المعلومات في لوحة التحكم لتعزيز الشفافية مع السكان.
                      </p>
                    </section>
                  </div>

                  <div className="mt-8 p-4 bg-accent-gold/5 border border-accent-gold/20 rounded-xl">
                    <p className="text-xs text-accent-gold leading-relaxed">
                      <strong>ملاحظة أمنية:</strong> لا يمكن لأي شخص غير السانديك (المسجل بريده الإلكتروني كمسؤول) إضافة أو تعديل البيانات. الإيصالات متاحة للقراءة فقط للعموم لغرض التحقق.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'feedback' && isAdmin && (
              <motion.div
                key="feedback-admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {feedbacks.map((fb, idx) => (
                    <motion.div 
                      key={fb.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="card-base p-6 space-y-4 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          fb.type === 'bug' ? "bg-red-500/10 text-red-500" : 
                          fb.type === 'maintenance' ? "bg-orange-500/10 text-orange-500" : 
                          "bg-blue-500/10 text-blue-500"
                        )}>
                          {fb.type === 'bug' ? 'خطأ تقني' : fb.type === 'maintenance' ? 'صيانة' : 'ملاحظة'}
                        </span>
                        <div className="flex items-center gap-2">
                          <select 
                            value={fb.status} 
                            onChange={async (e) => {
                              try {
                                await updateDoc(doc(db, 'feedback', fb.id), { status: e.target.value });
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, 'feedback');
                              }
                            }}
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border bg-transparent outline-none",
                              fb.status === 'resolved' ? "border-success text-success" : 
                              fb.status === 'reviewed' ? "border-blue-500 text-blue-500" : 
                              "border-accent-gold text-accent-gold"
                            )}
                          >
                            <option value="pending">قيد الانتظار</option>
                            <option value="reviewed">تمت المراجعة</option>
                            <option value="resolved">تم الحل</option>
                          </select>
                          <button 
                            onClick={() => {
                              requestConfirmation(
                                'تأكيد حذف البلاغ',
                                'هل أنت متأكد من حذف هذا البلاغ نهائياً؟',
                                async () => {
                                  try {
                                    await deleteDoc(doc(db, 'feedback', fb.id));
                                  } catch (err) {
                                    handleFirestoreError(err, OperationType.DELETE, 'feedback');
                                  }
                                }
                              );
                            }}
                            className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="text-sm font-bold leading-relaxed">{fb.description}</div>
                        {fb.screenshotUrl && (
                          <a href={fb.screenshotUrl} target="_blank" rel="noreferrer" className="block relative aspect-video rounded-lg overflow-hidden border border-border group/img">
                            <img src={fb.screenshotUrl} alt="Feedback Screenshot" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <ExternalLink size={20} className="text-white" />
                            </div>
                          </a>
                        )}
                      </div>

                      <div className="pt-4 border-t border-border flex items-center justify-between text-[10px] text-text-secondary">
                        <div className="flex items-center gap-1">
                          <Users size={12} />
                          {fb.userEmail || 'مجهول'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(fb.createdAt), 'yyyy/MM/dd HH:mm')}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {feedbacks.length === 0 && (
                    <div className="col-span-full py-20 text-center card-base">
                      <MessageSquare size={48} className="mx-auto text-accent-gold/20 mb-4" />
                      <div className="text-text-secondary text-sm">لا توجد بلاغات حالياً</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && isAdmin && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 pb-12"
              >
                {/* Analytics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="إجمالي المستخدمين" 
                    value={appUsers.length} 
                    icon={<Users size={20} />} 
                    trend="ديمومة"
                  />
                  <StatCard 
                    title="نشطون اليوم" 
                    value={appUsers.filter(u => {
                      const lastLogin = new Date(u.lastLogin);
                      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                      return lastLogin > oneDayAgo;
                    }).length} 
                    icon={<ShieldCheck size={20} />} 
                    trend="متفاعلون"
                  />
                  <StatCard 
                    title="إيصالات الشهر" 
                    value={receipts.filter(r => {
                      const d = new Date(r.date);
                      const now = new Date();
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }).length} 
                    icon={<FileText size={20} />} 
                    trend="سجلات"
                  />
                  <StatCard 
                    title="إجمالي المداخيل" 
                    value={`${receipts.reduce((sum, r) => sum + r.amount, 0)} د.م.`} 
                    icon={<TrendingDown size={20} />} 
                    trend="سيولة"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Monthly Receipts Chart */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-blue-500 rounded-full" />
                      <h3 className="text-xl font-black">حركة الإيصالات الشهرية</h3>
                    </div>
                    <div className="card-base p-6 h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={Array.from({ length: 6 }, (_, i) => {
                            const date = new Date();
                            date.setMonth(date.getMonth() - i);
                            const monthStr = format(date, 'MMM', { locale: ar });
                            const count = receipts.filter(r => {
                              const d = new Date(r.date);
                              return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                            }).length;
                            return { name: monthStr, count };
                          }).reverse()}
                        >
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#666" 
                            fontSize={12} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="#666" 
                            fontSize={12} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                            itemStyle={{ color: '#d4af37', fontWeight: 'bold' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#d4af37" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Activity / Logins */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-accent-gold rounded-full" />
                      <h3 className="text-xl font-black">آخر تسجيلات الدخول</h3>
                    </div>
                    <div className="card-base p-6 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {appUsers.slice(0, 10).map((u, i) => (
                        <div key={u.id} className="flex items-center gap-4 group">
                          <div className="relative">
                            <img 
                              src={u.photoURL || `https://ui-avatars.com/api/?name=${u.name}&background=random`} 
                              alt={u.name} 
                              className="w-10 h-10 rounded-full border border-border group-hover:border-accent-gold/50 transition-colors"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success border-2 border-card rounded-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{u.name}</p>
                            <p className="text-[10px] text-text-secondary truncate">{u.email}</p>
                          </div>
                          <div className="text-left">
                            <p className="text-[9px] font-black text-accent-gold uppercase whitespace-nowrap">
                              {format(new Date(u.lastLogin), 'HH:mm')}
                            </p>
                            <p className="text-[9px] text-text-secondary whitespace-nowrap">
                              {format(new Date(u.lastLogin), 'dd MMM')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Insight: User Roles Distribution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="card-base p-6 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-full h-[200px] md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Admins', value: appUsers.filter(u => u.role === 'admin' || u.email === 'doukkar2018@gmail.com').length },
                              { name: 'Users', value: appUsers.filter(u => u.role !== 'admin' && u.email !== 'doukkar2018@gmail.com').length }
                            ]}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#d4af37" />
                            <Cell fill="#222" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-4">
                      <h4 className="text-lg font-black tracking-tight">توزيع الأدوار</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-text-secondary">المسؤولون</span>
                          <span className="text-sm font-black text-accent-gold">{appUsers.filter(u => u.role === 'admin' || u.email === 'doukkar2018@gmail.com').length}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-text-secondary">المستخدمون</span>
                          <span className="text-sm font-black">{appUsers.filter(u => u.role !== 'admin' && u.email !== 'doukkar2018@gmail.com').length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-base p-8 bg-gradient-to-br from-accent-gold/10 to-transparent border-accent-gold/10 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-3xl bg-accent-gold flex items-center justify-center text-background shrink-0 shadow-[0_10px_30px_rgba(212,175,55,0.3)]">
                      <TrendingDown size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black mb-1">النمو المالي</h3>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        زاد معدل إصدار الإيصالات بنسبة 12% مقارنة بالشهر الماضي. استمر في تعزيز الشفافية الرقمية لجذب المزيد من الملاك.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* News Sidebar (Desktop) */}
        <aside className="hidden xl:flex w-80 bg-background border-r border-border p-8 flex flex-col gap-8 overflow-y-auto scroll-hide">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[3px] text-text-secondary">آخر التحديثات</h2>
            <div className="relative">
              <Bell size={18} className="text-accent-gold" />
              {notifications.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </div>
          </div>
          
          <div className="space-y-6">
            {notifications.slice(0, 5).map(item => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={item.id} 
                className="p-4 rounded-2xl bg-white/3 border border-border/50 hover:border-accent-gold/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    item.type === 'alert' ? "bg-red-500" : item.type === 'update' ? "bg-blue-500" : "bg-accent-gold"
                  )} />
                  <span className="text-[10px] font-black uppercase text-accent-gold">إشعار</span>
                  <span className="text-[9px] text-text-secondary ml-auto">{format(new Date(item.createdAt), 'dd.MM')}</span>
                </div>
                <h4 className="text-sm font-bold mb-1">{item.title}</h4>
                <p className="text-[11px] text-text-secondary line-clamp-2">{item.body}</p>
              </motion.div>
            ))}
            {notifications.length === 0 && (
              <div className="text-[10px] text-text-secondary text-center py-20 border border-dashed border-border rounded-2xl flex flex-col items-center gap-3 opacity-50">
                <Bell size={24} />
                <span>لا توجد إشعارات حالياً</span>
              </div>
            )}
          </div>
          
          <div className="mt-auto p-6 rounded-2xl glass-dark border border-white/5 space-y-4">
            <h4 className="text-xs font-bold text-accent-gold flex items-center gap-2">
              <ShieldCheck size={14} />
              نصيحة أمنية
            </h4>
            <p className="text-[11px] text-text-secondary leading-relaxed font-medium">
              تأكد دائماً من وجود الختم الرقمي QR Code على إيصالك الورقي لضمان صحته في النظام.
            </p>
          </div>
        </aside>

        {/* Apartment Creation Modal */}
        <AnimatePresence>
          {isApartmentModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsApartmentModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-bold text-accent-gold">إضافة شقة جديدة</h3>
                  <button onClick={() => setIsApartmentModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X size={20} />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSubmittingApartment(true);
                    try {
                      await addDoc(collection(db, 'apartments'), {
                        number: aptNumber,
                        ownerName: aptOwner,
                        phone: aptPhone
                      });
                      setIsApartmentModalOpen(false);
                      alert("تمت إضافة الشقة بنجاح");
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, 'apartments');
                    } finally {
                      setIsSubmittingApartment(false);
                    }
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">رقم الشقة</label>
                    <input type="text" required value={aptNumber} onChange={e => setAptNumber(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm" placeholder="مثال: 1" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">اسم المالك</label>
                    <input type="text" required value={aptOwner} onChange={e => setAptOwner(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm" placeholder="الاسم الكامل" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">رقم الهاتف</label>
                    <input type="text" required value={aptPhone} onChange={e => setAptPhone(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm" placeholder="06XXXXXXXX" dir="ltr" />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button type="submit" disabled={isSubmittingApartment} className="flex-1 btn-primary disabled:opacity-50">
                      {isSubmittingApartment ? "جاري الإضافة..." : "إضافة الشقة"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Read More Modal */}
        <AnimatePresence>
          {readingItem && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setReadingItem(null)}
                className="absolute inset-0 bg-black/95 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 30 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="relative bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              >
                <button 
                  onClick={() => setReadingItem(null)}
                  className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {readingItem.imageUrl && (
                    <div className="relative aspect-video flex-shrink-0">
                      <img 
                        src={readingItem.imageUrl} 
                        alt={readingItem.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    </div>
                  )}

                  <div className="p-8 md:p-12">
                    <div className="flex items-center gap-2 text-[10px] text-accent-gold font-black uppercase tracking-[3px] mb-6">
                      <Calendar size={14} />
                      {format(new Date(readingItem.createdAt), 'dd MMMM yyyy', { locale: ar })}
                      <span className="mx-2 opacity-20 text-white">|</span>
                      {readingItem.type === 'news' ? 'NEWS' : 'PROJECT'}
                    </div>

                    <h2 className="text-3xl md:text-4xl font-black mb-8 leading-tight">
                      {readingItem.title}
                    </h2>

                    <div className="text-text-primary/90 text-lg leading-loose font-medium whitespace-pre-wrap">
                      {readingItem.details}
                    </div>

                    {readingItem.type === 'project' && (
                      <div className="mt-12 pt-8 border-t border-white/5 space-y-8">
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-black text-text-secondary uppercase tracking-[2px]">التقدم المحرز</span>
                           <span className="text-2xl font-black text-accent-gold">{readingItem.progress}%</span>
                         </div>
                         <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/5">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${readingItem.progress}%` }}
                             className="h-full bg-accent-gold rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                           />
                         </div>
                         <div className="flex items-center gap-3 py-4 px-6 rounded-2xl bg-accent-gold/5 border border-accent-gold/10">
                           <div className={cn(
                             "w-2 h-2 rounded-full animate-pulse",
                             readingItem.status === 'completed' ? "bg-success" : "bg-accent-gold"
                           )} />
                           <span className="text-sm font-bold text-accent-gold">
                             الحالة: {readingItem.status === 'completed' ? 'تـم الإنـجـاز' : 'قـيـد الـتـنـفـيـذ'}
                           </span>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Content Creation Modal */}
        <AnimatePresence>
          {isContentModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsContentModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-bold text-accent-gold">
                    {editingContentId ? "تعديل المحتوى" : "إضافة محتوى جديد"}
                  </h3>
                  <button onClick={() => {
                    setIsContentModalOpen(false);
                    setEditingContentId(null);
                  }} className="text-text-secondary hover:text-text-primary">
                    <X size={20} />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSubmittingContent(true);
                    try {
                      const contentData = {
                        title: contentTitle,
                        details: contentDetails,
                        type: contentType,
                        imageUrl: contentImageUrl,
                        status: contentStatus,
                        progress: contentType === 'project' ? contentProgress : 0,
                        createdAt: editingContentId ? contents.find(c => c.id === editingContentId)?.createdAt : new Date().toISOString()
                      };

                      if (editingContentId) {
                        await updateDoc(doc(db, 'content', editingContentId), contentData);
                      } else {
                        await addDoc(collection(db, 'content'), contentData);
                      }
                      
                      setIsContentModalOpen(false);
                      setEditingContentId(null);
                    } catch (err) {
                      handleFirestoreError(err, editingContentId ? OperationType.UPDATE : OperationType.CREATE, 'content');
                    } finally {
                      setIsSubmittingContent(false);
                    }
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">النوع</label>
                    <select value={contentType} onChange={e => setContentType(e.target.value as 'news' | 'project')} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm">
                      <option value="news">خبر / إعلان</option>
                      <option value="project">مشروع جاري</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">العنوان</label>
                    <input type="text" required value={contentTitle} onChange={e => setContentTitle(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">التفاصيل</label>
                    <textarea required value={contentDetails} onChange={e => setContentDetails(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm h-24" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">رابط الصورة (Cloudinary)</label>
                    <input type="url" value={contentImageUrl} onChange={e => setContentImageUrl(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm" placeholder="https://res.cloudinary.com/..." />
                  </div>
                  {contentType === 'project' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase">نسبة الإنجاز ({contentProgress}%)</label>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={contentProgress} 
                          onChange={e => setContentProgress(Number(e.target.value))} 
                          className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-accent-gold" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary uppercase">الحالة</label>
                        <select value={contentStatus} onChange={e => setContentStatus(e.target.value as 'pending' | 'completed')} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm">
                          <option value="pending">قيد التنفيذ</option>
                          <option value="completed">مكتمل</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="pt-4 flex gap-3">
                    <button type="submit" disabled={isSubmittingContent} className="flex-1 btn-primary disabled:opacity-50">
                      {isSubmittingContent ? "جاري الحفظ..." : (editingContentId ? "تحديث المحتوى" : "إضافة المحتوى")}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Expense Creation Modal */}
        <AnimatePresence>
          {isExpenseModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsExpenseModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-bold text-accent-gold">إضافة مصروف جديد</h3>
                  <button onClick={() => setIsExpenseModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X size={20} />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!expenseCategory || expenseAmount <= 0) return;
                    setIsSubmittingExpense(true);
                    try {
                      await addDoc(collection(db, 'expenses'), {
                        category: expenseCategory,
                        amount: Number(expenseAmount),
                        details: expenseDetails,
                        date: new Date().toISOString()
                      });
                      setIsExpenseModalOpen(false);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, 'expenses');
                    } finally {
                      setIsSubmittingExpense(false);
                    }
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">الفئة</label>
                    <select required value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm">
                      <option value="">اختر الفئة...</option>
                      <option value="صيانة">صيانة</option>
                      <option value="كهرباء">كهرباء</option>
                      <option value="ماء">ماء</option>
                      <option value="نظافة">نظافة</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">المبلغ (د.م.)</label>
                    <input type="number" required value={expenseAmount} onChange={e => setExpenseAmount(Number(e.target.value))} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">التفاصيل</label>
                    <textarea value={expenseDetails} onChange={e => setExpenseDetails(e.target.value)} className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm h-24" placeholder="مثال: فاتورة كهرباء الدرج لشهر مارس" />
                  </div>
                  <div className="pt-4 flex gap-3">
                    <button type="submit" disabled={isSubmittingExpense} className="flex-1 btn-primary disabled:opacity-50">
                      {isSubmittingExpense ? "جاري الإضافة..." : "إضافة المصروف"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Feedback/Issue Report Modal */}
        <AnimatePresence>
          {isFeedbackModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsFeedbackModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-500" />
                    <h3 className="text-lg font-bold">بلغ عن مشكلة أو قدم ملاحظة</h3>
                  </div>
                  <button onClick={() => setIsFeedbackModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X size={20} />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!feedbackDescription) return;
                    setIsSubmittingFeedback(true);
                    try {
                      await addDoc(collection(db, 'feedback'), {
                        userId: user?.uid || null,
                        userEmail: user?.email || null,
                        type: feedbackType,
                        description: feedbackDescription,
                        screenshotUrl: feedbackScreenshotUrl || null,
                        createdAt: new Date().toISOString(),
                        status: 'pending'
                      });
                      setIsFeedbackModalOpen(false);
                      setFeedbackDescription('');
                      setFeedbackScreenshotUrl('');
                      alert('تم إرسال بلاغك بنجاح. شكراً لمساهمتك!');
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, 'feedback');
                    } finally {
                      setIsSubmittingFeedback(false);
                    }
                  }}
                  className="p-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">نوع البلاغ</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['bug', 'feedback', 'maintenance'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFeedbackType(t as any)}
                          className={cn(
                            "py-2 px-1 rounded-lg text-[10px] font-bold border transition-all",
                            feedbackType === t 
                              ? "bg-accent-gold text-background border-accent-gold" 
                              : "bg-background border-border text-text-secondary hover:border-accent-gold/50"
                          )}
                        >
                          {t === 'bug' ? 'خطأ تقني' : t === 'maintenance' ? 'صيانة' : 'ملاحظة'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">وصف المشكلة / الملاحظة</label>
                    <textarea 
                      required 
                      value={feedbackDescription} 
                      onChange={e => setFeedbackDescription(e.target.value)} 
                      placeholder="اشرح لنا ما حدث بالتفصيل..."
                      className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm h-32 focus:border-accent-gold/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">رابط لقطة شاشة (اختياري)</label>
                    <div className="relative">
                      <input 
                        type="url" 
                        value={feedbackScreenshotUrl} 
                        onChange={e => setFeedbackScreenshotUrl(e.target.value)} 
                        placeholder="https://imgur.com/..."
                        className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors" 
                      />
                    </div>
                    <p className="text-[10px] text-text-secondary italic">يمكنك رفع الصورة على أي موقع خارجي ووضع الرابط هنا.</p>
                  </div>
                  <div className="pt-4">
                    <button type="submit" disabled={isSubmittingFeedback} className="w-full btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                      {isSubmittingFeedback ? "جاري الإرسال..." : "إرسال البلاغ"}
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Receipt Creation Modal */}
        <AnimatePresence>
          {isReceiptModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsReceiptModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-bold text-accent-gold">إصدار إيصال جديد</h3>
                  <button onClick={() => setIsReceiptModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                    <X size={20} />
                  </button>
                </div>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!receiptApartmentId || receiptAmount <= 0) return;
                    
                    setIsSubmittingReceipt(true);
                    const receiptNo = generateReceiptNo(receipts.length);
                    const hash = generateHash();
                    const newReceipt = {
                      receiptNo,
                      apartmentId: receiptApartmentId,
                      amount: Number(receiptAmount),
                      date: new Date().toISOString(),
                      hash,
                      status: 'paid' as const
                    };
                    
                    try {
                      await addDoc(collection(db, 'receipts'), newReceipt);
                      setIsReceiptModalOpen(false);
                      setReceiptApartmentId('');
                      setReceiptAmount(100);
                      alert("تم إصدار الإيصال بنجاح");
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, 'receipts');
                    } finally {
                      setIsSubmittingReceipt(false);
                    }
                  }}
                  className="p-6 space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">اختر الشقة</label>
                    <select 
                      required
                      value={receiptApartmentId}
                      onChange={(e) => setReceiptApartmentId(e.target.value)}
                      className="w-full bg-background border border-border px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent-gold outline-none text-sm text-text-primary"
                    >
                      <option value="">-- اختر الشقة --</option>
                      {apartments.map(apt => (
                        <option key={apt.id} value={apt.id}>
                          شقة {apt.number} - {apt.ownerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">المبلغ (درهم)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(Number(e.target.value))}
                      className="w-full bg-background border border-border px-4 py-3 rounded-xl focus:ring-2 focus:ring-accent-gold outline-none text-sm text-text-primary"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="submit" 
                      disabled={isSubmittingReceipt}
                      className="flex-1 btn-primary disabled:opacity-50"
                    >
                      {isSubmittingReceipt ? "جاري الإصدار..." : "إصدار الإيصال"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsReceiptModalOpen(false)}
                      className="flex-1 bg-white/5 border border-border text-text-primary py-2.5 rounded-lg font-bold hover:bg-white/10 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation Dialog */}
        <AnimatePresence>
          {confirmDialog.isOpen && (
            <ConfirmDialogComponent 
              dialog={confirmDialog} 
              onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} 
            />
          )}
        </AnimatePresence>

        {/* Broadcast Modal (Push Notifications) */}
        <AnimatePresence>
          {isBroadcastModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setIsBroadcastModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-border flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-bold text-accent-gold">إرسال إشعار عاجل للجميع</h3>
                  <button onClick={() => setIsBroadcastModalOpen(false)} className="text-text-secondary hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleBroadcast} className="p-6 space-y-6">
                  <div className="p-4 rounded-xl bg-accent-gold/5 border border-accent-gold/10 flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold">
                      <Volume2 size={24} />
                    </div>
                    <p className="text-[10px] text-text-secondary font-medium leading-relaxed">
                      هذا الإشعار سيظهر فوراً كـ "Push Notification" لجميع المستخدمين المتصلين في الوقت الفعلي.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">عنوان الإشعار</label>
                    <input 
                      required 
                      type="text" 
                      value={broadcastTitle} 
                      onChange={e => setBroadcastTitle(e.target.value)} 
                      placeholder="مثلاً: اجتماع طارئ للسكان"
                      className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">نوع الإشعار</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['info', 'update', 'alert'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setBroadcastType(t)}
                          className={cn(
                            "py-2 rounded-lg text-[11px] font-bold border transition-all",
                            broadcastType === t 
                              ? "bg-accent-gold text-background border-accent-gold" 
                              : "bg-background border-border text-text-secondary hover:border-accent-gold/50"
                          )}
                        >
                          {t === 'info' ? 'معلومة' : t === 'update' ? 'تحديث' : 'تنبيه'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary uppercase">محتوى الرسالة</label>
                    <textarea 
                      required 
                      value={broadcastBody} 
                      onChange={e => setBroadcastBody(e.target.value)} 
                      placeholder="اكتب تفاصيل الإشعار هنا..."
                      className="w-full bg-background border border-border px-4 py-3 rounded-xl outline-none text-sm h-32 focus:border-accent-gold/50 transition-colors"
                    />
                  </div>

                  <div className="pt-4">
                    <button type="submit" disabled={isSubmittingBroadcast} className="w-full btn-primary disabled:opacity-50 flex items-center justify-center gap-2">
                      {isSubmittingBroadcast ? "جاري البث..." : "بث الإشعار الآن"}
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Login Modal */}
        <AnimatePresence>
          {isLoginModalOpen && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setIsLoginModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-card border border-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 text-center bg-white/5 border-b border-border">
                  <div className="w-16 h-16 rounded-2xl bg-accent-gold mx-auto mb-6 flex items-center justify-center shadow-lg shadow-accent-gold/20">
                    <Building2 className="text-background" size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">
                    {isLoginView ? "تسجيل الدخول" : "إنشاء حساب جديد"}
                  </h3>
                  <p className="text-xs text-text-secondary">سانديك عمارة عمر الفاروق - الإدارة الرقمية</p>
                </div>

                <div className="p-8 space-y-6">
                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold text-center"
                    >
                      {authError}
                    </motion.div>
                  )}

                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">اسم المستخدم</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input 
                          type="text" 
                          required 
                          placeholder="doukkar / benaissa"
                          value={loginEmail} 
                          onChange={e => setLoginEmail(e.target.value)}
                          className="w-full bg-background border border-border pl-12 pr-4 py-3 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors text-right"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest px-1">كلمة المرور</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required 
                          placeholder="••••••••"
                          value={loginPassword} 
                          onChange={e => setLoginPassword(e.target.value)}
                          className="w-full bg-background border border-border pl-12 pr-12 py-3 rounded-xl outline-none text-sm focus:border-accent-gold/50 transition-colors text-right"
                          dir="ltr"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSubmittingAuth}
                      className="w-full btn-primary py-3.5 shadow-xl shadow-accent-gold/10 disabled:opacity-50"
                    >
                      {isSubmittingAuth ? "جاري التحقق من الهوية..." : "دخول المسؤول"}
                    </button>
                  </form>

                  <div className="pt-4 text-center">
                    <p className="text-[10px] text-text-secondary font-bold flex items-center justify-center gap-2">
                      <ShieldCheck size={14} className="text-accent-gold" />
                      الولوج مقيد للمسؤولين المعتمدين فقط
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center justify-between group py-3.5 px-4 rounded-xl text-sm transition-all duration-300",
          active 
            ? "bg-accent-gold/10 text-accent-gold font-bold shadow-sm" 
            : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "transition-transform duration-300 group-hover:scale-110",
            active ? "text-accent-gold" : "opacity-70"
          )}>{icon}</span>
          <span className="tracking-tight">{label}</span>
        </div>
        {badge !== undefined && (
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-md font-bold",
            active ? "bg-accent-gold text-background" : "bg-white/10 text-text-secondary"
          )}>
            {badge}
          </span>
        )}
      </button>
    </li>
  );
}

function StatCard({ title, value, icon, trend, isGold }: { title: string, value: number | string, icon?: React.ReactNode, trend?: string, isGold?: boolean }) {
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className={cn(
        "p-6 rounded-2xl border border-border group relative overflow-hidden transition-all duration-300",
        isGold ? "bg-accent-gold/5 border-accent-gold/30 shadow-xl shadow-accent-gold/5" : "bg-card hover:border-accent-gold/30"
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent-gold/5 blur-[60px] -translate-y-16 translate-x-16 pointer-events-none" />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-2.5 rounded-xl bg-white/5 border border-border group-hover:border-accent-gold/30 transition-colors">
          <span className={isGold ? "text-accent-gold" : "text-text-secondary"}>{icon}</span>
        </div>
        {trend && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
            {trend}
          </span>
        )}
      </div>
      
      <div className="relative z-10">
        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-[2px] mb-1">{title}</p>
        <p className={cn("text-3xl font-bold tracking-tight", isGold ? "text-accent-gold" : "text-text-primary")}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </motion.div>
  );
}

