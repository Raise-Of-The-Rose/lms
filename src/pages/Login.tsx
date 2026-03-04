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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; // Added doc/getDoc
import { db } from '@/lib/firebase'; // Added db
const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const getFriendlyErrorMessage = (errorCode: string) => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try logging in instead.';
        case 'auth/invalid-email':
            return 'The email address you entered is not valid.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact support.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please try again.';
        case 'auth/weak-password':
            return 'Your password is too weak. Please use at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later for your security.';
        default:
            return 'Something went wrong. Please try again in a few moments.';
    }
};

export default function Login() {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot Password States
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMessage, setResetMessage] = useState('');

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    });

    // Helper function to handle redirection based on role
    const handleRoleRedirection = (role: string | null) => {
        if (role === 'ADMIN') {
            navigate('/admin');
        } else if (role === 'TRAINER') {
            navigate('/trainer');
        } else {
            navigate('/dashboard'); // Default for STUDENTS
        }
    };

    const onSubmit = async (data: LoginFormValues) => {
        setLoading(true);
        setError('');
        try {
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
            const uid = userCredential.user.uid;

            // Fetch role from Firestore
            const userDoc = await getDoc(doc(db, 'users', uid));
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
            const uid = result.user.uid;

            // Check if user document exists, create it if not (Default to STUDENT)
            const userDocRef = doc(db, 'users', uid);
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
        <div className="flex items-center justify-center min-h-screen bg-background p-4 relative overflow-hidden">
            {/* Soft decorative background glow to match Register page */}
            <div className="absolute top-0 -right-4 w-72 h-72 bg-primary/10 rounded-full blur-3xl opacity-60" />
            <div className="absolute bottom-0 -left-4 w-72 h-72 bg-primary/5 rounded-full blur-3xl opacity-60" />

            <Card className="w-full max-w-md border-border/50 shadow-xl backdrop-blur-sm bg-card/80 z-10">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Log in to access your courses and continue learning.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email@example.com"
                                className="bg-background focus:ring-primary/30 transition-all"
                                {...register('email')}
                            />
                            {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>

                                {/* Forgot Password Dialog */}
                                <Dialog onOpenChange={() => { setResetMessage(''); setResetEmail(''); }}>
                                    <DialogTrigger asChild>
                                        <button type="button" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                                            Forgot password?
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md bg-card border-border">
                                        <DialogHeader>
                                            <DialogTitle>Reset your password</DialogTitle>
                                            <DialogDescription className="text-muted-foreground">
                                                Enter your email and we'll send you a link to get back into your account.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleForgotPassword} className="space-y-4 pt-4">
                                            <Input
                                                type="email"
                                                placeholder="Enter your email"
                                                className="bg-background"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                required
                                            />
                                            {resetMessage && (
                                                <p className={`text-xs font-medium ${resetMessage.includes('sent') ? 'text-green-600' : 'text-destructive'}`}>
                                                    {resetMessage}
                                                </p>
                                            )}
                                            <Button type="submit" className="w-full" disabled={resetLoading}>
                                                {resetLoading ? 'Sending...' : 'Send Reset Link'}
                                            </Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                className="bg-background focus:ring-primary/30 transition-all"
                                {...register('password')}
                            />
                            {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
                        </div>

                        {error && (
                            <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            </div>
                        )}

                        <Button type="submit" className="w-full h-11 text-base font-semibold shadow-md shadow-primary/20 active:scale-[0.98] transition-all" disabled={loading}>
                            {loading ? 'Logging in...' : 'Log In with Email'}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-3 text-muted-foreground font-medium">Or continue with</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 flex gap-2 border-border/60 hover:bg-accent hover:text-accent-foreground transition-all"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google
                    </Button>
                </CardContent>
                <CardFooter className="pt-2">
                    <p className="text-sm text-muted-foreground text-center w-full">
                        Don't have an account? <Link to="/register" className="text-primary font-bold hover:underline underline-offset-4 decoration-2 transition-all">Sign up</Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}