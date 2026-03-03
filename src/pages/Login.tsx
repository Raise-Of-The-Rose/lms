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
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                    <CardDescription>Log in to access your courses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="email@example.com" {...register('email')} />
                            {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>

                                {/* Forgot Password Dialog */}
                                <Dialog onOpenChange={() => { setResetMessage(''); setResetEmail(''); }}>
                                    <DialogTrigger asChild>
                                        <button type="button" className="text-xs font-medium text-blue-600 hover:underline">
                                            Forgot password?
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Reset your password</DialogTitle>
                                            <DialogDescription>
                                                Enter your email and we'll send you a link to get back into your account.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleForgotPassword} className="space-y-4 pt-4">
                                            <Input
                                                type="email"
                                                placeholder="Enter your email"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                required
                                            />
                                            {resetMessage && (
                                                <p className={`text-xs font-medium ${resetMessage.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
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
                            <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                            {errors.password && <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>}
                        </div>

                        {error && (
                            <div className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            </div>
                        )}

                        <Button type="submit" className="w-full h-11" disabled={loading}>
                            {loading ? 'Logging in...' : 'Log In with Email'}
                        </Button>
                    </form>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-3 text-gray-500 font-medium">Or continue with</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full h-11 flex gap-2"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" alt="" className="w-4 h-4" />
                        Google
                    </Button>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                    <p className="text-sm text-gray-600 text-center">
                        Don't have an account? <Link to="/register" className="text-blue-600 font-semibold hover:underline">Sign up</Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}