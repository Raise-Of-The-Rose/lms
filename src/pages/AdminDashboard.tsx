import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, getDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, PlusCircle, Users, BookOpen, CreditCard, CheckCircle2, XCircle, ExternalLink, Sparkles, IndianRupee, Loader2, Calendar, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Enrollment {
    id: string;
    studentId: string;
    courseId: string;
    status: string;
    progress: number;
    paymentType?: 'FULL' | 'MONTHLY';
    monthNumber?: number;
    paidMonths?: number[];
    paymentDetails: { txnId: string; upiId: string; screenshotUrl: string; };
    enrolledAt?: any;
}
interface PaymentRequest {
    id: string;
    studentId: string;
    courseId: string;
    monthNumber: number;
    status: string;
    paymentDetails: { txnId: string; upiId: string; screenshotUrl: string; };
}
interface UserProfile { uid: string; displayName: string; email?: string; role: 'STUDENT' | 'TRAINER' | 'ADMIN'; mobile?: string; }
interface Course { id: string; title: string; trainerId: string; fee: string; startingAt: string; durationMonths?: number; }

export default function AdminDashboard() {
    const [pendingEnrollments, setPendingEnrollments] = useState<Enrollment[]>([]);
    const [pendingPaymentRequests, setPendingPaymentRequests] = useState<PaymentRequest[]>([]);
    const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'payments' | 'courses' | 'users'>('payments');

    // Course creation form
    const [courseTitle, setCourseTitle] = useState('');
    const [courseDesc, setCourseDesc] = useState('');
    const [courseFee, setCourseFee] = useState('');
    const [startingAt, setStartingAt] = useState('');
    const [durationMonths, setDurationMonths] = useState('3');
    const [fullFeeQrUrl, setFullFeeQrUrl] = useState('');
    const [monthlyFeeQrUrl, setMonthlyFeeQrUrl] = useState('');
    const [selectedTrainer, setSelectedTrainer] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const enrollSnap = await getDocs(collection(db, 'enrollments'));
            const allEnrolls = enrollSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Enrollment[];
            setAllEnrollments(allEnrolls);
            setPendingEnrollments(allEnrolls.filter(e => e.status === 'PENDING'));

            const prSnap = await getDocs(collection(db, 'paymentRequests'));
            const prDocs = prSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PaymentRequest[];
            setPendingPaymentRequests(prDocs.filter(pr => pr.status === 'PENDING'));

            const userSnap = await getDocs(collection(db, 'users'));
            setAllUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            const courseSnap = await getDocs(collection(db, 'courses'));
            setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Course[]);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { loadInitialData(); }, []);

    const handleRoleUpdate = async (uid: string, newRole: string) => {
        try { 
            await updateDoc(doc(db, 'users', uid), { role: newRole }); 
            toast.success("Role updated!"); 
            loadInitialData(); 
        }
        catch (e) { 
            console.error(e); 
            toast.error("Failed to update role"); 
        }
    };
    const filteredUsers = allUsers.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const trainers = filteredUsers.filter(u => u.role === 'TRAINER');
    const studentsList = filteredUsers.filter(u => u.role === 'STUDENT');
    const getStudentName = (id: string) => allUsers.find(u => u.uid === id)?.displayName || 'Unknown';
    const getCourseName = (id: string) => courses.find(c => c.id === id)?.title || 'Unknown';

    const uploadToCloudinary = async (file: File) => {
        const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        return (await r.json()).secure_url;
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageFile || !selectedTrainer) { toast.error("Select image and trainer."); return; }
        const months = parseInt(durationMonths);
        if (isNaN(months) || months < 1) { toast.error("Enter a valid course duration (months)."); return; }
        setIsCreating(true);
        try {
            const imageUrl = await uploadToCloudinary(imageFile);
            await addDoc(collection(db, 'courses'), {
                title: courseTitle, description: courseDesc, fee: courseFee,
                startingAt, courseImage: imageUrl, trainerId: selectedTrainer,
                totalModules: 0, durationMonths: months,
                fullFeeQrUrl: fullFeeQrUrl.trim() || '',
                monthlyFeeQrUrl: monthlyFeeQrUrl.trim() || '',
                createdAt: serverTimestamp()
            });
            toast.success("Course created!");
            setCourseTitle(''); setCourseDesc(''); setCourseFee(''); setStartingAt('');
            setDurationMonths('3'); setSelectedTrainer(''); setImageFile(null);
            setFullFeeQrUrl(''); setMonthlyFeeQrUrl('');
            loadInitialData();
        } catch (e) { 
            console.error(e);
            toast.error("Failed to create course");
        } finally { setIsCreating(false); }
    };

    // Approve initial enrollment (PENDING → ENROLLED)
    const handleEnrollmentApproval = async (enrollment: Enrollment, approved: boolean) => {
        if (!approved) {
            await updateDoc(doc(db, 'enrollments', enrollment.id), { status: 'REJECTED', auditTrail: `Rejected ${new Date().toISOString()}` });
            toast.success('Enrollment REJECTED!'); loadInitialData(); return;
        }
        const courseDoc = await getDoc(doc(db, 'courses', enrollment.courseId));
        const totalMonths = courseDoc.data()?.durationMonths || 1;
        let newPaidMonths: number[] = [];
        if (enrollment.paymentType === 'FULL') {
            newPaidMonths = Array.from({ length: totalMonths }, (_, i) => i + 1);
        } else {
            newPaidMonths = enrollment.monthNumber ? [enrollment.monthNumber] : [1];
        }
        await updateDoc(doc(db, 'enrollments', enrollment.id), {
            status: 'ENROLLED', paidMonths: newPaidMonths,
            auditTrail: `Approved by Admin on ${new Date().toISOString()}`
        });
        toast.success(`Enrollment APPROVED! Months unlocked: ${newPaidMonths.join(', ')}`);
        loadInitialData();
    };

    // Approve monthly payment request → add month to existing enrollment
    const handlePaymentRequestApproval = async (pr: PaymentRequest, approved: boolean) => {
        if (!approved) {
            await updateDoc(doc(db, 'paymentRequests', pr.id), { status: 'REJECTED', auditTrail: `Rejected ${new Date().toISOString()}` });
            toast.success('Payment request REJECTED!'); loadInitialData(); return;
        }
        // Find main enrollment doc for this student + course
        const eSnap = await getDocs(query(collection(db, 'enrollments'),
            where('studentId', '==', pr.studentId), where('courseId', '==', pr.courseId), where('status', '==', 'ENROLLED')));
        if (eSnap.empty) { toast.error("No active enrollment found for this student/course."); return; }
        const enrollDoc = eSnap.docs[0];
        const existingPaid: number[] = enrollDoc.data().paidMonths || [];
        const monthSet = new Set(existingPaid);
        monthSet.add(pr.monthNumber);
        const updatedPaid = Array.from(monthSet).sort((a, b) => a - b);
        await updateDoc(doc(db, 'enrollments', enrollDoc.id), { paidMonths: updatedPaid });
        await updateDoc(doc(db, 'paymentRequests', pr.id), { status: 'APPROVED', auditTrail: `Approved by Admin on ${new Date().toISOString()}` });
        toast.success(`Month ${pr.monthNumber} APPROVED! Total months now: ${updatedPaid.join(', ')}`);
        loadInitialData();
    };

    const getPaymentLabel = (paymentType?: string, monthNumber?: number) => {
        if (paymentType === 'FULL') return <span className="badge badge-success badge-sm font-bold">Full Fee</span>;
        if (paymentType === 'MONTHLY') return <span className="badge badge-info badge-sm font-bold">Month {monthNumber}</span>;
        return <span className="badge badge-ghost badge-sm">Legacy</span>;
    };

    const totalPending = pendingEnrollments.length + pendingPaymentRequests.length;

    // Monthly Payers List Computation
    const monthlyPayersList = allEnrollments.map(en => {
        if (en.paymentType !== 'MONTHLY' || en.status !== 'ENROLLED') return null;
        const course = courses.find(c => c.id === en.courseId);
        if (!course) return null;
        const user = allUsers.find(u => u.uid === en.studentId);
        if (!user) return null;

        const paid = en.paidMonths || [];
        let nextMonth = 1;
        const duration = course.durationMonths || 1;
        for (let i = 1; i <= duration; i++) {
            if (!paid.includes(i)) {
                nextMonth = i;
                break;
            }
            if (i === duration) nextMonth = -1; // Fully paid
        }

        if (nextMonth === -1) return null; // Skip fully paid

        const enrolledAtDate = en.enrolledAt?.toDate() || new Date(); // fallback to today if undefined

        const dueDate = new Date(enrolledAtDate);
        dueDate.setMonth(dueDate.getMonth() + (nextMonth - 1));

        const lastPaidDate = new Date(enrolledAtDate);
        if (nextMonth > 1) {
            lastPaidDate.setMonth(lastPaidDate.getMonth() + (nextMonth - 2));
        }

        return {
            id: en.id,
            studentName: user.displayName,
            email: user.email || 'N/A',
            mobile: user.mobile || 'N/A',
            courseName: course.title,
            nextMonth,
            lastPaidDate,
            dueDate,
        };
    }).filter(Boolean)
        .sort((a, b) => a!.dueDate.getTime() - b!.dueDate.getTime());

    return (
        <div className="min-h-screen bg-base-200 pb-12 font-sans">
            <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-100 p-6 rounded-2xl shadow-lg">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-primary flex items-center gap-3"><Sparkles className="w-8 h-8" /> Admin Space</h1>
                        <p className="text-base-content/60 mt-2 font-medium">Manage enrollments, courses, and users.</p>
                    </div>
                    <div className="flex gap-3">
                        <span className="badge badge-primary badge-outline gap-2 px-4 py-3 text-sm font-bold"><Users className="w-4 h-4" /> {allUsers.length} Users</span>
                        <span className="badge badge-primary badge-outline gap-2 px-4 py-3 text-sm font-bold"><BookOpen className="w-4 h-4" /> {courses.length} Courses</span>
                    </div>
                </div>

                <div role="tablist" className="tabs tabs-boxed bg-base-100 p-1.5 rounded-2xl shadow w-fit">
                    <button role="tab" className={`tab font-semibold ${activeTab === 'payments' ? 'tab-active' : ''}`} onClick={() => setActiveTab('payments')}>
                        Payments <span className="badge badge-sm ml-1">{totalPending}</span>
                    </button>
                    <button role="tab" className={`tab font-semibold ${activeTab === 'courses' ? 'tab-active' : ''}`} onClick={() => setActiveTab('courses')}>Courses</button>
                    <button role="tab" className={`tab font-semibold ${activeTab === 'users' ? 'tab-active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
                </div>

                {activeTab === 'payments' && (
                    <div className="space-y-6">
                        {/* Initial Enrollments (PENDING) */}
                        <div className="card bg-base-100 shadow-xl"><div className="card-body p-0">
                            <div className="p-6 border-b border-base-300 flex items-center gap-3 text-primary">
                                <div className="p-2 bg-primary/20 rounded-lg"><CreditCard className="w-6 h-6" /></div>
                                <div>
                                    <h2 className="card-title text-xl font-black">New Enrollments</h2>
                                    <p className="text-base-content/60 text-sm">Verify initial enrollment payments</p>
                                </div>
                            </div>
                            <div className="p-6">
                                {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                                    : pendingEnrollments.length === 0
                                        ? <div className="text-center py-8 text-base-content/40 bg-base-200 rounded-2xl border-2 border-dashed border-base-300">No pending enrollments.</div>
                                        : <div className="overflow-x-auto"><table className="table"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                            <th>Student</th><th>Course</th><th>Type</th><th>UTR</th><th>UPI</th><th>Proof</th><th className="text-right">Actions</th>
                                        </tr></thead>
                                            <tbody>{pendingEnrollments.map(en => (
                                                <tr key={en.id} className="hover">
                                                    <td className="font-bold">{getStudentName(en.studentId)}</td>
                                                    <td><span className="badge badge-primary badge-outline">{getCourseName(en.courseId)}</span></td>
                                                    <td>{getPaymentLabel(en.paymentType, en.monthNumber)}</td>
                                                    <td><code className="bg-base-200 text-xs px-2 py-1 rounded">{en.paymentDetails?.txnId}</code></td>
                                                    <td><span className="text-xs text-base-content/60">{en.paymentDetails?.upiId}</span></td>
                                                    <td><a href={en.paymentDetails?.screenshotUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-ghost text-primary gap-1">View <ExternalLink className="w-3 h-3" /></a></td>
                                                    <td className="text-right space-x-2">
                                                        <button className="btn btn-sm btn-success" onClick={() => handleEnrollmentApproval(en, true)}><CheckCircle2 className="w-4 h-4" /> Approve</button>
                                                        <button className="btn btn-sm btn-error" onClick={() => handleEnrollmentApproval(en, false)}><XCircle className="w-4 h-4" /> Reject</button>
                                                    </td>
                                                </tr>
                                            ))}</tbody></table></div>}
                            </div>
                        </div></div>

                        {/* Monthly Payment Requests */}
                        <div className="card bg-base-100 shadow-xl"><div className="card-body p-0">
                            <div className="p-6 border-b border-base-300 flex items-center gap-3 text-secondary">
                                <div className="p-2 bg-secondary/20 rounded-lg"><Calendar className="w-6 h-6" /></div>
                                <div>
                                    <h2 className="card-title text-xl font-black">Monthly Payment Requests</h2>
                                    <p className="text-base-content/60 text-sm">Unlock additional months for enrolled students</p>
                                </div>
                            </div>
                            <div className="p-6">
                                {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-secondary" /></div>
                                    : pendingPaymentRequests.length === 0
                                        ? <div className="text-center py-8 text-base-content/40 bg-base-200 rounded-2xl border-2 border-dashed border-base-300">No pending month requests.</div>
                                        : <div className="overflow-x-auto"><table className="table"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                            <th>Student</th><th>Course</th><th>Month</th><th>UTR</th><th>UPI</th><th>Proof</th><th className="text-right">Actions</th>
                                        </tr></thead>
                                            <tbody>{pendingPaymentRequests.map(pr => (
                                                <tr key={pr.id} className="hover">
                                                    <td className="font-bold">{getStudentName(pr.studentId)}</td>
                                                    <td><span className="badge badge-secondary badge-outline">{getCourseName(pr.courseId)}</span></td>
                                                    <td><span className="badge badge-info badge-sm font-bold">Month {pr.monthNumber}</span></td>
                                                    <td><code className="bg-base-200 text-xs px-2 py-1 rounded">{pr.paymentDetails?.txnId}</code></td>
                                                    <td><span className="text-xs text-base-content/60">{pr.paymentDetails?.upiId}</span></td>
                                                    <td><a href={pr.paymentDetails?.screenshotUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-ghost text-secondary gap-1">View <ExternalLink className="w-3 h-3" /></a></td>
                                                    <td className="text-right space-x-2">
                                                        <button className="btn btn-sm btn-success" onClick={() => handlePaymentRequestApproval(pr, true)}><CheckCircle2 className="w-4 h-4" /> Approve</button>
                                                        <button className="btn btn-sm btn-error" onClick={() => handlePaymentRequestApproval(pr, false)}><XCircle className="w-4 h-4" /> Reject</button>
                                                    </td>
                                                </tr>
                                            ))}</tbody></table></div>}
                            </div>
                        </div></div>

                        {/* Monthly Payers List (Active Subscriptions) */}
                        <div className="card bg-base-100 shadow-xl"><div className="card-body p-0">
                            <div className="p-6 border-b border-base-300 flex items-center gap-3 text-accent">
                                <div className="p-2 bg-accent/20 rounded-lg"><Users className="w-6 h-6" /></div>
                                <div>
                                    <h2 className="card-title text-xl font-black">Monthly Payers List</h2>
                                    <p className="text-base-content/60 text-sm">Students actively paying on a monthly basis</p>
                                </div>
                            </div>
                            <div className="p-6">
                                {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-accent" /></div>
                                    : monthlyPayersList.length === 0
                                        ? <div className="text-center py-8 text-base-content/40 bg-base-200 rounded-2xl border-2 border-dashed border-base-300">No active monthly payers.</div>
                                        : <div className="overflow-x-auto"><table className="table"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                            <th>Student Details</th><th>Course</th><th>Contact</th><th>Last Paid</th><th>Due Date (Month)</th>
                                        </tr></thead>
                                            <tbody>{monthlyPayersList.map(payer => (
                                                <tr key={payer!.id} className="hover">
                                                    <td>
                                                        <div className="font-bold">{payer!.studentName}</div>
                                                        <div className="text-xs text-base-content/60">{payer!.email}</div>
                                                    </td>
                                                    <td><span className="badge badge-accent badge-outline">{payer!.courseName}</span></td>
                                                    <td><span className="text-sm font-semibold tracking-wider">{payer!.mobile}</span></td>
                                                    <td>
                                                        <span className="text-xs font-medium">
                                                            {payer!.nextMonth > 1 ? payer!.lastPaidDate.toLocaleDateString() : 'N/A (First Month)'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`font-bold ${payer!.dueDate < new Date() ? 'text-error' : 'text-success'}`}>
                                                                {payer!.dueDate.toLocaleDateString()}
                                                            </span>
                                                            <span className="badge badge-info badge-sm font-bold">Month {payer!.nextMonth}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}</tbody></table></div>}
                            </div>
                        </div></div>
                    </div>
                )}

                {activeTab === 'courses' && (
                    <div className="card bg-base-100 shadow-2xl max-w-3xl"><div className="card-body">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/20 rounded-xl"><PlusCircle className="w-7 h-7 text-primary" /></div>
                            <div><h2 className="card-title text-3xl font-black">Create Course</h2><p className="text-base-content/60">Launch a new learning path</p></div>
                        </div>
                        <form onSubmit={handleCreateCourse} className="space-y-6">
                            <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Title</span></label><input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Master React" className="input input-bordered w-full" required /></div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest"><IndianRupee className="w-3 h-3 inline" /> Full Fee (₹)</span></label><input type="number" value={courseFee} onChange={e => setCourseFee(e.target.value)} placeholder="4999" className="input input-bordered" required /></div>
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest"><IndianRupee className="w-3 h-3 inline" /> Monthly Fee (₹)</span></label><input value={startingAt} onChange={e => setStartingAt(e.target.value)} placeholder="599" className="input input-bordered" required /></div>
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest"><Calendar className="w-3 h-3 inline" /> Duration (Months)</span></label><input type="number" min="1" max="24" value={durationMonths} onChange={e => setDurationMonths(e.target.value)} placeholder="3" className="input input-bordered" required /></div>
                            </div>

                            {/* QR Code URLs */}
                            <div className="bg-secondary/5 p-5 rounded-2xl space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <QrCode className="w-4 h-4 text-secondary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Payment QR Code URLs</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="form-control">
                                        <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Full Fee QR Image URL</span></label>
                                        <input value={fullFeeQrUrl} onChange={e => setFullFeeQrUrl(e.target.value)} placeholder="https://..." className="input input-bordered" />
                                    </div>
                                    <div className="form-control">
                                        <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Monthly Fee QR Image URL</span></label>
                                        <input value={monthlyFeeQrUrl} onChange={e => setMonthlyFeeQrUrl(e.target.value)} placeholder="https://..." className="input input-bordered" />
                                    </div>
                                </div>
                                <p className="text-[10px] text-base-content/40 font-medium">Paste image URLs for each payment type. Students will see the matching QR during checkout.</p>
                            </div>

                            <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Description</span></label><textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="What will students learn?" className="textarea textarea-bordered min-h-[120px]" required /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-primary/5 p-6 rounded-2xl">
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Cover Image</span></label><input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="file-input file-input-bordered w-full" required /></div>
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Assign Trainer</span></label>
                                    <select className="select select-bordered w-full" value={selectedTrainer} onChange={e => setSelectedTrainer(e.target.value)} required><option value="" disabled>Choose trainer</option>{allUsers.filter(u => u.role === 'TRAINER').map(t => <option key={t.uid} value={t.uid}>{t.displayName}</option>)}</select>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary w-full h-14 font-black uppercase tracking-widest" disabled={isCreating}>{isCreating ? 'UPLOADING...' : 'PUBLISH COURSE'}</button>
                        </form>
                    </div></div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-8">
                        <div className="relative max-w-md"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-base-content/30" /><input placeholder="Search..." className="input input-bordered w-full pl-12 h-14" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <div className="card bg-base-100 shadow-xl"><div className="card-body p-0">
                            <div className="flex items-center justify-between p-6 border-b border-base-300"><div className="flex items-center gap-3"><div className="p-2 bg-primary/20 text-primary rounded-lg"><Users className="w-5 h-5" /></div><h2 className="card-title text-xl font-black">Trainers ({trainers.length})</h2></div><span className="badge badge-primary">Faculty</span></div>
                            <div className="overflow-x-auto"><table className="table"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40"><th>Identity</th><th>Assigned</th><th className="text-right">Role</th></tr></thead>
                                <tbody>{trainers.map(t => (
                                    <tr key={t.uid} className="hover"><td><div className="font-bold text-sm">{t.displayName}</div><div className="text-[10px] text-base-content/50">{t.email}</div></td>
                                        <td><div className="flex flex-wrap gap-2">{courses.filter(c => c.trainerId === t.uid).map(c => <span key={c.id} className="badge badge-primary badge-outline">{c.title}</span>)}{courses.filter(c => c.trainerId === t.uid).length === 0 && <span className="text-base-content/40 text-[10px] italic">Unassigned</span>}</div></td>
                                        <td className="text-right"><select className="select select-sm select-bordered w-[130px] font-bold text-xs" defaultValue={t.role} onChange={e => handleRoleUpdate(t.uid, e.target.value)}><option value="STUDENT">Student</option><option value="TRAINER">Trainer</option><option value="ADMIN">Admin</option></select></td></tr>
                                ))}</tbody></table></div>
                        </div></div>
                        <div className="card bg-base-100 shadow-xl"><div className="card-body p-0">
                            <div className="flex items-center justify-between p-6 border-b border-base-300"><div className="flex items-center gap-3"><div className="p-2 bg-success/20 text-success rounded-lg"><Users className="w-5 h-5" /></div><h2 className="card-title text-xl font-black">Students ({studentsList.length})</h2></div><span className="badge badge-success">Learners</span></div>
                            <div className="overflow-x-auto"><table className="table"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40"><th>Identity</th><th>Progress</th><th className="text-right">Role</th></tr></thead>
                                <tbody>{studentsList.map(s => {
                                    const se = allEnrollments.filter(e => e.studentId === s.uid && e.status === 'ENROLLED');
                                    return (<tr key={s.uid} className="hover"><td><div className="font-bold text-sm">{s.displayName}</div><div className="text-[10px] text-base-content/50">{s.email}</div></td>
                                        <td><div className="space-y-3 min-w-[250px]">{se.map(e => (<div key={e.id} className="bg-base-200 p-3 rounded-xl space-y-1.5"><div className="flex justify-between text-[10px] uppercase font-bold"><span>{getCourseName(e.courseId)}</span><span className={`badge badge-sm ${e.progress === 100 ? 'badge-success' : 'badge-primary'}`}>{e.progress || 0}%</span></div><progress className="progress progress-primary w-full h-1.5" value={e.progress || 0} max="100"></progress></div>))}{se.length === 0 && <span className="text-base-content/40 text-[10px] italic">Not enrolled</span>}</div></td>
                                        <td className="text-right"><select className="select select-sm select-bordered w-[130px] font-bold text-xs" defaultValue={s.role} onChange={e => handleRoleUpdate(s.uid, e.target.value)}><option value="STUDENT">Student</option><option value="TRAINER">Trainer</option><option value="ADMIN">Admin</option></select></td></tr>);
                                })}</tbody></table></div>
                        </div></div>
                    </div>
                )}
            </div>
        </div>
    );
}