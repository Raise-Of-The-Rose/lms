import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Search, PlusCircle, Users, BookOpen, CreditCard, CheckCircle2, XCircle, ExternalLink, Sparkles } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

interface Enrollment {
    id: string;
    studentId: string;
    courseId: string;
    status: string;
    progress: number;
    paymentDetails: {
        txnId: string;
        upiId: string;
        screenshotUrl: string;
    };
}

interface UserProfile {
    uid: string;
    displayName: string;
    email?: string;
    role: 'STUDENT' | 'TRAINER' | 'ADMIN';
}

interface Course {
    id: string;
    title: string;
    trainerId: string;
}

export default function AdminDashboard() {
    const [pendingEnrollments, setPendingEnrollments] = useState<Enrollment[]>([]);
    const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [courseTitle, setCourseTitle] = useState('');
    const [courseDesc, setCourseDesc] = useState('');
    const [selectedTrainer, setSelectedTrainer] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const enrollSnap = await getDocs(collection(db, 'enrollments'));
            const allEnrolls = enrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Enrollment[];
            setAllEnrollments(allEnrolls);
            setPendingEnrollments(allEnrolls.filter(e => e.status === "PENDING"));

            const userSnap = await getDocs(collection(db, 'users'));
            const usersData = userSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
            setAllUsers(usersData);

            const courseSnap = await getDocs(collection(db, 'courses'));
            setCourses(courseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[]);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const handleRoleUpdate = async (uid: string, newRole: string) => {
        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, { role: newRole });
            alert("User role updated successfully!");
            loadInitialData();
        } catch (error) {
            console.error("Error updating role:", error);
            alert("Failed to update role.");
        }
    };

    const filteredUsers = allUsers.filter(u =>
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const trainers = filteredUsers.filter(u => u.role === 'TRAINER');
    const students = filteredUsers.filter(u => u.role === 'STUDENT');

    const getStudentName = (id: string) => allUsers.find(u => u.uid === id)?.displayName || "Unknown Student";
    const getCourseName = (id: string) => courses.find(c => c.id === id)?.title || "Unknown Course";

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
        if (!response.ok) throw new Error('Cloudinary upload failed');
        const data = await response.json();
        return data.secure_url;
    };

    const handleCreateCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageFile || !selectedTrainer) {
            alert("Please select a cover image and a trainer.");
            return;
        }
        setIsCreating(true);
        try {
            const imageUrl = await uploadToCloudinary(imageFile);
            await addDoc(collection(db, 'courses'), {
                title: courseTitle,
                description: courseDesc,
                courseImage: imageUrl,
                trainerId: selectedTrainer,
                totalModules: 0,
                createdAt: serverTimestamp(),
            });
            alert("Course created successfully!");
            setCourseTitle(''); setCourseDesc(''); setSelectedTrainer(''); setImageFile(null);
            loadInitialData();
        } catch (error) {
            console.error("Error creating course:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleApproval = async (enrollmentId: string, isApproved: boolean) => {
        try {
            const enrollmentRef = doc(db, 'enrollments', enrollmentId);
            const newStatus = isApproved ? 'ENROLLED' : 'REJECTED';
            await updateDoc(enrollmentRef, {
                status: newStatus,
                auditTrail: isApproved ? 'Approved by Admin' : `Rejected on ${new Date().toISOString()}`
            });
            alert(`Enrollment ${newStatus}!`);
            loadInitialData();
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 p-6 rounded-2xl shadow-sm border border-white backdrop-blur-sm">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center gap-3">
                            <Sparkles className="w-8 h-8 text-fuchsia-500" />
                            Admin Space
                        </h1>
                        <p className="text-slate-600 mt-2 font-medium">Manage enrollments, courses, and platform users effortlessly.</p>
                    </div>
                    <div className="flex gap-3">
                        <Badge variant="outline" className="px-4 py-2 bg-blue-100 shadow-sm border-blue-200 text-blue-700 text-sm font-bold rounded-xl">
                            <Users className="w-4 h-4 mr-2" /> {allUsers.length} Users
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2 bg-fuchsia-100 shadow-sm border-fuchsia-200 text-fuchsia-700 text-sm font-bold rounded-xl">
                            <BookOpen className="w-4 h-4 mr-2" /> {courses.length} Courses
                        </Badge>
                    </div>
                </div>

                <Tabs defaultValue="payments" className="w-full">
                    <TabsList className="grid grid-cols-3 w-full max-w-md mb-8 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-slate-100 h-auto">
                        <TabsTrigger value="payments" className="rounded-xl py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-400 data-[state=active]:to-rose-400 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-semibold">
                            Payments
                            <Badge className="ml-2 bg-white text-orange-600 hover:bg-white text-[10px] h-5 w-5 flex items-center justify-center p-0 rounded-full shadow-sm">
                                {pendingEnrollments.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="courses" className="rounded-xl py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-fuchsia-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-semibold">
                            Courses
                        </TabsTrigger>
                        <TabsTrigger value="users" className="rounded-xl py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-semibold">
                            Users
                        </TabsTrigger>
                    </TabsList>

                    {/* --- PAYMENTS TAB --- */}
                    <TabsContent value="payments" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="border-none shadow-xl bg-white/90 backdrop-blur-lg border-t-4 border-t-orange-500 rounded-2xl overflow-hidden">
                            <CardHeader className="bg-orange-50/50 border-b border-orange-100">
                                <div className="flex items-center gap-3 text-orange-600">
                                    <div className="p-2 bg-orange-100 rounded-lg"><CreditCard className="w-6 h-6" /></div>
                                    <CardTitle className="text-2xl">Pending UPI Verifications</CardTitle>
                                </div>
                                <CardDescription className="text-orange-700/70 font-medium ml-11">Review manual payment proofs from students</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {loading ? (
                                    <div className="flex justify-center p-8 text-orange-400 font-medium animate-pulse">Loading records...</div>
                                ) : pendingEnrollments.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">No pending payments to review.</div>
                                ) : (
                                    <div className="rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="font-bold text-slate-700">Student</TableHead>
                                                    <TableHead className="font-bold text-slate-700">Course</TableHead>
                                                    <TableHead className="font-bold text-slate-700">UTR / TXN ID</TableHead>
                                                    <TableHead className="font-bold text-slate-700">Proof</TableHead>
                                                    <TableHead className="text-right font-bold text-slate-700">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pendingEnrollments.map((enrollment) => (
                                                    <TableRow key={enrollment.id} className="hover:bg-orange-50/30 transition-colors">
                                                        <TableCell className="font-bold text-slate-800">{getStudentName(enrollment.studentId)}</TableCell>
                                                        <TableCell><Badge className="bg-indigo-100 text-indigo-700 border-none hover:bg-indigo-200">{getCourseName(enrollment.courseId)}</Badge></TableCell>
                                                        <TableCell className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block mt-2">{enrollment.paymentDetails.txnId}</TableCell>
                                                        <TableCell>
                                                            <a href={enrollment.paymentDetails.screenshotUrl} target="_blank" rel="noreferrer"
                                                                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                                                View Proof <ExternalLink className="w-4 h-4" />
                                                            </a>
                                                        </TableCell>
                                                        <TableCell className="text-right space-x-2">
                                                            <Button size="sm" className="bg-gradient-to-r from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-md shadow-emerald-200 border-none" onClick={() => handleApproval(enrollment.id, true)}>
                                                                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                                                            </Button>
                                                            <Button size="sm" className="bg-gradient-to-r from-rose-400 to-rose-600 hover:from-rose-500 hover:to-rose-700 text-white shadow-md shadow-rose-200 border-none" onClick={() => handleApproval(enrollment.id, false)}>
                                                                <XCircle className="w-4 h-4 mr-1.5" /> Reject
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- COURSES TAB --- */}
                    <TabsContent value="courses" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card className="max-w-3xl border-none shadow-2xl bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white p-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"><PlusCircle className="w-7 h-7 text-white" /></div>
                                    <CardTitle className="text-3xl font-black text-white">Create New Course</CardTitle>
                                </div>
                                <CardDescription className="text-violet-100 font-medium text-base mt-2 ml-12">Launch a beautiful new learning path on your platform</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form onSubmit={handleCreateCourse} className="space-y-6">
                                    <div className="space-y-3">
                                        <Label className="text-slate-800 font-bold text-base">Course Title</Label>
                                        <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. Master React & Tailwind" className="h-12 border-slate-200 bg-slate-50 focus-visible:ring-fuchsia-500 focus-visible:bg-white text-lg rounded-xl" required />
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-slate-800 font-bold text-base">Description</Label>
                                        <Textarea value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} placeholder="What magic will students learn?" className="min-h-[120px] border-slate-200 bg-slate-50 focus-visible:ring-fuchsia-500 focus-visible:bg-white rounded-xl text-base" required />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-violet-50/50 p-6 rounded-2xl border border-violet-100">
                                        <div className="space-y-3">
                                            <Label className="text-violet-900 font-bold">Cover Image</Label>
                                            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} required className="cursor-pointer file:bg-violet-600 file:text-white file:border-0 file:rounded-lg file:px-4 file:py-1 file:mr-4 hover:file:bg-violet-700 bg-white h-12 pt-2.5 rounded-xl border-violet-200 shadow-sm" />
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-violet-900 font-bold">Assign Trainer</Label>
                                            <Select onValueChange={setSelectedTrainer} value={selectedTrainer} required>
                                                <SelectTrigger className="focus:ring-fuchsia-500 h-12 bg-white border-violet-200 rounded-xl shadow-sm"><SelectValue placeholder="Choose a brilliant mind" /></SelectTrigger>
                                                <SelectContent className="rounded-xl border-violet-100">
                                                    {allUsers.filter(u => u.role === 'TRAINER').map(t => (
                                                        <SelectItem key={t.uid} value={t.uid} className="font-medium focus:bg-violet-50">{t.displayName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-black text-lg py-7 rounded-2xl transition-all shadow-xl shadow-fuchsia-200 border-none" disabled={isCreating}>
                                        {isCreating ? 'Uploading Magic...' : 'Publish Course'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- USERS OVERVIEW TAB --- */}
                    <TabsContent value="users" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        <div className="relative max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-cyan-500" />
                            </div>
                            <Input
                                placeholder="Search brilliant minds by name or email..."
                                className="pl-12 h-14 rounded-2xl bg-white border-none shadow-lg shadow-cyan-100/50 focus-visible:ring-cyan-400 text-base"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            {/* Trainers */}
                            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white/90 backdrop-blur-sm border-t-4 border-t-purple-500">
                                <CardHeader className="bg-purple-50/50 flex flex-row items-center justify-between space-y-0 pb-4 border-b border-purple-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-200 text-purple-700 rounded-lg"><Users className="w-5 h-5" /></div>
                                        <CardTitle className="text-xl font-black text-purple-900">Trainers ({trainers.length})</CardTitle>
                                    </div>
                                    <Badge className="bg-purple-600 text-white hover:bg-purple-700 border-none px-3 py-1 shadow-md">Faculty</Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-slate-50 border-b border-slate-100">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold text-slate-700 py-4 pl-6">Trainer Identity</TableHead>
                                                <TableHead className="font-bold text-slate-700 py-4">Assigned Paths</TableHead>
                                                <TableHead className="text-right font-bold text-slate-700 py-4 pr-6">Access Level</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {trainers.map((trainer, idx) => (
                                                <TableRow key={trainer.uid} className={idx % 2 === 0 ? "bg-white" : "bg-purple-50/30"}>
                                                    <TableCell className="pl-6">
                                                        <div className="font-bold text-slate-800 text-base">{trainer.displayName}</div>
                                                        <div className="text-xs text-purple-600 font-medium mt-1">{trainer.email}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-2">
                                                            {courses.filter(c => c.trainerId === trainer.uid).map(c => (
                                                                <Badge key={c.id} variant="secondary" className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200 shadow-sm">{c.title}</Badge>
                                                            ))}
                                                            {courses.filter(c => c.trainerId === trainer.uid).length === 0 && <span className="text-slate-400 text-xs italic font-medium bg-slate-100 px-2 py-1 rounded">Unassigned</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <Select onValueChange={(val) => handleRoleUpdate(trainer.uid, val)} defaultValue={trainer.role}>
                                                            <SelectTrigger className="w-[130px] ml-auto h-9 text-xs bg-white border-purple-200 font-bold text-purple-700 shadow-sm focus:ring-purple-500 rounded-lg">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl">
                                                                <SelectItem value="STUDENT" className="font-medium">Student</SelectItem>
                                                                <SelectItem value="TRAINER" className="font-medium text-purple-700">Trainer</SelectItem>
                                                                <SelectItem value="ADMIN" className="font-medium text-rose-600">Admin</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Students */}
                            <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white/90 backdrop-blur-sm border-t-4 border-t-cyan-500">
                                <CardHeader className="bg-cyan-50/50 flex flex-row items-center justify-between space-y-0 pb-4 border-b border-cyan-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-cyan-200 text-cyan-800 rounded-lg"><Users className="w-5 h-5" /></div>
                                        <CardTitle className="text-xl font-black text-cyan-950">Students ({students.length})</CardTitle>
                                    </div>
                                    <Badge className="bg-cyan-500 text-white hover:bg-cyan-600 border-none px-3 py-1 shadow-md">Learners</Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-slate-50 border-b border-slate-100">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="font-bold text-slate-700 py-4 pl-6">Student Identity</TableHead>
                                                <TableHead className="font-bold text-slate-700 py-4">Learning Progress</TableHead>
                                                <TableHead className="text-right font-bold text-slate-700 py-4 pr-6">Access Level</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {students.map((student, idx) => {
                                                const studentEnrolls = allEnrollments.filter(e => e.studentId === student.uid && e.status === 'ENROLLED');
                                                return (
                                                    <TableRow key={student.uid} className={idx % 2 === 0 ? "bg-white" : "bg-cyan-50/30"}>
                                                        <TableCell className="pl-6">
                                                            <div className="font-bold text-slate-800 text-base">{student.displayName}</div>
                                                            <div className="text-xs text-cyan-700 font-medium mt-1">{student.email}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-4 min-w-[250px] py-2">
                                                                {studentEnrolls.map(e => (
                                                                    <div key={e.id} className="space-y-1.5 bg-white p-2 rounded-xl border border-cyan-100 shadow-sm">
                                                                        <div className="flex justify-between text-xs text-slate-700 items-center">
                                                                            <span className="font-bold text-cyan-900">{getCourseName(e.courseId)}</span>
                                                                            <Badge className={e.progress === 100 ? "bg-emerald-100 text-emerald-700 border-none" : "bg-blue-50 text-blue-700 border-none"}>
                                                                                {e.progress || 0}%
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                                                            <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${e.progress || 0}%` }}></div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {studentEnrolls.length === 0 && <span className="text-slate-400 text-xs italic font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Not enrolled yet</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <Select onValueChange={(val) => handleRoleUpdate(student.uid, val)} defaultValue={student.role}>
                                                                <SelectTrigger className="w-[130px] ml-auto h-9 text-xs bg-white border-cyan-200 font-bold text-cyan-700 shadow-sm focus:ring-cyan-500 rounded-lg">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="STUDENT" className="font-medium text-cyan-700">Student</SelectItem>
                                                                    <SelectItem value="TRAINER" className="font-medium text-purple-700">Trainer</SelectItem>
                                                                    <SelectItem value="ADMIN" className="font-medium text-rose-600">Admin</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}