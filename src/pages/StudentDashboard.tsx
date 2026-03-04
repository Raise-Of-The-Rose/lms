import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, UploadCloud, QrCode, BookOpen, User, CheckCircle2, Clock } from 'lucide-react';

interface Course {
    id: string;
    title: string;
    description: string;
    courseImage: string;
    trainerId: string;
    trainerName?: string;
    totalModules: number;
}

export default function StudentDashboard() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [courses, setCourses] = useState<Course[]>([]);
    const [enrollments, setEnrollments] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [upiId, setUpiId] = useState('');
    const [txnId, setTxnId] = useState('');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const courseSnap = await getDocs(collection(db, 'courses'));
                const courseList = courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));

                const trainerIds = Array.from(new Set(courseList.map(c => c.trainerId).filter(Boolean)));
                if (trainerIds.length > 0) {
                    const trainersQ = query(collection(db, 'users'), where("__name__", "in", trainerIds));
                    const trainerSnap = await getDocs(trainersQ);
                    const trainerMap: Record<string, string> = {};
                    trainerSnap.docs.forEach(d => trainerMap[d.id] = d.data().displayName);
                    courseList.forEach(c => c.trainerName = trainerMap[c.trainerId] || "Instructor");
                }

                if (currentUser) {
                    const enrollQ = query(collection(db, 'enrollments'), where("studentId", "==", currentUser.uid));
                    const enrollSnap = await getDocs(enrollQ);
                    const enrollMap: Record<string, string> = {};
                    enrollSnap.docs.forEach(d => enrollMap[d.data().courseId] = d.data().status);
                    setEnrollments(enrollMap);
                }

                setCourses(courseList);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser]);

    const uploadToCloudinary = async (file: File) => {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        return data.secure_url;
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!screenshot || !currentUser || !selectedCourse) return;
        setIsSubmitting(true);
        try {
            const screenshotUrl = await uploadToCloudinary(screenshot);
            await addDoc(collection(db, 'enrollments'), {
                studentId: currentUser.uid,
                courseId: selectedCourse.id,
                status: 'PENDING',
                progress: 0,
                completedModules: [],
                paymentDetails: { txnId, upiId, screenshotUrl },
                enrolledAt: serverTimestamp(),
            });
            setIsDialogOpen(false);
            setEnrollments(prev => ({ ...prev, [selectedCourse.id]: 'PENDING' }));
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen flex-col gap-4 items-center justify-center bg-slate-50/50">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">Syncing Dashboard</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50/30 pb-20">
            <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="h-1 w-10 bg-indigo-600 rounded-full" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Student Portal</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 lg:text-5xl">Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Courses</span></h1>
                    <p className="text-slate-500 font-medium max-w-2xl">Advance your skills with professional-grade training and real-time mentorship.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {courses.map((course) => {
                        const status = enrollments[course.id];
                        return (
                            <Card key={course.id} className="group overflow-hidden flex flex-col hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-500 bg-white border-slate-200/60 rounded-[2rem] hover:-translate-y-1">
                                <div className="relative h-52 overflow-hidden">
                                    <img src={course.courseImage} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" alt={course.title} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {status && (
                                        <div className="absolute top-4 right-4">
                                            <Badge className={`px-4 py-1.5 rounded-full border-none shadow-lg font-bold text-[10px] uppercase tracking-wider ${status === 'ENROLLED' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                {status === 'ENROLLED' ? <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {status}</span> : <span className="flex items-center gap-1"><Clock size={12} /> {status}</span>}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                <CardHeader className="space-y-3 p-6">
                                    <CardTitle className="text-2xl font-black tracking-tight text-slate-900 line-clamp-1">{course.title}</CardTitle>
                                    <CardDescription className="line-clamp-2 h-10 leading-relaxed font-medium">{course.description}</CardDescription>
                                </CardHeader>

                                <CardContent className="flex-grow px-6 py-0">
                                    <div className="flex items-center gap-4 py-4 border-t border-slate-50">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <User size={16} className="text-indigo-500" />
                                            <span className="text-xs font-bold uppercase tracking-wide">{course.trainerName}</span>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="p-6 pt-0">
                                    {status === 'ENROLLED' ? (
                                        <Button className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-white font-black text-xs tracking-widest transition-all shadow-xl shadow-slate-200" onClick={() => navigate(`/course/${course.id}`)}>
                                            RESUME LEARNING
                                        </Button>
                                    ) : status === 'PENDING' ? (
                                        <Button className="w-full h-12 rounded-2xl bg-slate-100 text-slate-400 font-black text-xs tracking-widest" disabled variant="ghost">WAITING FOR APPROVAL</Button>
                                    ) : (
                                        <Dialog open={isDialogOpen && selectedCourse?.id === course.id} onOpenChange={(open) => {
                                            setIsDialogOpen(open);
                                            if (open) setSelectedCourse(course);
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button className="w-full h-12 rounded-2xl border-2 border-slate-900 bg-transparent text-slate-900 hover:bg-slate-900 hover:text-white font-black text-xs tracking-widest transition-all">ENROLL NOW</Button>
                                            </DialogTrigger>

                                            <DialogContent className="sm:max-w-[480px] w-[95vw] p-0 overflow-hidden rounded-[2.5rem] border-none bg-white shadow-2xl flex flex-col max-h-[92vh]">
                                                <div className="bg-slate-950 p-8 text-white shrink-0 relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
                                                    <DialogHeader className="relative z-10">
                                                        <DialogTitle className="text-3xl font-black tracking-tighter uppercase italic">Secure Checkout</DialogTitle>
                                                        <DialogDescription className="text-slate-400 font-medium">
                                                            Course: <span className="text-indigo-400 font-bold">{course.title}</span>
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                </div>

                                                <form onSubmit={handlePaymentSubmit} className="p-8 space-y-8 bg-white overflow-y-auto custom-scrollbar">
                                                    <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center gap-4">
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                            <QrCode className="h-4 w-4 text-indigo-600" /> Gateway Node
                                                        </div>
                                                        <div className="bg-white p-3 rounded-2xl shadow-sm ring-1 ring-slate-100">
                                                            <img
                                                                src="https://res.cloudinary.com/dq6c78y00/image/upload/v1772553375/Shyam_payment_qr_code_bpmbfc.jpg"
                                                                alt="Payment QR"
                                                                className="w-44 h-44 object-cover rounded-lg"
                                                            />
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 text-center font-medium leading-relaxed">
                                                            Scan the QR code to pay via any UPI app. <br /> Upload your <span className="text-slate-900 font-bold">12-digit UTR</span> screenshot below.
                                                        </p>
                                                    </div>

                                                    <div className="space-y-5">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="upiId" className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Your UPI Handle</Label>
                                                            <Input id="upiId" placeholder="username@upi" value={upiId} onChange={e => setUpiId(e.target.value)} required
                                                                className="rounded-xl border-slate-200 h-12 focus-visible:ring-indigo-500" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="txnId" className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">UTR / Transaction ID</Label>
                                                            <Input id="txnId" placeholder="12-digit numeric code" value={txnId} onChange={e => setTxnId(e.target.value)} required
                                                                className="rounded-xl border-slate-200 h-12 focus-visible:ring-indigo-500" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="screenshot" className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Payment Verification</Label>
                                                            <div className="relative group">
                                                                <Input id="screenshot" type="file" accept="image/*" onChange={e => setScreenshot(e.target.files?.[0] || null)} required
                                                                    className="rounded-xl border-slate-200 h-12 pt-2.5 file:bg-indigo-600 file:text-white file:rounded-lg file:text-[10px] file:font-black file:uppercase file:border-none file:mr-4 file:px-3" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Button type="submit" className="w-full h-14 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-2xl shadow-2xl shadow-indigo-200 transition-all active:scale-95" disabled={isSubmitting}>
                                                        {isSubmitting ? (
                                                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> VERIFYING...</>
                                                        ) : (
                                                            <><UploadCloud className="mr-2 h-5 w-5" /> CONFIRM ENROLLMENT</>
                                                        )}
                                                    </Button>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}