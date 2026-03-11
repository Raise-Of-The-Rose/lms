import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle, Play, Pause, Maximize, Loader2, ShieldAlert, RotateCcw, RotateCw, Settings2, Radio, Lock, ChevronDown, ChevronRight, IndianRupee } from 'lucide-react';
import YouTube from 'react-youtube';

interface Module { id: string; title: string; videoUrl: string; moduleGroupId?: string; monthNumber?: number; }
interface ModuleGroup { id: string; name: string; monthNumber: number; }
interface Enrollment { id: string; progress: number; completedModules: string[]; status: string; paidMonths?: number[]; paymentType?: 'FULL' | 'MONTHLY'; }

const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|live\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const CustomVideoPlayer = ({ url, onEnded }: { url: string, onEnded: () => void }) => {
    const videoId = getYouTubeId(url);
    const [player, setPlayer] = useState<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [played, setPlayed] = useState(0);
    const [buffering, setBuffering] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [quality, setQuality] = useState('Auto');
    const [isForceEnded, setIsForceEnded] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [activePlayTime, setActivePlayTime] = useState(0);
    const [hasPassedInitial, setHasPassedInitial] = useState(false);

    useEffect(() => {
        let interval: any;
        if (playing && player && !isForceEnded) {
            interval = setInterval(() => {
                const current = player.getCurrentTime();
                const total = player.getDuration();
                setActivePlayTime(prev => { const n = prev + 0.5; if (n >= 3 && !hasPassedInitial) setHasPassedInitial(true); return n; });
                if (total > 0) { setPlayed(current / total); if (current >= total - 25) { player.pauseVideo(); setPlaying(false); setIsForceEnded(true); onEnded(); } }
            }, 500);
        } else { setActivePlayTime(0); }
        return () => clearInterval(interval);
    }, [playing, player, isForceEnded, onEnded, hasPassedInitial]);

    const handlePlayPause = () => { if (!player || isForceEnded) return; playing ? player.pauseVideo() : player.playVideo(); setPlaying(!playing); setShowQualityMenu(false); };
    const handleSeek = (seconds: number) => { if (!player || isForceEnded) return; player.seekTo(player.getCurrentTime() + seconds, true); };
    const isUIHidden = playing && hasPassedInitial && !isHovering;

    return (
        <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group shadow-2xl select-none"
            onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => { setIsHovering(false); setShowQualityMenu(false); }}>
            <div className="absolute inset-0 z-0 scale-[1.01]">
                <YouTube videoId={videoId || ''} opts={{ height: '100%', width: '100%', playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, origin: window.location.origin } }}
                    onReady={(e) => { setPlayer(e.target); setBuffering(false); }}
                    onStateChange={(e) => { if (!isForceEnded) { setPlaying(e.data === 1); setBuffering(e.data === 3); } }}
                    className="w-full h-full pointer-events-none" />
            </div>
            <div className={`absolute inset-0 z-20 bg-base-100 pointer-events-none ${(!playing || buffering || isForceEnded || (playing && !hasPassedInitial)) ? 'opacity-100 transition-none' : 'opacity-0 transition-opacity duration-700 delay-150'}`} />
            <div className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer" onClick={handlePlayPause}>
                {buffering && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
                {(!playing || (playing && !hasPassedInitial)) && !buffering && !isForceEnded && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-primary text-primary-content backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"><Play size={22} className="fill-current ml-1" /></div>
                        <span className="text-primary-content font-bold text-[9px] uppercase tracking-[0.3em] bg-base-100/50 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm">
                            {playing && !hasPassedInitial ? `LINKING (${Math.max(0, Math.ceil(3 - activePlayTime))}s)` : 'Resume'}
                        </span>
                    </div>
                )}
                {isForceEnded && (
                    <div className="text-center bg-base-100/80 backdrop-blur-md p-6 rounded-2xl shadow-2xl">
                        <ShieldAlert className="w-8 h-8 text-success mx-auto mb-2" />
                        <h3 className="text-success font-bold text-lg tracking-widest uppercase">Authorized</h3>
                    </div>
                )}
            </div>
            <div className={`absolute bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-base-100 via-base-100/60 to-transparent transition-opacity ${isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex flex-col gap-3">
                    <div className="relative h-1.5 w-full bg-base-300 rounded-full cursor-pointer overflow-hidden"><div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${played * 100}%` }} /></div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <button onClick={(e) => { e.stopPropagation(); handleSeek(-10); }} className="text-base-content/60 hover:text-base-content transition-colors"><RotateCcw size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handlePlayPause(); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all">
                                    {playing ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleSeek(10); }} className="text-base-content/60 hover:text-base-content transition-colors"><RotateCw size={16} /></button>
                            </div>
                            <div className="hidden sm:flex items-center gap-1 bg-base-100/50 backdrop-blur-md p-1 rounded-lg">
                                {[1, 1.5, 2].map((rate) => (
                                    <button key={rate} onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); player?.setPlaybackRate(rate); }}
                                        className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${playbackRate === rate ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}>{rate}x</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all ${showQualityMenu ? 'bg-primary border-primary text-primary-content' : 'bg-base-100/50 border-base-300 text-base-content/80'}`}>
                                <Settings2 size={12} /> {quality}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen(); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-base-100/50 border border-base-300 text-base-content/80 hover:text-base-content transition-all"><Maximize size={14} /></button>
                        </div>
                    </div>
                </div>
            </div>
            {showQualityMenu && (
                <div className="absolute bottom-16 right-4 z-50 bg-base-100/90 backdrop-blur-xl border border-base-300 rounded-xl p-1.5 shadow-2xl min-w-[120px]">
                    {['Auto', '1080p', '720p', '480p'].map((q) => (
                        <button key={q} onClick={() => { setQuality(q); setShowQualityMenu(false); player?.setPlaybackQuality(q === '1080p' ? 'hd1080' : q === '720p' ? 'hd720' : 'default'); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors ${quality === q ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}`}>{q}</button>
                    ))}
                </div>
            )}
        </div>
    );
};

