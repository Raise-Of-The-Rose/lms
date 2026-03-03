import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Search, UserCog } from 'lucide-react';
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

    // New Course State
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
            loadInitialData(); // Refresh data
        } catch (error) {
            console.error("Error updating role:", error);
            alert("Failed to update role.");
        }
    };

    // Filter Logic
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
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8">Admin Control Panel</h1>

            <Tabs defaultValue="payments" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="payments">Payments ({pendingEnrollments.length})</TabsTrigger>
                    <TabsTrigger value="courses">Manage Courses</TabsTrigger>
                    <TabsTrigger value="users">Users Overview</TabsTrigger>
                </TabsList>

                {/* --- PAYMENTS TAB --- */}
                <TabsContent value="payments">
                    <Card>
                        <CardHeader><CardTitle>Pending UPI Payments</CardTitle></CardHeader>
                        <CardContent>
                            {loading ? <p>Loading...</p> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student</TableHead>
                                            <TableHead>Course</TableHead>
                                            <TableHead>UTR / TXN ID</TableHead>
                                            <TableHead>Proof</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingEnrollments.map((enrollment) => (
                                            <TableRow key={enrollment.id}>
                                                <TableCell>{getStudentName(enrollment.studentId)}</TableCell>
                                                <TableCell>{getCourseName(enrollment.courseId)}</TableCell>
                                                <TableCell>{enrollment.paymentDetails.txnId}</TableCell>
                                                <TableCell>
                                                    <a href={enrollment.paymentDetails.screenshotUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">View</a>
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproval(enrollment.id, true)}>Approve</Button>
                                                    <Button variant="destructive" size="sm" onClick={() => handleApproval(enrollment.id, false)}>Reject</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- COURSES TAB --- */}
                <TabsContent value="courses">
                    <Card className="max-w-2xl">
                        <CardHeader><CardTitle>Create New Course</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateCourse} className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Course Title</Label>
                                    <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea value={courseDesc} onChange={(e) => setCourseDesc(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Course Cover Image</Label>
                                    <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Assign Trainer</Label>
                                    <Select onValueChange={setSelectedTrainer} value={selectedTrainer} required>
                                        <SelectTrigger><SelectValue placeholder="Select a trainer" /></SelectTrigger>
                                        <SelectContent>
                                            {allUsers.filter(u => u.role === 'TRAINER').map(t => (
                                                <SelectItem key={t.uid} value={t.uid}>{t.displayName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full" disabled={isCreating}>{isCreating ? 'Creating...' : 'Publish Course'}</Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- USERS OVERVIEW TAB --- */}
                <TabsContent value="users">
                    <div className="space-y-6">
                        {/* Search Bar */}
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by name or email..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Trainers Table */}
                        <Card>
                            <CardHeader><CardTitle>Trainers ({trainers.length})</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Trainer Details</TableHead>
                                            <TableHead>Assigned Courses</TableHead>
                                            <TableHead className="text-right">Manage Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {trainers.map(trainer => (
                                            <TableRow key={trainer.uid}>
                                                <TableCell>
                                                    <div className="font-medium">{trainer.displayName}</div>
                                                    <div className="text-xs text-gray-500">{trainer.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-2">
                                                        {courses.filter(c => c.trainerId === trainer.uid).map(c => (
                                                            <Badge key={c.id} variant="secondary">{c.title}</Badge>
                                                        ))}
                                                        {courses.filter(c => c.trainerId === trainer.uid).length === 0 && <span className="text-gray-400 text-xs italic">None</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Select onValueChange={(val) => handleRoleUpdate(trainer.uid, val)} defaultValue={trainer.role}>
                                                        <SelectTrigger className="w-[130px] ml-auto">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="STUDENT">Student</SelectItem>
                                                            <SelectItem value="TRAINER">Trainer</SelectItem>
                                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Students Table */}
                        <Card>
                            <CardHeader><CardTitle>Students & Progress ({students.length})</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Student Name</TableHead>
                                            <TableHead>Enrolled Courses / Progress</TableHead>
                                            <TableHead className="text-right">Manage Role</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {students.map(student => {
                                            const studentEnrolls = allEnrollments.filter(e => e.studentId === student.uid);
                                            return (
                                                <TableRow key={student.uid}>
                                                    <TableCell className="font-medium">
                                                        <div>{student.displayName}</div>
                                                        <div className="text-xs text-gray-500">{student.email}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-2">
                                                            {studentEnrolls.map(e => (
                                                                <div key={e.id} className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-[10px]">{getCourseName(e.courseId)}</Badge>
                                                                    <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                                                        <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${e.progress || 0}%` }}></div>
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-500">{e.progress || 0}%</span>
                                                                </div>
                                                            ))}
                                                            {studentEnrolls.length === 0 && <span className="text-gray-400 text-xs italic">Not enrolled in any courses</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Select onValueChange={(val) => handleRoleUpdate(student.uid, val)} defaultValue={student.role}>
                                                            <SelectTrigger className="w-[130px] ml-auto">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="STUDENT">Student</SelectItem>
                                                                <SelectItem value="TRAINER">Trainer</SelectItem>
                                                                <SelectItem value="ADMIN">Admin</SelectItem>
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
    );
}