import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, increment, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Course {
  id: string;
  title: string;
  meetLink?: string;
  meetTime?: string;
  totalModules: number;
}

interface StudentProgress {
  id: string;
  studentId: string;
  studentName: string; // Added this
  progress: number;
  status: string;
}

export default function TrainerDashboard() {
  const { currentUser } = useAuth();
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const [meetLink, setMeetLink] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const fetchTrainerData = async () => {
      try {
        const q = query(collection(db, 'courses'), where("trainerId", "==", currentUser.uid));
        const courseSnapshot = await getDocs(q);
        const courses = courseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));

        setAssignedCourses(courses);
        if (courses.length > 0) {
          setSelectedCourse(courses[0].id);
          setMeetLink(courses[0].meetLink || '');
          setMeetTime(courses[0].meetTime || '');
        }
      } catch (error) {
        console.error("Error fetching trainer courses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrainerData();
  }, [currentUser]);

  // Updated to fetch Student Names
  // Updated useEffect to fetch Student Names with better error handling
  useEffect(() => {
    if (!selectedCourse) return;

    const fetchStudentsAndNames = async () => {
      try {

        // 1. Fetch Enrollments
        const enrollQ = query(
          collection(db, 'enrollments'),
          where("courseId", "==", selectedCourse),
          where("status", "==", "ENROLLED")
        );
        const enrollSnap = await getDocs(enrollQ);
        const enrollmentData = enrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (enrollmentData.length === 0) {
          setStudents([]);
          return;
        }

        // 2. Extract unique Student IDs and filter out any empties
        const studentIds = Array.from(new Set(enrollmentData.map((e: any) => e.studentId).filter(id => !!id)));

        if (studentIds.length === 0) {
          setStudents(enrollmentData.map((enroll: any) => ({
            ...enroll,
            studentName: "Unknown Student (No ID)"
          })) as any);
          return;
        }

        // 3. Fetch User Profiles
        // Note: Firestore 'in' query fails if studentIds has more than 30 items
        const usersQ = query(collection(db, 'users'), where(documentId(), "in", studentIds));
        const userSnapshot = await getDocs(usersQ);

        const userMap: Record<string, string> = {};
        userSnapshot.docs.forEach(doc => {
          userMap[doc.id] = doc.data().displayName || "Unnamed User";
        });


        // 4. Combine data
        const combinedData = enrollmentData.map((enroll: any) => ({
          id: enroll.id,
          studentId: enroll.studentId,
          studentName: userMap[enroll.studentId] || "User Not Found",
          progress: enroll.progress || 0,
          status: enroll.status
        })) as StudentProgress[];

        setStudents(combinedData);
      } catch (error) {
        console.error("Critical error in fetchStudentsAndNames:", error);
      }
    };

    fetchStudentsAndNames();
  }, [selectedCourse]);

  const handleUpdateMeetDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'courses', selectedCourse), { meetLink, meetTime });
      alert("Live session details updated!");
    } catch (error) {
      console.error("Error updating meet details:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    const isValidUrl = videoUrl.includes('youtu.be') || videoUrl.includes('youtube.com') || videoUrl.includes('drive.google.com') || videoUrl.includes('vimeo.com');
    if (!isValidUrl) {
      alert("Please use valid YouTube, Vimeo, or Drive links.");
      return;
    }
    setIsUpdating(true);
    try {
      await addDoc(collection(db, `courses/${selectedCourse}/modules`), {
        title: moduleTitle,
        videoUrl: videoUrl,
        createdAt: new Date(),
      });
      await updateDoc(doc(db, 'courses', selectedCourse), { totalModules: increment(1) });
      alert("Module published!");
      setModuleTitle(''); setVideoUrl('');
      setAssignedCourses(courses => courses.map(c => c.id === selectedCourse ? { ...c, totalModules: c.totalModules + 1 } : c));
    } catch (error) {
      console.error(error);
    } finally { setIsUpdating(false); }
  };

  if (loading) return <div className="p-8 text-center">Syncing dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Trainer Dashboard</h1>

      <div className="mb-6">
        <Label htmlFor="courseSelect" className="text-gray-600">Select Active Course</Label>
        <select
          id="courseSelect"
          className="flex h-10 w-full md:w-1/3 rounded-md border border-input bg-background px-3 py-2 text-sm mt-2 focus:ring-2 focus:ring-blue-500 outline-none"
          value={selectedCourse}
          onChange={(e) => {
            const course = assignedCourses.find(c => c.id === e.target.value);
            setSelectedCourse(e.target.value);
            if (course) {
              setMeetLink(course.meetLink || '');
              setMeetTime(course.meetTime || '');
            }
          }}
        >
          {assignedCourses.map(course => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
      </div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="manage">Curriculum & Live Class</TabsTrigger>
          <TabsTrigger value="students">Student Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="manage" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Live Session</CardTitle>
              <CardDescription>Google Meet details for today.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateMeetDetails} className="space-y-4">
                <div className="space-y-2">
                  <Label>Google Meet Link</Label>
                  <Input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." required />
                </div>
                <div className="space-y-2">
                  <Label>Session Time</Label>
                  <Input value={meetTime} onChange={e => setMeetTime(e.target.value)} placeholder="e.g., 7:00 PM IST" required />
                </div>
                <Button type="submit" disabled={isUpdating} className="w-full">Update Session</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Recorded Module</CardTitle>
              <CardDescription>Embed your recorded videos.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddModule} className="space-y-4">
                <Input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="Module Title" required />
                <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="Video URL (YouTube/Drive)" required />
                <Button type="submit" disabled={isUpdating} variant="secondary" className="w-full">Publish Module</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>Monitor your students' progress.</CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-gray-500 py-4">No students enrolled in this course yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Course Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium text-gray-700">{student.studentName}</TableCell>
                        <TableCell>
                          <span className="bg-green-100 text-green-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                            {student.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-600 h-full" style={{ width: `${student.progress}%` }}></div>
                            </div>
                            <span className="text-xs font-mono font-bold">{student.progress}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}