// Collapsible month/group section in sidebar
const MonthSection = ({
    monthNumber, groups, paidMonths, completedModules, activeModule, onSelectModule, courseStartingAt
}: {
    monthNumber: number;
    groups: { group: ModuleGroup; modules: Module[] }[];
    paidMonths: number[];
    completedModules: string[];
    activeModule: Module | null;
    onSelectModule: (m: Module) => void;
    courseStartingAt: string;
}) => {
    const navigate = useNavigate();
    const isUnlocked = paidMonths.includes(monthNumber);
    const [open, setOpen] = useState(isUnlocked); // unlocked months default open
    const totalInMonth = groups.reduce((acc, g) => acc + g.modules.length, 0);
    const completedInMonth = groups.reduce((acc, g) => acc + g.modules.filter(m => completedModules.includes(m.id)).length, 0);

    return (
        <div className={`rounded-xl overflow-hidden border ${isUnlocked ? 'border-base-300' : 'border-base-300/50'}`}>
            <button
                className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isUnlocked ? 'bg-base-200 hover:bg-base-300/50' : 'bg-base-200/50 cursor-default'}`}
                onClick={() => isUnlocked && setOpen(o => !o)}
                title={isUnlocked ? (open ? 'Click to collapse' : 'Click to expand') : 'Locked'}
            >
                <div className="flex items-center gap-3">
                    {isUnlocked ? (
                        open ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-base-content/40" />
                    ) : (
                        <Lock size={16} className="text-base-content/30" />
                    )}
                    <div>
                        <span className={`text-xs font-black uppercase tracking-widest ${isUnlocked ? 'text-base-content' : 'text-base-content/40'}`}>
                            Month {monthNumber}
                        </span>
                        <div className="text-[10px] text-base-content/40 font-medium mt-0.5">
                            {isUnlocked ? `${completedInMonth}/${totalInMonth} done` : 'Locked'}
                        </div>
                    </div>
                </div>
                {isUnlocked ? (
                    <span className="badge badge-primary badge-outline text-[9px] font-bold">{totalInMonth} videos</span>
                ) : (
                    <span className="badge badge-ghost text-[9px] font-bold opacity-50">{totalInMonth} videos</span>
                )}
            </button>

            {/* Locked month preview */}
            {!isUnlocked && (
                <div className="p-3 bg-base-100/50 space-y-1">
                    {groups.flatMap(g => g.modules).map(m => (
                        <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg opacity-50">
                            <Lock size={12} className="text-base-content/30 flex-shrink-0" />
                            <span className="text-[11px] text-base-content/50 font-medium line-clamp-1">{m.title}</span>
                        </div>
                    ))}
                    <button
                        className="btn btn-sm btn-warning btn-outline w-full mt-2 font-black text-[10px] tracking-widest gap-1"
                        onClick={() => navigate('/dashboard')}
                    >
                        <IndianRupee size={12} /> PAY MONTH {monthNumber} — ₹{courseStartingAt}
                    </button>
                </div>
            )}

            {/* Unlocked month modules — all visible, no height cap */}
            {isUnlocked && open && (
                <div className="divide-y divide-base-300/30 bg-base-100">
                    {groups.map(({ group, modules: groupModules }) => (
                        <div key={group.id}>
                            {/* Group header */}
                            <div className="sticky top-0 z-10 px-4 py-2.5 bg-primary/10 border-l-4 border-primary flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{group.name}</span>
                                <span className="text-[9px] text-primary/60 font-bold">{groupModules.length} video{groupModules.length !== 1 ? 's' : ''}</span>
                            </div>
                            {/* All videos listed fully */}
                            {groupModules.map((m, i) => {
                                const isCompleted = completedModules.includes(m.id);
                                const isActive = activeModule?.id === m.id;
                                return (
                                    <button key={m.id} onClick={() => onSelectModule(m)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left relative transition-all ${isActive ? 'bg-primary/10' : 'hover:bg-base-200'}`}>
                                        <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg font-black text-[11px] ${isCompleted ? 'bg-success/20 text-success' : isActive ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50'}`}>
                                            {isCompleted ? <CheckCircle size={14} /> : (i + 1)}
                                        </div>
                                        <div className="flex flex-col flex-grow min-w-0">
                                            <span className={`text-xs font-bold leading-snug tracking-wide ${isCompleted ? 'text-base-content/40 line-through' : isActive ? 'text-primary' : 'text-base-content'}`}>{m.title}</span>
                                            {isActive && <span className="text-[9px] uppercase font-bold tracking-widest text-primary mt-0.5">Now Playing</span>}
                                        </div>
                                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function CourseConsumption() {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [courseData, setCourseData] = useState<any>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
    const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
    const [activeModule, setActiveModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser || !courseId) return;
        const fetchData = async () => {
            try {
                const cSnap = await getDoc(doc(db, 'courses', courseId));
                if (cSnap.exists()) setCourseData(cSnap.data());

                // Fetch module groups
                const gSnap = await getDocs(collection(db, `courses/${courseId}/moduleGroups`));
                const groups = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as ModuleGroup));
                setModuleGroups(groups.sort((a, b) => a.monthNumber - b.monthNumber));

                // Fetch modules
                const mSnap = await getDocs(query(collection(db, `courses/${courseId}/modules`), orderBy("createdAt", "asc")));
                const fetched = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
                setModules(fetched);

                // Enrollment check
                const eSnap = await getDocs(query(collection(db, 'enrollments'), where("studentId", "==", currentUser.uid), where("courseId", "==", courseId)));
                if (!eSnap.empty) {
                    const data = eSnap.docs[0].data();
                    if (data.status === 'ENROLLED') {
                        const enroll = { id: eSnap.docs[0].id, ...data } as Enrollment;
                        setEnrollment(enroll);
                        // Auto-select first accessible module
                        const paidMonths = enroll.paidMonths || [];
                        const firstAccessible = fetched.find(m => paidMonths.includes(m.monthNumber || 1));
                        if (firstAccessible) setActiveModule(firstAccessible);
                        else if (fetched.length > 0) setActiveModule(fetched[0]);
                    } else {
                        navigate('/dashboard');
                    }
                } else {
                    navigate('/dashboard');
                }
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchData();
    }, [courseId, currentUser, navigate]);

    const handleMarkComplete = async (moduleId: string) => {
        if (!enrollment || enrollment.completedModules.includes(moduleId)) return;
        const updated = [...enrollment.completedModules, moduleId];
        const prog = Math.round((updated.length / modules.length) * 100);
        await updateDoc(doc(db, 'enrollments', enrollment.id), { completedModules: updated, progress: prog });
        setEnrollment({ ...enrollment, completedModules: updated, progress: prog });
    };

    if (loading) return <div className="min-h-screen bg-base-200 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
    if (!enrollment) return null;

    const paidMonths = enrollment.paidMonths || [];
    const durationMonths = courseData?.durationMonths || 1;

    // Build grouped structure: month → groups → modules
    const monthlyStructure = Array.from({ length: durationMonths }, (_, i) => {
        const month = i + 1;
        const monthGroups = moduleGroups.filter(g => g.monthNumber === month);
        if (monthGroups.length > 0) {
            return {
                month,
                groups: monthGroups.map(g => ({
                    group: g,
                    modules: modules.filter(m => m.moduleGroupId === g.id)
                }))
            };
        }
        // Fallback: if no groups, show ungrouped modules for this month
        const ungroupedModules = modules.filter(m => (m.monthNumber === month) && !m.moduleGroupId);
        if (ungroupedModules.length > 0) {
            return {
                month,
                groups: [{ group: { id: `fallback-${month}`, name: 'General', monthNumber: month }, modules: ungroupedModules }]
            };
        }
        return null;
    }).filter(Boolean) as { month: number; groups: { group: ModuleGroup; modules: Module[] }[] }[];

    // Fallback structure: if no groups at all, show all modules flat under month 1
    const hasGroupedContent = monthlyStructure.length > 0 && monthlyStructure.some(m => m.groups.some(g => g.modules.length > 0));

    return (
        <div className="min-h-screen bg-base-200 font-sans pb-12">
            <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-grow lg:w-2/3 space-y-6">
                        <header className="bg-base-100 p-6 rounded-2xl shadow-lg">
                            <p className="text-primary font-black uppercase text-[10px] tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span> Learning Unit
                            </p>
                            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-base-content">{courseData?.title}</h1>
                            <p className="text-base-content/60 font-medium text-sm mt-2 flex items-center gap-2">
                                <span className="badge badge-primary badge-sm font-bold text-[10px] uppercase tracking-widest">Now Playing</span>
                                {activeModule?.title}
                            </p>
                        </header>

                        {courseData?.meetLink && (
                            <div className="bg-base-100 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/20 text-primary rounded-2xl flex items-center justify-center"><Radio className="animate-pulse" size={20} /></div>
                                    <div>
                                        <h3 className="text-base-content text-sm font-black uppercase tracking-widest">Live Session</h3>
                                        <p className="text-primary text-[10px] font-bold uppercase mt-1">{courseData.meetTime || 'Active Now'}</p>
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm font-black tracking-widest w-full sm:w-auto" onClick={() => window.open(courseData.meetLink, '_blank')}>JOIN NOW</button>
                            </div>
                        )}

                        {activeModule && (
                            <div className="space-y-6">
                                <CustomVideoPlayer key={activeModule.id} url={activeModule.videoUrl} onEnded={() => handleMarkComplete(activeModule.id)} />
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-base-100 rounded-2xl shadow gap-4">
                                    <div>
                                        <h4 className="text-sm font-black text-base-content uppercase tracking-widest">Module Progress</h4>
                                        <p className="text-base-content/50 font-medium text-[10px] uppercase mt-1">Sync to save status</p>
                                    </div>
                                    <button onClick={() => handleMarkComplete(activeModule.id)} disabled={enrollment.completedModules.includes(activeModule.id)}
                                        className={`btn w-full sm:w-auto font-bold text-[10px] tracking-[0.2em] uppercase ${enrollment.completedModules.includes(activeModule.id) ? 'btn-success btn-outline cursor-not-allowed' : 'btn-primary'}`}>
                                        {enrollment.completedModules.includes(activeModule.id) ? 'VALIDATED' : 'COMPLETE MODULE'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar — sticky, full-height, scrollable */}
                    <div className="lg:w-1/3">
                        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent pb-8">

                            {/* Progress Widget */}
                            <div className="bg-base-100 rounded-2xl p-6 shadow-xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Your Progress</p>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <h2 className="text-4xl font-black text-base-content tracking-tight">{enrollment.progress}</h2>
                                    <span className="text-primary text-xl font-black">%</span>
                                </div>
                                <progress className="progress progress-primary w-full h-2" value={enrollment.progress} max="100"></progress>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-[10px] text-base-content/40 font-bold uppercase tracking-widest">
                                        {paidMonths.length}/{durationMonths} months unlocked
                                    </span>
                                    <span className="badge badge-primary badge-sm font-bold">{enrollment.completedModules.length}/{modules.length} done</span>
                                </div>
                            </div>

                            {/* Month-based Curriculum — full scroll, no max-height cap on content */}
                            <div className="bg-base-100 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-5 border-b border-base-300 flex justify-between items-center">
                                    <span className="font-black uppercase text-[10px] tracking-widest">Course Curriculum</span>
                                    <span className="badge badge-primary badge-outline text-[10px] font-bold">{durationMonths} Months</span>
                                </div>
                                <div className="flex flex-col gap-2 p-3">
                                    {hasGroupedContent ? (
                                        monthlyStructure.map(({ month, groups }) => (
                                            <MonthSection
                                                key={month}
                                                monthNumber={month}
                                                groups={groups}
                                                paidMonths={paidMonths}
                                                completedModules={enrollment.completedModules}
                                                activeModule={activeModule}
                                                onSelectModule={setActiveModule}
                                                courseStartingAt={courseData?.startingAt || ''}
                                            />
                                        ))
                                    ) : (
                                        /* Legacy flat view — all modules shown, no clipping */
                                        <div className="flex flex-col divide-y divide-base-300/30 p-2">
                                            {modules.map((m, i) => {
                                                const isCompleted = enrollment.completedModules.includes(m.id);
                                                const isActive = activeModule?.id === m.id;
                                                return (
                                                    <button key={m.id} onClick={() => setActiveModule(m)}
                                                        className={`w-full flex items-center gap-4 p-4 text-left relative transition-all rounded-xl ${isActive ? 'bg-primary/10' : 'hover:bg-base-200'}`}>
                                                        <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-[12px] ${isCompleted ? 'bg-success/20 text-success' : isActive ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/50'}`}>
                                                            {isCompleted ? <CheckCircle size={16} /> : (i + 1)}
                                                        </div>
                                                        <div className="flex flex-col flex-grow">
                                                            <span className={`text-xs font-bold leading-snug tracking-wide ${isCompleted ? 'text-base-content/40 line-through' : isActive ? 'text-primary' : 'text-base-content'}`}>{m.title}</span>
                                                            {isActive && <span className="text-[9px] uppercase font-bold tracking-widest text-primary mt-1">Playing</span>}
                                                        </div>
                                                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>{/* end sticky scroll wrapper */}
                    </div>
                </div>
            </div>
        </div>
    );
}
