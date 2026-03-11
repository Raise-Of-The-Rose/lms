import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User, CheckCircle2, Clock, IndianRupee, Sparkles, Zap, Lock, CalendarDays, Search, Filter, BookOpen } from 'lucide-react';

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
    durationMonths?: number;
    fullFeeQrUrl?: string;
    monthlyFeeQrUrl?: string;
}

interface EnrollmentInfo {
    status: string;
    paymentType?: 'FULL' | 'MONTHLY';
    paidMonths?: number[];
}

const FALLBACK_QR = 'https://res.cloudinary.com/dq6c78y00/image/upload/v1772553375/Shyam_payment_qr_code_bpmbfc.jpg';

import { toast } from 'react-hot-toast';

export default function StudentDashboard() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [courses, setCourses] = useState<Course[]>([]);
    const [enrollments, setEnrollments] = useState<Record<string, EnrollmentInfo>>({});
    // Track pending paymentRequests separately (for enrolled students paying new months)
    const [pendingMonthRequests, setPendingMonthRequests] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [upiId, setUpiId] = useState('');
    const [txnId, setTxnId] = useState('');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Payment type selection
    const [paymentType, setPaymentType] = useState<'FULL' | 'MONTHLY'>('FULL');
    const [selectedMonth, setSelectedMonth] = useState<number>(1);

    // Whether this is a "new month" payment for an already-enrolled student
    const [isMonthUpgrade, setIsMonthUpgrade] = useState(false);

    // Search, Filter, and Sort State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTrainer, setSelectedTrainer] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | ''>('');

    const openPaymentModal = (course: Course, preselectedMonth?: number, isUpgrade = false) => {
        setSelectedCourse(course);
        setIsMonthUpgrade(isUpgrade);
        if (preselectedMonth !== undefined) {
            setPaymentType('MONTHLY');
            setSelectedMonth(preselectedMonth);
        } else {
            setPaymentType('FULL');
            setSelectedMonth(1);
        }
        setUpiId(''); setTxnId(''); setScreenshot(null);
        setIsDialogOpen(true);
    };

    const fetchData = async () => {
        if (!currentUser) return;
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

            // Fetch enrollments
            const enrollQ = query(collection(db, 'enrollments'), where("studentId", "==", currentUser.uid));
            const enrollSnap = await getDocs(enrollQ);
            const enrollMap: Record<string, EnrollmentInfo> = {};
            enrollSnap.docs.forEach(d => {
                const data = d.data();
                // Keep ENROLLED status over PENDING if both exist for same course
                const existing = enrollMap[data.courseId];
                if (!existing || existing.status !== 'ENROLLED') {
                    enrollMap[data.courseId] = {
                        status: data.status,
                        paymentType: data.paymentType,
                        paidMonths: data.paidMonths || [],
                    };
                }
            });
            setEnrollments(enrollMap);

            // Fetch pending paymentRequests (additional month payments)
            const prQ = query(collection(db, 'paymentRequests'),
                where("studentId", "==", currentUser.uid), where("status", "==", "PENDING"));
            const prSnap = await getDocs(prQ);
            const monthReqMap: Record<string, number> = {};
            prSnap.docs.forEach(d => {
                const data = d.data();
                monthReqMap[data.courseId] = data.monthNumber;
            });
            setPendingMonthRequests(monthReqMap);

            setCourses(courseList);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [currentUser]);

    const uploadToCloudinary = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        return data.secure_url;
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!screenshot || !currentUser || !selectedCourse) return;
        setIsSubmitting(true);
        try {
            const screenshotUrl = await uploadToCloudinary(screenshot);
            const paymentDetails = { txnId, upiId, screenshotUrl };

            if (isMonthUpgrade) {
                // Enrolled student paying for an additional month → paymentRequests collection
                await addDoc(collection(db, 'paymentRequests'), {
                    studentId: currentUser.uid,
                    courseId: selectedCourse.id,
                    monthNumber: selectedMonth,
                    status: 'PENDING',
                    paymentDetails,
                    requestedAt: serverTimestamp(),
                });
                setPendingMonthRequests(prev => ({ ...prev, [selectedCourse.id]: selectedMonth }));
                toast.success(`Month ${selectedMonth} payment submitted! Awaiting admin verification.`);
            } else {
                // New enrollment
                await addDoc(collection(db, 'enrollments'), {
                    studentId: currentUser.uid,
                    courseId: selectedCourse.id,
                    status: 'PENDING',
                    progress: 0,
                    completedModules: [],
                    paymentType,
                    monthNumber: paymentType === 'MONTHLY' ? selectedMonth : null,
                    paidMonths: [],
                    paymentDetails,
                    enrolledAt: serverTimestamp(),
                });
                setEnrollments(prev => ({
                    ...prev,
                    [selectedCourse.id]: { status: 'PENDING', paymentType, paidMonths: [] }
                }));
                toast.success("Payment submitted! Awaiting admin verification.");
            }

            setIsDialogOpen(false);
            setUpiId(''); setTxnId(''); setScreenshot(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to submit payment. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getNextUnpaidMonth = (courseId: string, durationMonths: number): number | null => {
        const info = enrollments[courseId];
        if (!info || info.status !== 'ENROLLED') return null;
        if (info.paymentType === 'FULL') return null;
        const paid = info.paidMonths || [];
        for (let m = 1; m <= durationMonths; m++) { if (!paid.includes(m)) return m; }
        return null;
    };

    const getActiveQrUrl = () => {
        if (!selectedCourse) return FALLBACK_QR;
        if (paymentType === 'FULL') return selectedCourse.fullFeeQrUrl || FALLBACK_QR;
        return selectedCourse.monthlyFeeQrUrl || FALLBACK_QR;
    };

    const getPaymentAmount = () => {
        if (!selectedCourse) return '';
        return paymentType === 'FULL' ? selectedCourse.fee : selectedCourse.startingAt;
    };

    if (loading) return (
        <div className="flex h-screen flex-col gap-4 items-center justify-center bg-base-200">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold tracking-[0.2em] text-base-content/50 uppercase">Syncing Dashboard</p>
        </div>
    );

    const trainersList = Array.from(new Map(courses.filter(c => c.trainerId).map(c => [c.trainerId, c.trainerName || 'Instructor'])).entries()).map(([id, name]) => ({ id, name }));

    const filteredCourses = courses.filter(c => {
        const titleMatch = c.title?.toLowerCase().includes(searchQuery.toLowerCase());
        const descMatch = c.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const trainerMatch = selectedTrainer ? c.trainerId === selectedTrainer : true;
        return (titleMatch || descMatch) && trainerMatch;
    }).sort((a, b) => {
        if (sortOrder === 'asc') return parseInt(a.startingAt || '0') - parseInt(b.startingAt || '0');
        if (sortOrder === 'desc') return parseInt(b.startingAt || '0') - parseInt(a.startingAt || '0');
        return 0;
    });

    const enrolledCourses = filteredCourses.filter(c => enrollments[c.id]?.status === 'ENROLLED');
    const availableCourses = filteredCourses.filter(c => enrollments[c.id]?.status !== 'ENROLLED');

    const renderCourseCard = (course: Course) => {
        const info = enrollments[course.id];
        const status = info?.status;
        const isFullPayer = info?.paymentType === 'FULL' && status === 'ENROLLED';
        const durationMonths = course.durationMonths || 1;
        const nextUnpaid = status === 'ENROLLED' ? getNextUnpaidMonth(course.id, durationMonths) : null;
        const pendingMonth = pendingMonthRequests[course.id];

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
                                <div className="bg-base-200 text-base-content/60 rounded-full w-10 flex items-center justify-center">
                                    <User size={18} />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase tracking-widest text-base-content/40 leading-none mb-1">Mentor</span>
                                <span className="text-xs font-bold text-base-content leading-tight">{course.trainerName}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {durationMonths > 1 && <div className="badge badge-secondary badge-outline gap-1"><CalendarDays size={12} />{durationMonths}mo</div>}
                            <div className="badge badge-primary badge-outline gap-1"><Zap size={14} className="fill-primary" />{course.totalModules || 0} Units</div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {status === 'ENROLLED' ? (
                        <div className="space-y-2">
                            <button className="btn btn-primary w-full font-black text-xs tracking-widest" onClick={() => navigate(`/course/${course.id}`)}>
                                RESUME LEARNING
                            </button>
                            {isFullPayer ? (
                                <div className="flex items-center justify-center gap-2 text-success text-[10px] font-black uppercase tracking-widest pt-1">
                                    <CheckCircle2 size={12} /> Full Access Granted
                                </div>
                            ) : pendingMonth !== undefined ? (
                                <div className="flex items-center justify-center gap-2 text-warning text-[10px] font-black uppercase tracking-widest pt-1">
                                    <Clock size={12} className="animate-pulse" /> Month {pendingMonth} Verification Pending
                                </div>
                            ) : nextUnpaid !== null ? (
                                <button
                                    className="btn btn-outline btn-sm w-full font-black text-xs tracking-widest gap-2"
                                    onClick={() => openPaymentModal(course, nextUnpaid, true)}>
                                    <Lock size={12} /> PAY MONTH {nextUnpaid} — ₹{course.startingAt}
                                </button>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-success text-[10px] font-black uppercase tracking-widest pt-1">
                                    <CheckCircle2 size={12} /> All Months Unlocked
                                </div>
                            )}
                        </div>
                    ) : status === 'PENDING' ? (
                        <button className="btn btn-disabled w-full font-black text-xs tracking-widest" disabled>
                            <Clock size={14} className="animate-pulse" /> VERIFICATION PENDING
                        </button>
                    ) : (
                        <button className="btn btn-primary w-full font-black text-xs tracking-widest" onClick={() => openPaymentModal(course)}>
                            ENROLL NOW — FROM ₹{course.startingAt}
                        </button>
                    )}
                </div>
            </div>
        );
    };

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

                {/* Search & Filter Bar */}
                <div className="flex flex-col md:flex-row gap-4 bg-base-100 p-4 rounded-2xl shadow-sm border border-base-300">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search courses by title or description..."
                            className="input input-bordered w-full pl-12 bg-base-200 focus:outline-none focus:border-primary transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4 pointer-events-none" />
                            <select
                                className="select select-bordered pl-10 bg-base-200 hover:border-primary transition-colors appearance-none cursor-pointer"
                                value={selectedTrainer}
                                onChange={(e) => setSelectedTrainer(e.target.value)}
                            >
                                <option value="">All Trainers</option>
                                {trainersList.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <select
                            className="select select-bordered bg-base-200 hover:border-primary transition-colors cursor-pointer"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc' | '')}
                        >
                            <option value="">Sort by Amount</option>
                            <option value="asc">Low to High</option>
                            <option value="desc">High to Low</option>
                        </select>
                    </div>
                </div>

                {enrolledCourses.length > 0 && (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-black tracking-tight flex items-center gap-2 text-base-content">
                            <BookOpen className="w-7 h-7 text-primary" /> My Enrolled Courses
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {enrolledCourses.map(course => renderCourseCard(course))}
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    <h2 className="text-2xl font-black tracking-tight text-base-content">
                        {enrolledCourses.length > 0 ? 'Explore Other Courses' : 'Available Courses'}
                    </h2>
                    {availableCourses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {availableCourses.map(course => renderCourseCard(course))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-base-100 rounded-3xl border border-base-300 shadow-sm">
                            <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Filter className="w-8 h-8 text-base-content/30" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No courses found</h3>
                            <p className="text-base-content/50 font-medium">Try adjusting your search or filter criteria.</p>
                            {(searchQuery || selectedTrainer || sortOrder) && (
                                <button
                                    className="btn btn-outline btn-sm mt-6"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedTrainer('');
                                        setSortOrder('');
                                    }}
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            <dialog className={`modal ${isDialogOpen ? 'modal-open' : ''}`}>
                <div className="modal-box max-w-lg p-0">
                    <div className={`p-8 text-center border-b border-base-300 ${isMonthUpgrade ? 'bg-secondary/10' : 'bg-primary/10'}`}>
                        <h3 className="text-3xl font-black tracking-tighter uppercase italic">
                            {isMonthUpgrade ? `Unlock Month ${selectedMonth}` : 'Secure Enrollment'}
                        </h3>
                        <p className="text-base-content/60 font-medium mt-2">
                            {isMonthUpgrade
                                ? <>Adding <span className="font-bold text-base-content">Month {selectedMonth}</span> to your access</>
                                : <>Enrolling in <span className="font-bold text-base-content">{selectedCourse?.title}</span></>}
                        </p>
                    </div>

                    <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
                        <div className="alert alert-warning text-[10px] font-bold p-3 rounded-xl mb-4 text-left">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <span>Note: It may take up to 24 hours for enrollment verification by the admin after payment submission.</span>
                        </div>
                        {/* Payment type selection — only for new enrollments */}
                        {!isMonthUpgrade && (
                            <div className="form-control">
                                <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Payment Option</span></label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`cursor-pointer flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentType === 'FULL' ? 'border-primary bg-primary/10' : 'border-base-300 bg-base-200 hover:border-primary/50'}`}>
                                        <input type="radio" name="paymentType" className="hidden" checked={paymentType === 'FULL'} onChange={() => setPaymentType('FULL')} />
                                        <Sparkles size={20} className={paymentType === 'FULL' ? 'text-primary' : 'text-base-content/40'} />
                                        <span className="text-xs font-black uppercase tracking-wider">Full Fee</span>
                                        <span className="text-lg font-black text-primary">₹{selectedCourse?.fee}</span>
                                        <span className="text-[10px] text-base-content/50 font-medium">All months unlocked</span>
                                    </label>
                                    <label className={`cursor-pointer flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentType === 'MONTHLY' ? 'border-secondary bg-secondary/10' : 'border-base-300 bg-base-200 hover:border-secondary/50'}`}>
                                        <input type="radio" name="paymentType" className="hidden" checked={paymentType === 'MONTHLY'} onChange={() => setPaymentType('MONTHLY')} />
                                        <CalendarDays size={20} className={paymentType === 'MONTHLY' ? 'text-secondary' : 'text-base-content/40'} />
                                        <span className="text-xs font-black uppercase tracking-wider">Monthly</span>
                                        <span className="text-lg font-black text-secondary">₹{selectedCourse?.startingAt}/mo</span>
                                        <span className="text-[10px] text-base-content/50 font-medium">Pay as you go</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* First-time MONTHLY enrollment always starts at Month 1 */}
                        {!isMonthUpgrade && paymentType === 'MONTHLY' && (
                            <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-2xl border border-secondary/30">
                                <CalendarDays size={20} className="text-secondary flex-shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Starting with</p>
                                    <p className="text-base font-black">Month 1 — ₹{selectedCourse?.startingAt}</p>
                                    <p className="text-[10px] text-base-content/40 mt-0.5">Unlock further months after completing each one</p>
                                </div>
                            </div>
                        )}

                        {/* For month upgrades, show read-only month info */}
                        {isMonthUpgrade && (
                            <div className="flex items-center gap-3 p-4 bg-secondary/10 rounded-2xl border border-secondary/30">
                                <CalendarDays size={20} className="text-secondary flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-secondary">Paying for</p>
                                    <p className="text-lg font-black">Month {selectedMonth} — ₹{selectedCourse?.startingAt}</p>
                                </div>
                            </div>
                        )}

                        {/* QR Code — dynamic based on payment type */}
                        <div className="p-5 bg-base-200 rounded-2xl flex flex-col items-center gap-3 text-center">
                            <div className="bg-base-100 p-3 rounded-2xl shadow-sm">
                                <img
                                    key={`${paymentType}-${isMonthUpgrade}`}
                                    src={getActiveQrUrl()}
                                    alt="Payment QR"
                                    className="w-40 h-40 object-contain rounded-xl"
                                />
                            </div>
                            <p className="text-[10px] text-base-content/50 font-bold uppercase tracking-widest">
                                Scan & pay: <span className={`text-sm font-black ${isMonthUpgrade || paymentType === 'MONTHLY' ? 'text-secondary' : 'text-primary'}`}>
                                    ₹{getPaymentAmount()}
                                </span>
                                {(isMonthUpgrade || paymentType === 'MONTHLY') && (
                                    <span className="text-base-content/30"> (Month {selectedMonth})</span>
                                )}
                            </p>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text text-[9px] font-black uppercase tracking-widest">Your UPI Handle</span></label>
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

                        <button type="submit"
                            className={`btn w-full h-14 font-black tracking-widest text-sm ${isMonthUpgrade || paymentType === 'MONTHLY' ? 'btn-secondary' : 'btn-primary'}`}
                            disabled={isSubmitting}>
                            {isSubmitting ? "SUBMITTING..." : isMonthUpgrade
                                ? `CONFIRM MONTH ${selectedMonth} PAYMENT`
                                : paymentType === 'FULL' ? 'CONFIRM FULL PAYMENT' : `CONFIRM MONTH ${selectedMonth} PAYMENT`}
                        </button>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop" onClick={() => setIsDialogOpen(false)}><button>close</button></form>
            </dialog>
        </div>
    );
}