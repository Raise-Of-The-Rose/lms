import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Mail, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const getFriendlyErrorMessage = (errorCode: string) => {
    switch (errorCode) {
        case 'auth/email-already-in-use': return 'An account with this email already exists.';
        case 'auth/invalid-email': return 'The email address you entered is not valid.';
        case 'auth/user-disabled': return 'This account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Invalid email or password.';
        case 'auth/too-many-requests': return 'Too many attempts. Please try later.';
        default: return 'Something went wrong. Please try again.';
    }
};

export default function Login() {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMessage, setResetMessage] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    const handleRoleRedirection = (role: string | null) => {
        if (role === 'ADMIN') navigate('/admin');
        else if (role === 'TRAINER') navigate('/trainer');
        else navigate('/dashboard');
    };

    const onSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        setError('');
        try {
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            const role = userDoc.exists() ? userDoc.data().role : 'STUDENT';
            handleRoleRedirection(role);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const userDocRef = doc(db, 'users', result.user.uid);
            const userDoc = await getDoc(userDocRef);
            let role = 'STUDENT';
            if (!userDoc.exists()) {
                await setDoc(userDocRef, {
                    displayName: result.user.displayName,
                    email: result.user.email,
                    role: 'STUDENT',
                    createdAt: serverTimestamp()
                });
            } else {
                role = userDoc.data().role;
            }
            handleRoleRedirection(role);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        setResetMessage('');
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            setResetMessage('A reset link has been sent to your inbox.');
        } catch (err: any) {
            setResetMessage(err.message || 'Failed to send reset email.');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-base-200 p-4 relative overflow-hidden font-sans">
            <div className="absolute top-0 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 -left-20 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]" />

            <div className="card w-full max-w-md bg-base-100 shadow-2xl z-10">
                <div className="card-body p-8">
                    <div className="text-center mb-2">
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <KeyRound className="text-primary-content" size={24} />
                        </div>
                        <h2 className="card-title text-3xl font-black tracking-tighter justify-center uppercase italic">Welcome Back</h2>
                        <p className="text-base-content/60 font-medium mt-1">Log in to resume your curriculum.</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Identity Endpoint</span></label>
                            <input type="email" placeholder="email@example.com" className="input input-bordered w-full" {...register('email')} />
                            {errors.email && <p className="text-error text-xs font-bold mt-1">{errors.email.message}</p>}
                        </div>

                        <div className="form-control">
                            <div className="flex items-center justify-between">
                                <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Access Token</span></label>
                                <button type="button" className="text-[10px] font-black uppercase text-primary hover:text-primary-focus transition-colors tracking-widest" onClick={() => setShowResetModal(true)}>Forgot password?</button>
                            </div>
                            <input type="password" placeholder="••••••••" className="input input-bordered w-full" {...register('password')} />
                            {errors.password && <p className="text-error text-xs font-bold mt-1">{errors.password.message}</p>}
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                <AlertCircle size={16} />
                                <span className="text-xs font-black uppercase tracking-tight">{error}</span>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary w-full h-14 font-black uppercase text-xs tracking-[0.2em]" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'AUTHORIZE SESSION'}
                        </button>
                    </form>

                    <div className="divider text-[10px] uppercase tracking-widest font-black text-base-content/30 my-6">Cloud Auth Flow</div>

                    <button className="btn btn-outline w-full h-14 font-black uppercase text-xs tracking-widest gap-3" onClick={handleGoogleLogin} disabled={loading}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google Node
                    </button>

                    <p className="text-xs text-base-content/50 font-bold text-center mt-6 uppercase tracking-widest">
                        New student? <Link to="/register" className="text-primary hover:underline">Initialize Account</Link>
                    </p>
                </div>
            </div>

            {/* Reset Password Modal */}
            <dialog className={`modal ${showResetModal ? 'modal-open' : ''}`}>
                <div className="modal-box">
                    <h3 className="font-black text-2xl uppercase italic flex items-center gap-2 mb-1">
                        <ShieldCheck className="text-primary" /> Account Recovery
                    </h3>
                    <p className="text-base-content/60 font-medium text-sm mb-6">Enter your registered email to receive a secure reset link.</p>

                    <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Recovery Destination</span></label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                                <input type="email" placeholder="email@example.com" className="input input-bordered w-full pl-11" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                            </div>
                        </div>

                        {resetMessage && (
                            <div className={`alert ${resetMessage.includes('sent') ? 'alert-success' : 'alert-error'}`}>
                                {resetMessage.includes('sent') ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                                <span className="text-xs font-bold uppercase">{resetMessage}</span>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary w-full font-black uppercase text-xs tracking-[0.2em]" disabled={resetLoading}>
                            {resetLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'INITIATE RECOVERY'}
                        </button>
                    </form>

                    <div className="modal-action">
                        <button className="btn btn-ghost" onClick={() => { setShowResetModal(false); setResetMessage(''); setResetEmail(''); }}>Close</button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop" onClick={() => setShowResetModal(false)}><button>close</button></form>
            </dialog>
        </div>
    );
}