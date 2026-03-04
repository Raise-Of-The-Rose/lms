import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Search, PlusCircle, Users, BookOpen, CreditCard, CheckCircle2, XCircle, ExternalLink, Sparkles, IndianRupee, Loader2 } from 'lucide-react';

interface Enrollment { id: string; studentId: string; courseId: string; status: string; progress: number; paymentDetails: { txnId: string; upiId: string; screenshotUrl: string; }; }
interface UserProfile { uid: string; displayName: string; email?: string; role: 'STUDENT' | 'TRAINER' | 'ADMIN'; }
interface Course { id: string; title: string; trainerId: string; fee: string; startingAt: string; }

export default function AdminDashboard() {
    const [pendingEnrollments, setPendingEnrollments] = useState<Enrollment[]>([]);
    const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'payments' | 'courses' | 'users'>('payments');
    const [courseTitle, setCourseTitle] = useState('');
    const [courseDesc, setCourseDesc] = useState('');
    const [courseFee, setCourseFee] = useState('');
    const [startingAt, setStartingAt] = useState('');
    const [selectedTrainer, setSelectedTrainer] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const enrollSnap = await getDocs(collection(db, 'enrollments'));
            const allEnrolls = enrollSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Enrollment[];
            setAllEnrollments(allEnrolls);
            setPendingEnrollments(allEnrolls.filter(e => e.status === "PENDING"));
            const userSnap = await getDocs(collection(db, 'users'));
            setAllUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() })) as UserProfile[]);
            const courseSnap = await getDocs(collection(db, 'courses'));
            setCourses(courseSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Course[]);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    useEffect(() => { loadInitialData(); }, []);

    const handleRoleUpdate = async (uid: string, newRole: string) => {
        try { await updateDoc(doc(db, 'users', uid), { role: newRole }); alert("Role updated!"); loadInitialData(); }
        catch (e) { console.error(e); alert("Failed."); }
    };
    const filteredUsers = allUsers.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
    const trainers = filteredUsers.filter(u => u.role === 'TRAINER');
    const studentsList = filteredUsers.filter(u => u.role === 'STUDENT');
    const getStudentName = (id: string) => allUsers.find(u => u.uid === id)?.displayName || "Unknown";
    const getCourseName = (id: string) => courses.find(c => c.id === id)?.title || "Unknown";

    const uploadToCloudinary = async (file: File) => {
        const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
        return (await r.json()).secure_url;
    };
    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageFile || !selectedTrainer) { alert("Select image and trainer."); return; }
        setIsCreating(true);
        try {
            const imageUrl = await uploadToCloudinary(imageFile);
            await addDoc(collection(db, 'courses'), { title: courseTitle, description: courseDesc, fee: courseFee, startingAt, courseImage: imageUrl, trainerId: selectedTrainer, totalModules: 0, createdAt: serverTimestamp() });
            alert("Course created!"); setCourseTitle(''); setCourseDesc(''); setCourseFee(''); setStartingAt(''); setSelectedTrainer(''); setImageFile(null); loadInitialData();
        } catch (e) { console.error(e); } finally { setIsCreating(false); }
    };
    const handleApproval = async (id: string, approved: boolean) => {
        try {
            const s = approved ? 'ENROLLED' : 'REJECTED';
            await updateDoc(doc(db, 'enrollments', id), { status: s, auditTrail: approved ? 'Approved by Admin' : `Rejected ${new Date().toISOString()}` });
            alert(`Enrollment ${s}!`); loadInitialData();
        } catch (e) { console.error(e); }
    };

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
                    <button role="tab" className={`tab font-semibold ${activeTab === 'payments' ? 'tab-active' : ''}`} onClick={() => setActiveTab('payments')}>Payments <span className="badge badge-sm ml-1">{pendingEnrollments.length}</span></button>
                    <button role="tab" className={`tab font-semibold ${activeTab === 'courses' ? 'tab-active' : ''}`} onClick={() => setActiveTab('courses')}>Courses</button>
                    <button role="tab" className={`tab font-semibold ${activeTab === 'users' ? 'tab-active' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
                </div>

                {activeTab === 'payments' && (
                    <div className="card bg-base-100 shadow-xl"><div className="card-body p-0">
                        <div className="p-6 border-b border-base-300 flex items-center gap-3 text-primary">
                            <div className="p-2 bg-primary/20 rounded-lg"><CreditCard className="w-6 h-6" /></div>
                            <div><h2 className="card-title text-2xl font-black">Pending UPI Verifications</h2><p className="text-base-content/60 text-sm">Review payment proofs</p></div>
                        </div>
                        <div className="p-6">
                            {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                                : pendingEnrollments.length === 0 ? <div className="text-center py-12 text-base-content/40 bg-base-200 rounded-2xl border-2 border-dashed border-base-300">No pending payments.</div>
                                    : <div className="overflow-x-auto"><table className="table"><thead><tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40"><th>Student</th><th>Course</th><th>UTR</th><th>Proof</th><th className="text-right">Actions</th></tr></thead>
                                        <tbody>{pendingEnrollments.map(en => (
                                            <tr key={en.id} className="hover">
                                                <td className="font-bold">{getStudentName(en.studentId)}</td>
                                                <td><span className="badge badge-primary badge-outline">{getCourseName(en.courseId)}</span></td>
                                                <td><code className="bg-base-200 text-xs px-2 py-1 rounded">{en.paymentDetails.txnId}</code></td>
                                                <td><a href={en.paymentDetails.screenshotUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-ghost text-primary gap-1">View <ExternalLink className="w-3 h-3" /></a></td>
                                                <td className="text-right space-x-2">
                                                    <button className="btn btn-sm btn-success" onClick={() => handleApproval(en.id, true)}><CheckCircle2 className="w-4 h-4" /> Approve</button>
                                                    <button className="btn btn-sm btn-error" onClick={() => handleApproval(en.id, false)}><XCircle className="w-4 h-4" /> Reject</button>
                                                </td>
                                            </tr>
                                        ))}</tbody></table></div>}
                        </div>
                    </div></div>)}

                {activeTab === 'courses' && (
                    <div className="card bg-base-100 shadow-2xl max-w-3xl"><div className="card-body">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/20 rounded-xl"><PlusCircle className="w-7 h-7 text-primary" /></div>
                            <div><h2 className="card-title text-3xl font-black">Create Course</h2><p className="text-base-content/60">Launch a new learning path</p></div>
                        </div>
                        <form onSubmit={handleCreateCourse} className="space-y-6">
                            <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Title</span></label><input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Master React" className="input input-bordered w-full" required /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest"><IndianRupee className="w-3 h-3 inline" /> Fee (₹)</span></label><input type="number" value={courseFee} onChange={e => setCourseFee(e.target.value)} placeholder="4999" className="input input-bordered" required /></div>
                                <div className="form-control"><label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest"><IndianRupee className="w-3 h-3 inline" /> Starting At</span></label><input value={startingAt} onChange={e => setStartingAt(e.target.value)} placeholder="599" className="input input-bordered" required /></div>
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
                    </div></div>)}

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
                    </div>)}
            </div>
        </div>
    );
}