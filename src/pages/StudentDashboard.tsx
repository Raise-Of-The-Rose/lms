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
import { Loader2, UploadCloud, QrCode } from 'lucide-react';

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
            alert("Payment submitted for approval!");
            setIsDialogOpen(false);
            setEnrollments(prev => ({ ...prev, [selectedCourse.id]: 'PENDING' }));
        } catch (error) {
            alert("Submission failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading classroom...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8 tracking-tight text-slate-900">Available Courses</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {courses.map((course) => {
                    const status = enrollments[course.id];
                    return (
                        <Card key={course.id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow bg-white border-slate-200">
                            <img src={course.courseImage} className="h-48 w-full object-cover" alt={course.title} />
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-xl line-clamp-1 text-slate-900">{course.title}</CardTitle>
                                    {status && (
                                        <Badge variant={status === 'ENROLLED' ? 'default' : 'secondary'} className="capitalize">
                                            {status.toLowerCase()}
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription className="line-clamp-2 h-10">{course.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow pt-0">
                                <p className="text-sm font-medium text-slate-500">Instructor: {course.trainerName}</p>
                            </CardContent>
                            <CardFooter className="pt-0">
                                {status === 'ENROLLED' ? (
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => navigate(`/course/${course.id}`)}>
                                        Continue Learning
                                    </Button>
                                ) : status === 'PENDING' ? (
                                    <Button className="w-full" disabled variant="outline">Waiting for Approval</Button>
                                ) : (
                                    <Dialog open={isDialogOpen && selectedCourse?.id === course.id} onOpenChange={(open) => {
                                        setIsDialogOpen(open);
                                        if (open) setSelectedCourse(course);
                                    }}>
                                        <DialogTrigger asChild>
                                            <Button className="w-full" variant="outline">Enroll Now</Button>
                                        </DialogTrigger>

                                        {/* FIXED SCROLLABLE SOLID DIALOG */}
                                        <DialogContent className="sm:max-w-[450px] w-[95vw] p-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl opacity-100 flex flex-col max-h-[92vh]">
                                            {/* Header - Stays at top */}
                                            <div className="bg-slate-50 p-6 border-b border-slate-100 shrink-0">
                                                <DialogHeader>
                                                    <DialogTitle className="text-2xl font-bold text-slate-900">Complete Enrollment</DialogTitle>
                                                    <DialogDescription className="text-slate-600 text-base">
                                                        Pay for <span className="font-bold text-slate-900">{course.title}</span>
                                                    </DialogDescription>
                                                </DialogHeader>
                                            </div>

                                            {/* Form Area - Scrollable */}
                                            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-6 bg-white overflow-y-auto custom-scrollbar">
                                                {/* QR Code Section */}
                                                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                                                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                        <QrCode className="h-4 w-4" /> Scan to Pay
                                                    </div>
                                                    <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                                                        <img
                                                            src="https://res.cloudinary.com/dq6c78y00/image/upload/v1772553375/Shyam_payment_qr_code_bpmbfc.jpg"
                                                            alt="Payment QR"
                                                            className="w-40 h-40 md:w-44 md:h-44 object-cover"
                                                        />
                                                    </div>
                                                    <p className="mt-3 text-[11px] text-slate-500 text-center leading-relaxed">
                                                        Send the course fee via UPI and <br /> upload the UTR screenshot below.
                                                    </p>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="upiId" className="text-xs font-bold uppercase text-slate-700">Your UPI ID</Label>
                                                        <Input
                                                            id="upiId"
                                                            placeholder="yourname@upi"
                                                            value={upiId}
                                                            onChange={e => setUpiId(e.target.value)}
                                                            required
                                                            className="bg-white border-slate-300 focus:ring-blue-500 h-11"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="txnId" className="text-xs font-bold uppercase text-slate-700">Transaction ID (UTR)</Label>
                                                        <Input
                                                            id="txnId"
                                                            placeholder="12-digit number"
                                                            value={txnId}
                                                            onChange={e => setTxnId(e.target.value)}
                                                            required
                                                            className="bg-white border-slate-300 focus:ring-blue-500 h-11"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="screenshot" className="text-xs font-bold uppercase text-slate-700">Payment Screenshot</Label>
                                                        <Input
                                                            id="screenshot"
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={e => setScreenshot(e.target.files?.[0] || null)}
                                                            required
                                                            className="bg-white border-slate-300 file:bg-slate-400 file:text-white file:text-xs file:font-bold h-11 pt-2"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Footer-like Button inside scroll area to ensure it's reached */}
                                                <Button type="submit" className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-100 transition-all active:scale-95" disabled={isSubmitting}>
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UploadCloud className="mr-2 h-5 w-5" />
                                                            Confirm Enrollment
                                                        </>
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
    );
}