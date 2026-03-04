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
import { Video, Users, BookOpen, LayoutDashboard, PlusCircle, Globe, Clock, CheckCircle2, Loader2 } from 'lucide-react';

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
  studentName: string;
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

  useEffect(() => {
    if (!selectedCourse) return;

    const fetchStudentsAndNames = async () => {
      try {
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

        const studentIds = Array.from(new Set(enrollmentData.map((e: any) => e.studentId).filter(id => !!id)));

        if (studentIds.length === 0) {
          setStudents(enrollmentData.map((enroll: any) => ({
            ...enroll,
            studentName: "Unknown Student (No ID)"
          })) as any);
          return;
        }

        const usersQ = query(collection(db, 'users'), where(documentId(), "in", studentIds));
        const userSnapshot = await getDocs(usersQ);

        const userMap: Record<string, string> = {};
        userSnapshot.docs.forEach(doc => {
          userMap[doc.id] = doc.data().displayName || "Unnamed User";
        });

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

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Management Node</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      <div className="max-w-7xl mx-auto p-4 lg:p-10 space-y-10">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Instructor Control</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Trainer Dashboard</h1>
          </div>

          <div className="w-full md:w-80 group">
            <Label htmlFor="courseSelect" className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 block ml-1">Current Active Classroom</Label>
            <div className="relative">
              <select
                id="courseSelect"
                className="appearance-none w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:ring-0 transition-all outline-none shadow-sm cursor-pointer"
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
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <BookOpen size={16} />
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="bg-slate-200/50 p-1 rounded-[1.5rem] mb-8 w-fit border border-slate-100">
            <TabsTrigger value="manage" className="rounded-full px-8 py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold text-xs tracking-wide transition-all uppercase">
              Curriculum & Live
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-full px-8 py-2.5 data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold text-xs tracking-wide transition-all uppercase">
              Student Matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Live Session Card */}
            <Card className="rounded-[2rem] border-none shadow-[0_15px_40px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/20">
                    <Video size={20} className="text-indigo-400" />
                  </div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight italic">Live Streaming</CardTitle>
                </div>
                <CardDescription className="text-slate-400 font-medium italic">Configure Google Meet parameters for the next sync.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleUpdateMeetDetails} className="space-y-6">
                  <div className="space-y-2 group">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Meet URL Endpoint</Label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                      <Input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className="h-12 pl-12 rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-medium" required />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Scheduled Timezone</Label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                      <Input value={meetTime} onChange={e => setMeetTime(e.target.value)} placeholder="e.g., 07:00 PM IST" className="h-12 pl-12 rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-medium" required />
                    </div>
                  </div>
                  <Button type="submit" disabled={isUpdating} className="w-full h-12 bg-indigo-600 hover:bg-slate-900 text-white font-black rounded-xl shadow-lg shadow-indigo-100 uppercase text-xs tracking-[0.15em] transition-all active:scale-95">
                    {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : "Deploy Updates"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Curriculum Card */}
            <Card className="rounded-[2rem] border-none shadow-[0_15px_40px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="p-8 border-b border-slate-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-slate-100 rounded-xl">
                    <PlusCircle size={20} className="text-slate-900" />
                  </div>
                  <CardTitle className="text-xl font-black uppercase tracking-tight italic">Expand Curriculum</CardTitle>
                </div>
                <CardDescription className="text-slate-400 font-medium">Inject new recorded content into the module stream.</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleAddModule} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Module Title</Label>
                    <Input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="e.g., Advanced Logic Patterns" className="h-12 rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-medium italic" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Secure Video Link</Label>
                    <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube, Drive, or Vimeo URL" className="h-12 rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-medium" required />
                  </div>
                  <Button type="submit" disabled={isUpdating} className="w-full h-12 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white font-black rounded-xl uppercase text-xs tracking-[0.15em] transition-all">
                    {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : "Publish Module"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-[2rem] border-none shadow-[0_15px_40px_rgba(0,0,0,0.04)] bg-white overflow-hidden">
              <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 rounded-xl">
                      <Users size={20} className="text-emerald-600" />
                    </div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight italic">Enrollment Matrix</CardTitle>
                  </div>
                  <CardDescription className="text-slate-400 font-medium">Real-time performance and status telemetry of students.</CardDescription>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-2xl font-black text-xs text-slate-600 uppercase tracking-widest border border-slate-200">
                  Total: {students.length} Students
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {students.length === 0 ? (
                  <div className="p-20 text-center flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                      <Users size={32} />
                    </div>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Node Empty: No Enrolled Data Found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Student Profile</TableHead>
                          <TableHead className="py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Validation Status</TableHead>
                          <TableHead className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Mastery Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id} className="group border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                            <TableCell className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                  {student.studentName.charAt(0)}
                                </div>
                                <span className="font-bold text-slate-700 tracking-tight">{student.studentName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                  {student.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-8">
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                    <div
                                      className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-all duration-1000"
                                      style={{ width: `${student.progress}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 min-w-[40px] justify-end">
                                    <span className="text-xs font-black text-slate-900">{student.progress}%</span>
                                    {student.progress === 100 && <CheckCircle2 size={14} className="text-emerald-500" />}
                                  </div>
                                </div>
                              </div>
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
        </Tabs>
      </div>
    </div>
  );
}