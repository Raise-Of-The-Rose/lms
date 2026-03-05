import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, increment, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Video, Users, LayoutDashboard, PlusCircle, Globe, Clock, CheckCircle2, Loader2, FolderPlus, Layers, Lock } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  meetLink?: string;
  meetTime?: string;
  totalModules: number;
  durationMonths?: number;
}

interface ModuleGroup {
  id: string;
  name: string;
  monthNumber: number;
  videoCount?: number;
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
  const [activeTab, setActiveTab] = useState<'manage' | 'students'>('manage');

  const [meetLink, setMeetLink] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Module Groups
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupMonth, setGroupMonth] = useState('1');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Video / Module inside a group
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  const selectedCourseData = assignedCourses.find(c => c.id === selectedCourse);
  const durationMonths = selectedCourseData?.durationMonths || 1;

  const fetchModuleGroups = async (courseId: string) => {
    const snap = await getDocs(collection(db, `courses/${courseId}/moduleGroups`));
    const groups = snap.docs.map(d => ({ id: d.id, ...d.data() } as ModuleGroup));
    // Count videos per group
    const withCounts = await Promise.all(groups.map(async (g) => {
      const vSnap = await getDocs(query(collection(db, `courses/${courseId}/modules`), where('moduleGroupId', '==', g.id)));
      return { ...g, videoCount: vSnap.size };
    }));
    setModuleGroups(withCounts.sort((a, b) => a.monthNumber - b.monthNumber));
  };

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
          fetchModuleGroups(courses[0].id);
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
    fetchModuleGroups(selectedCourse);

    const fetchStudentsAndNames = async () => {
      try {
        const enrollQ = query(collection(db, 'enrollments'), where("courseId", "==", selectedCourse), where("status", "==", "ENROLLED"));
        const enrollSnap = await getDocs(enrollQ);
        const enrollmentData = enrollSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (enrollmentData.length === 0) { setStudents([]); return; }

        const studentIds = Array.from(new Set(enrollmentData.map((e: any) => e.studentId).filter((id: string) => !!id)));
        if (studentIds.length === 0) {
          setStudents(enrollmentData.map((enroll: any) => ({ ...enroll, studentName: "Unknown Student (No ID)" })) as any);
          return;
        }

        const usersQ = query(collection(db, 'users'), where(documentId(), "in", studentIds));
        const userSnapshot = await getDocs(usersQ);
        const userMap: Record<string, string> = {};
        userSnapshot.docs.forEach(doc => { userMap[doc.id] = doc.data().displayName || "Unnamed User"; });

        const combinedData = enrollmentData.map((enroll: any) => ({
          id: enroll.id, studentId: enroll.studentId,
          studentName: userMap[enroll.studentId] || "User Not Found",
          progress: enroll.progress || 0, status: enroll.status
        })) as StudentProgress[];
        setStudents(combinedData);
      } catch (error) { console.error("Critical error in fetchStudentsAndNames:", error); }
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
    } catch (error) { console.error("Error updating meet details:", error); }
    finally { setIsUpdating(false); }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !groupName.trim()) return;
    setIsCreatingGroup(true);
    try {
      await addDoc(collection(db, `courses/${selectedCourse}/moduleGroups`), {
        name: groupName.trim(),
        monthNumber: parseInt(groupMonth),
        createdAt: new Date()
      });
      setGroupName('');
      setGroupMonth('1');
      await fetchModuleGroups(selectedCourse);
      alert(`Module group "${groupName}" created for Month ${groupMonth}!`);
    } catch (error) { console.error(error); }
    finally { setIsCreatingGroup(false); }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !selectedGroupId) { alert("Select a module group first."); return; }
    const isValidUrl = videoUrl.includes('youtu.be') || videoUrl.includes('youtube.com') || videoUrl.includes('drive.google.com') || videoUrl.includes('vimeo.com');
    if (!isValidUrl) { alert("Please use valid YouTube, Vimeo, or Drive links."); return; }
    setIsAddingVideo(true);
    try {
      const group = moduleGroups.find(g => g.id === selectedGroupId);
      await addDoc(collection(db, `courses/${selectedCourse}/modules`), {
        title: moduleTitle,
        videoUrl,
        moduleGroupId: selectedGroupId,
        monthNumber: group?.monthNumber || 1,
        createdAt: new Date()
      });
      await updateDoc(doc(db, 'courses', selectedCourse), { totalModules: increment(1) });
      setModuleTitle(''); setVideoUrl('');
      setAssignedCourses(courses => courses.map(c => c.id === selectedCourse ? { ...c, totalModules: c.totalModules + 1 } : c));
      await fetchModuleGroups(selectedCourse);
      alert("Video published!");
    } catch (error) { console.error(error); }
    finally { setIsAddingVideo(false); }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-base-200">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50">Loading Management Node</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-base-200 pb-12 font-sans">
      <div className="max-w-7xl mx-auto p-4 lg:p-10 space-y-10">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-base-100 p-6 rounded-2xl shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary/20 p-1.5 rounded-lg">
                <LayoutDashboard size={18} className="text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Instructor Control</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-base-content">Trainer Dashboard</h1>
          </div>

          <div className="w-full md:w-80">
            <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Current Active Classroom</span></label>
            <select
              className="select select-bordered w-full"
              value={selectedCourse}
              onChange={(e) => {
                const course = assignedCourses.find(c => c.id === e.target.value);
                setSelectedCourse(e.target.value);
                if (course) { setMeetLink(course.meetLink || ''); setMeetTime(course.meetTime || ''); }
              }}>
              {assignedCourses.map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
            {selectedCourseData && (
              <p className="text-[10px] text-base-content/50 mt-1 font-medium">
                Duration: <span className="font-bold text-primary">{durationMonths} month{durationMonths !== 1 ? 's' : ''}</span>
              </p>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div role="tablist" className="tabs tabs-boxed bg-base-100 p-1.5 rounded-2xl shadow w-fit">
          <button role="tab" className={`tab font-bold uppercase text-xs tracking-wide ${activeTab === 'manage' ? 'tab-active' : ''}`} onClick={() => setActiveTab('manage')}>Curriculum & Live</button>
          <button role="tab" className={`tab font-bold uppercase text-xs tracking-wide ${activeTab === 'students' ? 'tab-active' : ''}`} onClick={() => setActiveTab('students')}>Student Matrix</button>
        </div>

        {/* Manage Tab */}
        {activeTab === 'manage' && (
          <div className="space-y-8">

            {/* Live Session */}
            <div className="card bg-base-100 shadow-xl max-w-lg">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/20 rounded-xl"><Video size={20} className="text-primary" /></div>
                  <h2 className="card-title text-xl font-black uppercase tracking-tight italic">Live Streaming</h2>
                </div>
                <p className="text-base-content/60 font-medium italic mb-4">Configure Google Meet parameters for the next sync.</p>
                <form onSubmit={handleUpdateMeetDetails} className="space-y-6">
                  <div className="form-control">
                    <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Meet URL Endpoint</span></label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                      <input value={meetLink} onChange={e => setMeetLink(e.target.value)} placeholder="https://meet.google.com/..." className="input input-bordered w-full pl-12" required />
                    </div>
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Scheduled Timezone</span></label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30" size={16} />
                      <input value={meetTime} onChange={e => setMeetTime(e.target.value)} placeholder="e.g., 07:00 PM IST" className="input input-bordered w-full pl-12" required />
                    </div>
                  </div>
                  <button type="submit" disabled={isUpdating} className="btn btn-primary w-full font-black uppercase text-xs tracking-[0.15em]">
                    {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : "Deploy Updates"}
                  </button>
                </form>
              </div>
            </div>

            {/* Module Groups Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Create Module Group */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-secondary/20 rounded-xl"><FolderPlus size={20} className="text-secondary" /></div>
                    <div>
                      <h2 className="card-title text-xl font-black uppercase tracking-tight">Create Module Group</h2>
                      <p className="text-xs text-base-content/50 font-medium">e.g. "Beginner", "Introduction" — assign to a month</p>
                    </div>
                  </div>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Group Name</span></label>
                      <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Beginner, HTML Basics..." className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Assign to Month</span></label>
                      <select className="select select-bordered w-full" value={groupMonth} onChange={e => setGroupMonth(e.target.value)} required>
                        {Array.from({ length: durationMonths }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>Month {m}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" disabled={isCreatingGroup} className="btn btn-secondary w-full font-black uppercase text-xs tracking-widest">
                      {isCreatingGroup ? <Loader2 className="animate-spin h-5 w-5" /> : "Create Group"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Add Video to Group */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/20 rounded-xl"><PlusCircle size={20} className="text-primary" /></div>
                    <div>
                      <h2 className="card-title text-xl font-black uppercase tracking-tight">Add Video</h2>
                      <p className="text-xs text-base-content/50 font-medium">Select a module group, then add a video link</p>
                    </div>
                  </div>
                  <form onSubmit={handleAddVideo} className="space-y-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Module Group</span></label>
                      <select className="select select-bordered w-full" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)} required>
                        <option value="">Choose a group...</option>
                        {moduleGroups.map(g => (
                          <option key={g.id} value={g.id}>Month {g.monthNumber} — {g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Video Title</span></label>
                      <input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="e.g. Introduction to Variables" className="input input-bordered w-full" required />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text text-[10px] font-black uppercase tracking-widest">Secure Video Link</span></label>
                      <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube, Drive, or Vimeo URL" className="input input-bordered w-full" required />
                    </div>
                    <button type="submit" disabled={isAddingVideo} className="btn btn-primary w-full font-black uppercase text-xs tracking-widest">
                      {isAddingVideo ? <Loader2 className="animate-spin h-5 w-5" /> : "Publish Video"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Curriculum Overview */}
            {moduleGroups.length > 0 && (
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body p-0">
                  <div className="p-6 border-b border-base-300 flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-xl"><Layers size={20} className="text-primary" /></div>
                    <div>
                      <h2 className="card-title text-xl font-black">Curriculum Overview</h2>
                      <p className="text-xs text-base-content/50">All module groups for this course</p>
                    </div>
                  </div>
                  <div className="p-6">
                    {Array.from({ length: durationMonths }, (_, i) => i + 1).map(month => {
                      const monthGroups = moduleGroups.filter(g => g.monthNumber === month);
                      return (
                        <div key={month} className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="badge badge-primary font-black">Month {month}</span>
                            <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest">{monthGroups.length} group{monthGroups.length !== 1 ? 's' : ''}</span>
                          </div>
                          {monthGroups.length === 0 ? (
                            <div className="flex items-center gap-2 p-4 bg-base-200 rounded-xl border-2 border-dashed border-base-300">
                              <Lock size={14} className="text-base-content/30" />
                              <span className="text-xs text-base-content/40 italic">No groups yet for this month</span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {monthGroups.map(g => (
                                <div key={g.id} className="bg-base-200 rounded-xl p-4 flex items-center justify-between">
                                  <div>
                                    <p className="font-bold text-sm">{g.name}</p>
                                    <p className="text-[10px] text-base-content/50 mt-0.5">{g.videoCount || 0} video{(g.videoCount || 0) !== 1 ? 's' : ''}</p>
                                  </div>
                                  <span className="badge badge-outline badge-sm font-bold">M{month}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-0">
              <div className="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-base-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/20 rounded-xl"><Users size={20} className="text-success" /></div>
                  <div>
                    <h2 className="card-title text-xl font-black uppercase tracking-tight italic">Enrollment Matrix</h2>
                    <p className="text-base-content/60 font-medium text-sm">Real-time performance and status telemetry.</p>
                  </div>
                </div>
                <span className="badge badge-ghost font-black text-xs uppercase tracking-widest">Total: {students.length} Students</span>
              </div>

              {students.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center text-base-content/30">
                    <Users size={32} />
                  </div>
                  <p className="text-base-content/40 font-bold uppercase text-[10px] tracking-[0.2em]">Node Empty: No Enrolled Data Found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-base-content/40">
                        <th>Student Profile</th>
                        <th>Validation Status</th>
                        <th className="text-right">Mastery Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id} className="hover">
                          <td>
                            <div className="flex items-center gap-4">
                              <div className="avatar placeholder">
                                <div className="bg-primary/10 text-primary rounded-full w-10">
                                  <span className="text-xs font-black">{student.studentName.charAt(0)}</span>
                                </div>
                              </div>
                              <span className="font-bold">{student.studentName}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-success badge-outline gap-2 font-black text-[10px] uppercase tracking-widest">
                              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                              {student.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-3">
                                <progress className="progress progress-primary w-32" value={student.progress} max="100"></progress>
                                <div className="flex items-center gap-1 min-w-[40px] justify-end">
                                  <span className="text-xs font-black">{student.progress}%</span>
                                  {student.progress === 100 && <CheckCircle2 size={14} className="text-success" />}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}