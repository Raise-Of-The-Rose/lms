
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Play, Pause, Maximize, Loader2, ShieldAlert, RotateCcw, RotateCw, Settings2, Radio } from 'lucide-react';
import YouTube from 'react-youtube';

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

const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
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
                setActivePlayTime(prev => {
                    const newTime = prev + 0.5;
                    if (newTime >= 3 && !hasPassedInitial) setHasPassedInitial(true);
                    return newTime;
                });
                if (total > 0) {
                    setPlayed(current / total);
                    if (current >= total - 25) {
                        player.pauseVideo();
                        setPlaying(false);
                        setIsForceEnded(true);
                        onEnded();
                    }
                }
            }, 500);
        } else {
            setActivePlayTime(0);
        }
        return () => clearInterval(interval);
    }, [playing, player, isForceEnded, onEnded, hasPassedInitial]);

    const handlePlayPause = () => {
        if (!player || isForceEnded) return;
        playing ? player.pauseVideo() : player.playVideo();
        setPlaying(!playing);
        setShowQualityMenu(false);
    };

    const handleSeek = (seconds: number) => {
        if (!player || isForceEnded) return;
        player.seekTo(player.getCurrentTime() + seconds, true);
    };

    const isUIHidden = playing && hasPassedInitial && !isHovering;

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group shadow-lg ring-1 ring-white/5 select-none"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); setShowQualityMenu(false); }}
        >
            <div className="absolute inset-0 z-0 scale-[1.01]">
                <YouTube
                    videoId={videoId || ''}
                    opts={{
                        height: '100%', width: '100%',
                        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, origin: window.location.origin },
                    }}
                    onReady={(e) => { setPlayer(e.target); setBuffering(false); }}
                    onStateChange={(e) => { if (!isForceEnded) { setPlaying(e.data === 1); setBuffering(e.data === 3); } }}
                    className="w-full h-full pointer-events-none"
                />
            </div>

            {/* BLACKOUT LAYER: Instant hide, Smooth reveal */}
            <div className={`absolute inset-0 z-20 bg-zinc-950 pointer-events-none
                ${(!playing || buffering || isForceEnded || (playing && !hasPassedInitial)) ? 'opacity-100 transition-none' : 'opacity-0 transition-opacity duration-700 delay-150'}
            `} />

            {/* UI LAYER */}
            <div className="absolute inset-0 z-30 flex items-center justify-center cursor-pointer" onClick={handlePlayPause}>
                {buffering && <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />}

                {(!playing || (playing && !hasPassedInitial)) && !buffering && !isForceEnded && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-violet-600 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                            <Play size={22} className="text-white fill-current ml-1" />
                        </div>
                        <span className="text-white/50 font-bold text-[9px] uppercase tracking-[0.3em] bg-black/40 px-3 py-1.5 rounded-full border border-white/10">
                            {playing && !hasPassedInitial ? `LINKING (${Math.max(0, Math.ceil(3 - activePlayTime))}s)` : 'Resume'}
                        </span>
                    </div>
                )}

                {isForceEnded && (
                    <div className="text-center bg-zinc-900/90 p-6 rounded-3xl border border-emerald-500/20">
                        <ShieldAlert className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                        <h3 className="text-white font-bold text-lg tracking-tight uppercase">Authorized</h3>
                    </div>
                )}
            </div>

            {/* CONTROLS: Tight & Compact */}
            <div className={`absolute bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-black via-black/40 to-transparent transition-opacity
                ${isUIHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

                <div className="flex flex-col gap-3">
                    <div className="relative h-1 w-full bg-white/10 rounded-full cursor-pointer">
                        <div className="absolute top-0 left-0 h-full bg-violet-500 rounded-full" style={{ width: `${played * 100}%` }} />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <button onClick={(e) => { e.stopPropagation(); handleSeek(-10); }} className="text-white/40 hover:text-white"><RotateCcw size={16} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handlePlayPause(); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-black hover:bg-violet-400">
                                    {playing ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleSeek(10); }} className="text-white/40 hover:text-white"><RotateCw size={16} /></button>
                            </div>

                            <div className="hidden sm:flex items-center gap-1 bg-white/5 p-1 rounded-md border border-white/10">
                                {[1, 1.5, 2].map((rate) => (
                                    <button key={rate} onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); player?.setPlaybackRate(rate); }}
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${playbackRate === rate ? 'bg-violet-600 text-white' : 'text-white/30 hover:text-white'}`}>{rate}x</button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${showQualityMenu ? 'bg-violet-600 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                <Settings2 size={12} /> {quality}
                            </button>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
                                else document.exitFullscreen();
                            }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white"><Maximize size={14} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {showQualityMenu && (
                <div className="absolute bottom-16 right-4 z-50 bg-zinc-900 border border-white/10 rounded-xl p-1 shadow-2xl min-w-[100px]">
                    {['Auto', '1080p', '720p', '480p'].map((q) => (
                        <button key={q} onClick={() => { setQuality(q); setShowQualityMenu(false); player?.setPlaybackQuality(q === '1080p' ? 'hd1080' : q === '720p' ? 'hd720' : 'default'); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold ${quality === q ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:bg-white/5'}`}>{q}</button>
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
    const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
    const [activeModule, setActiveModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser || !courseId) return;
        const fetchData = async () => {
            try {
                const cSnap = await getDoc(doc(db, 'courses', courseId));
                if (cSnap.exists()) setCourseData(cSnap.data());
                const mSnap = await getDocs(query(collection(db, `courses/${courseId}/modules`), orderBy("createdAt", "asc")));
                const fetched = mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
                setModules(fetched);
                if (fetched.length > 0) setActiveModule(fetched[0]);
                const eSnap = await getDocs(query(collection(db, 'enrollments'), where("studentId", "==", currentUser.uid), where("courseId", "==", courseId)));
                if (!eSnap.empty) {
                    const data = eSnap.docs[0].data();
                    if (data.status === 'ENROLLED') setEnrollment({ id: eSnap.docs[0].id, ...data } as Enrollment);
                    else navigate('/dashboard');
                } else navigate('/dashboard');
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

    if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="w-6 h-6 text-violet-600 animate-spin" /></div>;
    if (!enrollment) return null;

    return (
        <div className="max-w-[1200px] mx-auto p-4 lg:p-8 space-y-6 font-sans bg-white min-h-screen">
            <div className="flex flex-col lg:flex-row gap-8">

                {/* Main Section: Scaled down text and paddings */}
                <div className="flex-grow lg:w-2/3 space-y-6">
                    <header>
                        <p className="text-violet-600 font-black uppercase text-[9px] tracking-[0.2em] mb-1">Learning Unit</p>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-zinc-950">{courseData?.title}</h1>
                        <p className="text-zinc-400 font-medium text-sm mt-1">{activeModule?.title}</p>
                    </header>

                    {courseData?.meetLink && (
                        <div className="bg-zinc-950 rounded-2xl p-4 flex justify-between items-center border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-600/10 rounded-xl flex items-center justify-center"><Radio className="text-violet-500 animate-pulse" size={18} /></div>
                                <div>
                                    <h3 className="text-white text-sm font-bold uppercase tracking-tight">Live Session</h3>
                                    <p className="text-zinc-500 text-[9px] font-bold uppercase">{courseData.meetTime || 'Active Now'}</p>
                                </div>
                            </div>
                            <Button size="sm" className="bg-white text-black font-bold hover:bg-violet-400 rounded-lg px-4 h-8 text-[10px]" onClick={() => window.open(courseData.meetLink, '_blank')}>JOIN</Button>
                        </div>
                    )}

                    {activeModule && (
                        <div className="space-y-6">
                            <CustomVideoPlayer key={activeModule.id} url={activeModule.videoUrl} onEnded={() => { handleMarkComplete(activeModule.id); }} />

                            <div className="flex justify-between items-center p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                                <div>
                                    <h4 className="text-sm font-black text-zinc-900 uppercase">Module Progress</h4>
                                    <p className="text-zinc-400 font-bold text-[9px] uppercase mt-0.5">Sync to save status</p>
                                </div>
                                <Button
                                    onClick={() => handleMarkComplete(activeModule.id)}
                                    disabled={enrollment.completedModules.includes(activeModule.id)}
                                    className={`px-6 py-2 h-10 rounded-xl font-bold text-[10px] tracking-widest ${enrollment.completedModules.includes(activeModule.id) ? "bg-emerald-500 text-white" : "bg-zinc-950 text-white hover:bg-violet-600"}`}
                                >
                                    {enrollment.completedModules.includes(activeModule.id) ? 'VALIDATED' : 'COMPLETE MODULE'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar: Scaled down components */}
                <div className="lg:w-1/3 space-y-6">
                    <div className="bg-zinc-950 rounded-2xl p-6 text-white relative overflow-hidden">
                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-2">Progress</p>
                        <div className="flex items-baseline gap-1 mb-4">
                            <h2 className="text-4xl font-black">{enrollment.progress}</h2>
                            <span className="text-violet-600 text-lg font-black">%</span>
                        </div>
                        <Progress value={enrollment.progress} className="h-1.5 bg-white/5" />
                    </div>

                    <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
                        <div className="p-4 bg-zinc-50/50 border-b flex justify-between items-center">
                            <span className="font-bold uppercase text-[9px] tracking-widest text-zinc-400">Syllabus</span>
                            <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{modules.length} Units</span>
                        </div>
                        <div className="flex flex-col divide-y divide-zinc-50 max-h-[400px] overflow-y-auto scrollbar-hide">
                            {modules.map((m, i) => {
                                const isCompleted = enrollment.completedModules.includes(m.id);
                                const isActive = activeModule?.id === m.id;
                                return (
                                    <button key={m.id} onClick={() => setActiveModule(m)} className={`w-full flex items-center gap-3 p-4 text-left relative ${isActive ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'}`}>
                                        <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg font-black text-[10px] ${isCompleted ? 'bg-emerald-500 text-white' : isActive ? 'bg-violet-600 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                            {isCompleted ? <CheckCircle size={14} /> : (i + 1)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-[11px] font-bold leading-tight ${isCompleted ? 'text-zinc-300' : isActive ? 'text-zinc-950' : 'text-zinc-700'}`}>{m.title}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}