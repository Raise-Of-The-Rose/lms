import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, PlayCircle, Video } from 'lucide-react';

interface Module {
    id: string;
    title: string;
    videoUrl: string;
}

interface Enrollment {
    id: string;
    progress: number;
    completedModules: string[];
    status: string;
}

export default function CourseConsumption() {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [courseData, setCourseData] = useState<any>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
    const [activeModule, setActiveModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser || !courseId) return;

        const fetchCourseData = async () => {
            try {
                // 1. Fetch Course details
                const courseRef = doc(db, 'courses', courseId);
                const courseSnap = await getDoc(courseRef);
                if (courseSnap.exists()) {
                    setCourseData(courseSnap.data());
                }

                // 2. Fetch Modules for this course
                const modulesRef = collection(db, `courses/${courseId}/modules`);
                const qModules = query(modulesRef, orderBy("createdAt", "asc"));
                const moduleSnap = await getDocs(qModules);
                const fetchedModules = moduleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Module));
                setModules(fetchedModules);
                if (fetchedModules.length > 0) setActiveModule(fetchedModules[0]);

                // 3. FIXED: Fetch only the specific student's enrollment to avoid permission errors
                const enrollQ = query(
                    collection(db, 'enrollments'),
                    where("studentId", "==", currentUser.uid),
                    where("courseId", "==", courseId)
                );
                const enrollmentSnap = await getDocs(enrollQ);

                if (!enrollmentSnap.empty) {
                    const enrollDoc = enrollmentSnap.docs[0];
                    const data = enrollDoc.data();

                    if (data.status !== 'ENROLLED') {
                        alert('Your enrollment is still pending approval.');
                        navigate('/dashboard');
                        return;
                    }
                    setEnrollment({ id: enrollDoc.id, ...data } as Enrollment);
                } else {
                    navigate('/dashboard');
                }

            } catch (error) {
                console.error("Error fetching classroom data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCourseData();
    }, [courseId, currentUser, navigate]);

    const handleMarkComplete = async (moduleId: string) => {
        if (!enrollment || enrollment.completedModules.includes(moduleId)) return;

        const updatedCompletedModules = [...enrollment.completedModules, moduleId];
        const newProgress = Math.round((updatedCompletedModules.length / modules.length) * 100);

        try {
            const enrollmentRef = doc(db, 'enrollments', enrollment.id);
            // Update ONLY the progress fields
            await updateDoc(enrollmentRef, {
                completedModules: updatedCompletedModules,
                progress: newProgress
            });

            setEnrollment({
                ...enrollment,
                completedModules: updatedCompletedModules,
                progress: newProgress
            });

            if (newProgress === 100) {
                alert('Congratulations! Course completed.');
            }
        } catch (error) {
            console.error("Error updating progress:", error);
        }
    };

    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        // Handle standard watch links
        if (url.includes('youtube.com/watch?v=')) {
            return url.replace('watch?v=', 'embed/');
        }
        // Handle shortened mobile links
        if (url.includes('youtu.be/')) {
            const id = url.split('/').pop();
            return `https://www.youtube.com/embed/${id}`;
        }
        return url;
    }

    if (loading) return <div className="p-8">Loading your classroom...</div>;
    if (!enrollment) return <div className="p-8">Not authorized.</div>;

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-grow md:w-2/3 space-y-4">
                    <h1 className="text-3xl font-bold">{courseData?.title}</h1>

                    {courseData?.meetLink && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <Video className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800">Live Session Available</AlertTitle>
                            <AlertDescription className="flex justify-between items-center">
                                <span>Next class: {courseData.meetTime || 'Check schedule'}</span>
                                <Button size="sm" onClick={() => window.open(courseData.meetLink, '_blank')}>
                                    Join Meeting
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {activeModule ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>{activeModule.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="relative w-full overflow-hidden aspect-video bg-black rounded-md">
                                    <iframe
                                        className="absolute inset-0 w-full h-full"
                                        src={getEmbedUrl(activeModule.videoUrl)}
                                        allowFullScreen
                                        title="Module Video"
                                    ></iframe>
                                </div>

                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-gray-500 italic">Mark as complete once you've finished the lesson.</p>
                                    <Button
                                        onClick={() => handleMarkComplete(activeModule.id)}
                                        disabled={enrollment.completedModules.includes(activeModule.id)}
                                        className={enrollment.completedModules.includes(activeModule.id) ? "bg-green-600" : ""}
                                    >
                                        {enrollment.completedModules.includes(activeModule.id) ? 'Completed' : 'Mark as Complete'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="p-20 text-center border-2 border-dashed rounded-lg text-gray-400">
                            No recorded modules available yet.
                        </div>
                    )}
                </div>

                <div className="md:w-1/3 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Progress</CardTitle>
                            <CardDescription>{enrollment.progress}% Completed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Progress value={enrollment.progress} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Course Curriculum</CardTitle></CardHeader>
                        <CardContent className="p-0">
                            <div className="flex flex-col">
                                {modules.map((module, index) => {
                                    const isComp = enrollment.completedModules.includes(module.id);
                                    const isActive = activeModule?.id === module.id;
                                    return (
                                        <button
                                            key={module.id}
                                            onClick={() => setActiveModule(module)}
                                            className={`flex items-center gap-3 p-4 border-b text-left hover:bg-gray-50 ${isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                                        >
                                            {isComp ? <CheckCircle className="text-green-500 h-5 w-5" /> : <PlayCircle className="text-gray-400 h-5 w-5" />}
                                            <span className={`text-sm ${isComp ? 'text-gray-400 line-through' : 'font-medium'}`}>
                                                {index + 1}. {module.title}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}