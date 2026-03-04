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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
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
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4 relative overflow-hidden font-sans">
            {/* Background Decorations */}
            <div className="absolute top-0 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 -left-20 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px]" />

            <Card className="w-full max-w-md border-slate-200/60 shadow-2xl rounded-[2.5rem] bg-white/90 backdrop-blur-xl z-10 overflow-hidden">
                <CardHeader className="space-y-1 p-8 pb-4 text-center">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                        <KeyRound className="text-white" size={24} />
                    </div>
                    <CardTitle className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">Welcome Back</CardTitle>
                    <CardDescription className="text-slate-400 font-medium">Log in to resume your curriculum.</CardDescription>
                </CardHeader>

                <CardContent className="p-8 pt-4">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity Endpoint</Label>
                            <Input placeholder="email@example.com" className="rounded-xl border-slate-200 h-12 focus-visible:ring-indigo-600" {...register('email')} />
                            {errors.email && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Access Token</Label>

                                <Dialog onOpenChange={() => { setResetMessage(''); setResetEmail(''); }}>
                                    <DialogTrigger asChild>
                                        <button type="button" className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-400 transition-colors tracking-widest">Forgot password?</button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[420px] w-[95vw] p-0 overflow-hidden rounded-[2rem] border-none bg-white shadow-2xl">
                                        <div className="bg-slate-950 p-8 text-white relative">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/20 rounded-full blur-2xl -mr-10 -mt-10" />
                                            <DialogHeader className="relative z-10">
                                                <DialogTitle className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-2">
                                                    <ShieldCheck className="text-indigo-500" /> Account Recovery
                                                </DialogTitle>
                                                <DialogDescription className="text-slate-400 font-medium pt-1">
                                                    Enter your registered email to receive a secure reset link.
                                                </DialogDescription>
                                            </DialogHeader>
                                        </div>

                                        <form onSubmit={handleForgotPassword} className="p-8 space-y-6">
                                            <div className="space-y-2 group">
                                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Recovery Destination</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                                                    <Input
                                                        type="email"
                                                        placeholder="email@example.com"
                                                        className="h-12 pl-11 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-indigo-600 font-medium"
                                                        value={resetEmail}
                                                        onChange={(e) => setResetEmail(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {resetMessage && (
                                                <div className={`p-4 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in duration-300 ${resetMessage.includes('sent') ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-rose-50 border border-rose-100 text-rose-700'}`}>
                                                    {resetMessage.includes('sent') ? <ShieldCheck size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
                                                    <p className="text-xs font-bold leading-tight uppercase tracking-tight">{resetMessage}</p>
                                                </div>
                                            )}

                                            <Button type="submit" className="w-full h-12 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-xl uppercase text-xs tracking-[0.2em] transition-all shadow-lg shadow-indigo-100" disabled={resetLoading}>
                                                {resetLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'INITIATE RECOVERY'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Input id="password" type="password" placeholder="••••••••" className="rounded-xl border-slate-200 h-12 focus-visible:ring-indigo-600" {...register('password')} />
                            {errors.password && <p className="text-[10px] text-rose-500 font-bold uppercase tracking-tight ml-1">{errors.password.message}</p>}
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle size={16} />
                                <span className="text-[11px] font-black uppercase tracking-tight">{error}</span>
                            </div>
                        )}

                        <Button type="submit" className="w-full h-14 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 uppercase text-xs tracking-[0.2em] transition-all active:scale-95" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'AUTHORIZE SESSION'}
                        </Button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-slate-300">
                            <span className="bg-white px-4">Cloud Auth Flow</span>
                        </div>
                    </div>

                    <Button variant="outline" className="w-full h-14 flex gap-3 border-2 border-slate-900 bg-transparent text-slate-900 hover:bg-slate-900 hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all" onClick={handleGoogleLogin} disabled={loading}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google Node
                    </Button>
                </CardContent>

                <CardFooter className="pb-8 pt-2">
                    <p className="text-[11px] text-slate-400 font-bold text-center w-full uppercase tracking-widest">
                        New student? <Link to="/register" className="text-indigo-600 hover:text-slate-900 transition-colors border-b-2 border-indigo-100 pb-0.5">Initialize Account</Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}