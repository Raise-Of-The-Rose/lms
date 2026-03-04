import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User, CheckCircle2, Clock, IndianRupee, Sparkles, Zap } from 'lucide-react';

interface Course {
    id: string;
    title: string;
    description: string;
    courseImage: string;
    trainerId: string;
    trainerName?: string;
    totalModules: number;
    fee: string;
    startingAt: string;
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
            setUpiId(''); setTxnId(''); setScreenshot(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen flex-col gap-4 items-center justify-center bg-base-200">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold tracking-[0.2em] text-base-content/50 uppercase">Syncing Dashboard</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-base-200 pb-20 font-sans">
            <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-10">
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="h-1 w-10 bg-primary rounded-full" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Student Portal</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-base-content lg:text-5xl">Curated <span className="text-primary">Pathways</span></h1>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {courses.map((course) => {
                        const status = enrollments[course.id];
                        return (
                            <div key={course.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group">
                                <figure className="relative h-64">
                                    <img src={course.courseImage} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={course.title} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-base-100/90 via-base-100/20 to-transparent" />

                                    <div className="absolute top-5 left-5 z-10">
                                        <div className="bg-base-100/90 backdrop-blur-md shadow-2xl px-4 py-2 rounded-2xl flex flex-col items-center">
                                            <span className="text-[8px] font-black uppercase tracking-tighter text-primary mb-0.5">Starting At</span>
                                            <div className="flex items-baseline gap-0.5 text-base-content">
                                                <span className="text-sm font-bold">₹</span>
                                                <span className="text-xl font-black tracking-tighter">{course.startingAt}</span>
                                                <span className="text-[10px] font-bold text-base-content/50">/mo</span>
                                            </div>
                                        </div>
                                    </div>

                                    {status && (
                                        <div className="absolute top-5 right-5 z-10">
                                            <span className={`badge badge-lg font-black text-[9px] uppercase tracking-wider ${status === 'ENROLLED' ? 'badge-primary' : 'badge-ghost'}`}>
                                                {status === 'ENROLLED' ? <CheckCircle2 size={12} className="mr-1.5" /> : <Clock size={12} className="mr-1.5" />} {status}
                                            </span>
                                        </div>
                                    )}

                                    {!status && (
                                        <div className="absolute bottom-5 left-6 flex flex-col leading-none">
                                            <span className="text-[10px] font-black text-primary/80 uppercase tracking-[0.1em] mb-1 drop-shadow-md">Full Certification</span>
                                            <div className="flex items-center gap-1 text-base-content drop-shadow-lg">
                                                <IndianRupee size={20} className="stroke-[3]" />
                                                <span className="text-4xl font-black tracking-tighter">{course.fee}</span>
                                            </div>
                                        </div>
                                    )}
                                </figure>

                                <div className="card-body p-7">
                                    <div className="flex items-center gap-2 text-primary mb-1">
                                        <Sparkles size={14} className="fill-primary" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Industry Standard</span>
                                    </div>
                                    <h3 className="card-title text-2xl font-black tracking-tight group-hover:text-primary transition-colors">{course.title}</h3>
                                    <p className="text-base-content/60 line-clamp-2 leading-relaxed font-medium text-sm">{course.description}</p>

                                    <div className="flex items-center justify-between py-5 border-t border-base-300 mt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="avatar placeholder">
                                                <div className="bg-base-200 text-base-content/60 rounded-full w-10">
                                                    <User size={18} />
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-base-content/40 leading-none mb-1">Mentor</span>
                                                <span className="text-xs font-bold text-base-content leading-tight">{course.trainerName}</span>
                                            </div>
                                        </div>
                                        <div className="badge badge-primary badge-outline gap-1">
                                            <Zap size={14} className="fill-primary" />
                                            {course.totalModules || 0} Units
                                        </div>
                                    </div>

                                    {status === 'ENROLLED' ? (
                                        <button className="btn btn-primary w-full font-black text-xs tracking-widest" onClick={() => navigate(`/course/${course.id}`)}>
                                            RESUME LEARNING
                                        </button>
                                    ) : status === 'PENDING' ? (
                                        <button className="btn btn-disabled w-full font-black text-xs tracking-widest" disabled>
                                            <Clock size={14} className="animate-pulse" /> VERIFICATION PENDING
                                        </button>
                                    ) : (
                                        <button className="btn btn-primary w-full font-black text-xs tracking-widest" onClick={() => { setSelectedCourse(course); setIsDialogOpen(true); }}>
                                            ENROLL FOR ₹{course.fee}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Payment Modal */}
            <dialog className={`modal ${isDialogOpen ? 'modal-open' : ''}`}>
                <div className="modal-box max-w-lg p-0">
                    <div className="bg-primary/10 p-10 text-center border-b border-base-300">
                        <span className="badge badge-primary font-black text-[10px] mb-4">EMI STARTING AT ₹{selectedCourse?.startingAt}/mo</span>
                        <h3 className="text-4xl font-black tracking-tighter uppercase italic">Secure Access</h3>
                        <p className="text-base-content/60 font-medium mt-2">
                            Lifetime access to <span className="font-bold text-base-content">{selectedCourse?.title}</span>
                        </p>
                    </div>

                    <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
                        <div className="p-6 bg-base-200 rounded-2xl flex flex-col items-center gap-4 text-center">
                            <div className="bg-base-100 p-4 rounded-2xl shadow-sm">
                                <img src="https://res.cloudinary.com/dq6c78y00/image/upload/v1772553375/Shyam_payment_qr_code_bpmbfc.jpg" alt="Payment QR" className="w-40 h-40 object-cover rounded-xl" />
                            </div>
                            <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-widest">
                                Pay total: <span className="text-primary text-sm font-black">₹{selectedCourse?.fee}</span>
                            </p>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text text-[9px] font-black uppercase tracking-widest">Your UPI handle</span></label>
                            <input placeholder="e.g. user@upi" className="input input-bordered w-full" value={upiId} onChange={e => setUpiId(e.target.value)} required />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text text-[9px] font-black uppercase tracking-widest">Transaction Ref (UTR)</span></label>
                            <input placeholder="12-digit numeric code" className="input input-bordered w-full" value={txnId} onChange={e => setTxnId(e.target.value)} required />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text text-[9px] font-black uppercase tracking-widest">Upload Receipt</span></label>
                            <input type="file" accept="image/*" className="file-input file-input-bordered w-full" onChange={e => setScreenshot(e.target.files?.[0] || null)} required />
                        </div>

                        <button type="submit" className="btn btn-primary w-full h-16 font-black tracking-widest text-sm" disabled={isSubmitting}>
                            {isSubmitting ? "FINALIZING..." : "CONFIRM ENROLLMENT"}
                        </button>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop" onClick={() => setIsDialogOpen(false)}><button>close</button></form>
            </dialog>
        </div>
    );
}