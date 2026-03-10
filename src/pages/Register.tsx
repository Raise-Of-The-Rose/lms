import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    mobile: z.string().min(10, 'Mobile number must be at least 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: { name: "", email: "", mobile: "", password: "" }
    });

    const onSubmit = async (data: RegisterFormValues) => {
        setLoading(true);
        setError('');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
            const user = userCredential.user;
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid, email: data.email, displayName: data.name, mobile: data.mobile,
                role: 'STUDENT', createdAt: new Date(),
            });
            navigate('/');
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignup = async () => {
        setLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                // For Google Auth we might not have a mobile number initially, but we save what we have
                await setDoc(userDocRef, {
                    uid: user.uid, email: user.email, displayName: user.displayName || 'User', mobile: '',
                    role: 'STUDENT', createdAt: new Date(),
                });
            }
            navigate('/');
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const getFriendlyErrorMessage = (errorCode: string) => {
        switch (errorCode) {
            case 'auth/email-already-in-use': return 'An account with this email already exists.';
            case 'auth/invalid-email': return 'The email address you entered is not valid.';
            case 'auth/weak-password': return 'Your password is too weak (min 6 chars).';
            default: return 'Something went wrong. Please try again.';
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-base-200 p-4 relative overflow-hidden font-sans">
            <div className="absolute top-0 -left-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 -right-20 w-96 h-96 bg-secondary/5 rounded-full blur-[100px]" />

            <div className="card w-full max-w-md bg-base-100 shadow-2xl z-10">
                <div className="card-body p-8">
                    <div className="text-center mb-2">
                        <h2 className="card-title text-3xl font-black tracking-tighter justify-center uppercase italic text-primary">Create Account</h2>
                        <p className="text-base-content/60 font-medium mt-1">Join our community and start learning today.</p>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Full Name</span></label>
                            <input placeholder="John Doe" className="input input-bordered w-full" {...register('name')} />
                            {errors.name && <p className="text-error text-xs font-bold mt-1">{errors.name.message}</p>}
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Email Address</span></label>
                            <input type="email" placeholder="name@example.com" className="input input-bordered w-full" {...register('email')} />
                            {errors.email && <p className="text-error text-xs font-bold mt-1">{errors.email.message}</p>}
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Mobile Number</span></label>
                            <input type="tel" placeholder="+91 **********" className="input input-bordered w-full" {...register('mobile')} />
                            {errors.mobile && <p className="text-error text-xs font-bold mt-1">{errors.mobile.message}</p>}
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Password</span></label>
                            <input type="password" placeholder="••••••••" className="input input-bordered w-full" {...register('password')} />
                            {errors.password && <p className="text-error text-xs font-bold mt-1">{errors.password.message}</p>}
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-black uppercase tracking-tight">{error}</span>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary w-full h-14 font-black uppercase text-xs tracking-[0.2em]" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Initialize Account'}
                        </button>
                    </form>

                    <div className="divider text-[10px] uppercase tracking-widest font-black text-base-content/30 my-6">Cloud Auth Flow</div>

                    <button type="button" className="btn btn-outline w-full h-14 font-black uppercase text-xs tracking-widest gap-3" onClick={handleGoogleSignup} disabled={loading}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google Node
                    </button>

                    <p className="text-xs text-base-content/50 font-bold text-center mt-6 uppercase tracking-widest">
                        Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}