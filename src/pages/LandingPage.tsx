import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, Target, TrendingUp, Brain, GraduationCap, Briefcase, Rocket, UserCog, ArrowRight, ChevronDown } from 'lucide-react';

const LOGO_URL = 'https://res.cloudinary.com/dq6c78y00/image/upload/v1773143625/IMG-20260309-WA0007_w2sywa.jpg';

export default function LandingPage() {
    const { currentUser } = useAuth();

    const studentDashboardLink = currentUser?.role === 'ADMIN' ? '/admin'
        : currentUser?.role === 'TRAINER' ? '/trainer'
            : '/dashboard';

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-base-100 font-sans">
            {/* SEO Meta - handled via index.html, but title changes dynamically */}

            {/* ── NAVBAR ── */}
            <header className="navbar bg-base-100/80 backdrop-blur-lg sticky top-0 z-50 border-b border-base-200 shadow-sm px-4 md:px-8">
                <div className="navbar-start">
                    <Link to="/" className="flex items-center gap-2">
                        <img src={LOGO_URL} alt="SkillNet Logo" className="h-10 w-auto rounded-lg object-contain" />
                    </Link>
                </div>
                <div className="navbar-center hidden md:flex">
                    <ul className="menu menu-horizontal gap-1 text-sm font-semibold">
                        <li><button onClick={() => scrollToSection('about')} className="rounded-lg">About</button></li>
                        <li><button onClick={() => scrollToSection('features')} className="rounded-lg">Features</button></li>
                        <li><button onClick={() => scrollToSection('who')} className="rounded-lg">Who It's For</button></li>
                        <li><button onClick={() => scrollToSection('philosophy')} className="rounded-lg">Philosophy</button></li>
                    </ul>
                </div>
                <div className="navbar-end gap-3">
                    {currentUser ? (
                        <Link to={studentDashboardLink} className="btn btn-primary btn-sm gap-2">
                            <BookOpen className="w-4 h-4" /> My Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-ghost btn-sm font-semibold">Log In</Link>
                            <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
                        </>
                    )}
                </div>
            </header>

            {/* ── HERO ── */}
            <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden" aria-labelledby="hero-heading">
                {/* Background blobs */}
                <div className="absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute -top-40 -left-40 w-[700px] h-[700px] bg-primary/10 rounded-full blur-[120px]" />
                    <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px]" />
                </div>

                <div className="max-w-4xl mx-auto space-y-6 animate-[fadeInUp_0.8s_ease-out]">
                    <div className="flex justify-center mb-2">
                        <span className="badge badge-primary badge-outline px-4 py-3 text-xs font-black uppercase tracking-widest">
                            🚀 Real Skills. Real Growth.
                        </span>
                    </div>

                    <h1 id="hero-heading" className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
                        Where{' '}
                        <span className="text-primary relative inline-block">
                            True Skills
                            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 8" fill="none">
                                <path d="M0 6 Q75 0 150 5 Q225 10 300 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </span>
                        {' '}Are Built
                    </h1>

                    <p className="text-xl md:text-2xl text-base-content/70 font-medium max-w-2xl mx-auto leading-relaxed">
                        Most online platforms promise certificates.<br />
                        <strong className="text-base-content">We promise real growth.</strong>
                    </p>

                    <p className="text-base-content/60 max-w-xl mx-auto text-base">
                        SkillNet is built for people who genuinely want to learn, improve, and master skills that matter in the real world.
                        No certificates. No shortcuts. Just true learning.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                        {currentUser ? (
                            <Link to={studentDashboardLink} className="btn btn-primary btn-lg gap-2 shadow-lg shadow-primary/30">
                                Explore Courses <ArrowRight className="w-5 h-5" />
                            </Link>
                        ) : (
                            <>
                                <Link to="/register" className="btn btn-primary btn-lg gap-2 shadow-lg shadow-primary/30">
                                    Start Learning Today <ArrowRight className="w-5 h-5" />
                                </Link>
                                <Link to="/login" className="btn btn-outline btn-lg">
                                    Log In
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 pt-6 text-sm text-base-content/50 font-medium">
                        <span className="flex items-center gap-1.5">✅ No Certificate Pressure</span>
                        <span className="flex items-center gap-1.5">✅ Skill-First Approach</span>
                        <span className="flex items-center gap-1.5">✅ Flexible Monthly Plans</span>
                    </div>
                </div>

                <button
                    onClick={() => scrollToSection('about')}
                    className="absolute bottom-5 animate-bounce text-base-content/30 hover:text-primary transition-colors"
                    aria-label="Scroll to learn more"
                >
                    <ChevronDown className="w-8 h-8" />
                </button>
            </section>

            {/* ── ABOUT ── */}
            <section id="about" className="py-24 px-4 bg-base-200" aria-labelledby="about-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="badge badge-secondary badge-outline px-4 py-3 text-xs font-black uppercase tracking-widest mb-4">Our Story</span>
                        <h2 id="about-heading" className="text-4xl md:text-5xl font-black tracking-tighter mt-3">Why SkillNet Exists</h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-5 text-base-content/80 text-lg leading-relaxed">
                            <p>
                                Today, many online learning platforms focus on certificates and credentials.
                                But the truth is —{' '}
                                <strong className="text-base-content">a certificate doesn't always mean real knowledge.</strong>
                            </p>
                            <p>
                                Many students enroll in courses simply to collect certificates and for the brand name, not to actually build the skill.
                            </p>
                            <p>
                                <strong className="text-base-content">SkillNet was created to change that.</strong>
                            </p>
                            <p>
                                This platform is designed for students and working professionals who want to genuinely improve their abilities,
                                explore new fields, and grow their expertise — not just collect digital badges.
                            </p>
                        </div>

                        <div className="bg-base-100 rounded-3xl p-8 shadow-xl border border-base-300">
                            <p className="text-2xl font-black tracking-tight text-primary italic mb-2">" Here, the goal is simple:"</p>
                            <ul className="space-y-3 mt-6 text-base font-semibold">
                                <li className="flex items-center gap-3"><span className="text-primary text-xl">→</span> Learn something real.</li>
                                <li className="flex items-center gap-3"><span className="text-secondary text-xl">→</span> Practice it consistently.</li>
                                <li className="flex items-center gap-3"><span className="text-accent text-xl">→</span> Apply it in the real world.</li>
                                <li className="flex items-center gap-3"><span className="text-success text-xl">→</span> Grow beyond your limits.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── WHAT MAKES US DIFFERENT ── */}
            <section id="features" className="py-24 px-4 bg-base-100" aria-labelledby="features-heading">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="badge badge-primary badge-outline px-4 py-3 text-xs font-black uppercase tracking-widest mb-4">Our Approach</span>
                        <h2 id="features-heading" className="text-4xl md:text-5xl font-black tracking-tighter mt-3">What Makes SkillNet Different</h2>
                        <p className="text-base-content/60 mt-4 text-lg max-w-xl mx-auto">
                            We built a platform for people who value mastery over medals.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: <BookOpen className="w-7 h-7" />,
                                color: 'text-error bg-error/10',
                                badge: '🚫 No Certificates',
                                title: 'Zero Certificate Culture',
                                desc: 'SkillNet does not provide certificates for completing courses. Because real skill speaks louder than a piece of paper.',
                            },
                            {
                                icon: <Target className="w-7 h-7" />,
                                color: 'text-primary bg-primary/10',
                                badge: '🎯 Skill-Focused',
                                title: 'Skill-First Learning',
                                desc: 'Every course is designed to help you understand, practice, and apply what you learn — not to pass a test.',
                            },
                            {
                                icon: <TrendingUp className="w-7 h-7" />,
                                color: 'text-success bg-success/10',
                                badge: '📈 Continuous Growth',
                                title: 'Always Relevant',
                                desc: 'Whether you\'re a student or a professional, SkillNet helps you upgrade your abilities and stay relevant in a fast-changing world.',
                            },
                            {
                                icon: <Brain className="w-7 h-7" />,
                                color: 'text-secondary bg-secondary/10',
                                badge: '🧠 Learn with Purpose',
                                title: 'Knowledge over Recognition',
                                desc: 'A platform for people who value knowledge over recognition and mastery over medals. Learn with intention.',
                            },
                        ].map((f, i) => (
                            <div key={i} className="card bg-base-100 border border-base-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className="card-body p-7">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${f.color}`}>
                                        {f.icon}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{f.badge}</span>
                                    <h3 className="card-title text-lg font-black mt-1">{f.title}</h3>
                                    <p className="text-base-content/60 text-sm leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── WHO IT'S FOR ── */}
            <section id="who" className="py-24 px-4 bg-base-200" aria-labelledby="who-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="badge badge-accent badge-outline px-4 py-3 text-xs font-black uppercase tracking-widest mb-4">Your Fit</span>
                        <h2 id="who-heading" className="text-4xl md:text-5xl font-black tracking-tighter mt-3">Who SkillNet Is For</h2>
                        <p className="text-base-content/60 mt-4 text-lg max-w-xl mx-auto">
                            If you want certificates, there are many platforms for that. If you want real skills, you're in the right place.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: <GraduationCap className="w-8 h-8" />, label: 'Students', desc: 'Real knowledge beyond textbooks', color: 'badge-primary' },
                            { icon: <Briefcase className="w-8 h-8" />, label: 'Professionals', desc: 'Upgrade skills, stay competitive', color: 'badge-secondary' },
                            { icon: <Rocket className="w-8 h-8" />, label: 'Career Switchers', desc: 'Explore new opportunities', color: 'badge-accent' },
                            { icon: <UserCog className="w-8 h-8" />, label: 'Curious Learners', desc: 'Learn for the love of it', color: 'badge-success' },
                        ].map((p, i) => (
                            <div key={i} className="card bg-base-100 border border-base-200 shadow hover:shadow-lg hover:-translate-y-1 transition-all duration-300 text-center">
                                <div className="card-body items-center py-10">
                                    <div className="text-primary mb-3">{p.icon}</div>
                                    <span className={`badge ${p.color} badge-sm font-bold mb-2`}>{p.label}</span>
                                    <p className="text-base-content/60 text-sm">{p.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PHILOSOPHY ── */}
            <section id="philosophy" className="py-24 px-4 bg-base-100 relative overflow-hidden" aria-labelledby="philosophy-heading">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px]" />
                </div>
                <div className="max-w-3xl mx-auto text-center">
                    <span className="badge badge-neutral badge-outline px-4 py-3 text-xs font-black uppercase tracking-widest mb-4">Our Belief</span>
                    <h2 id="philosophy-heading" className="text-4xl md:text-5xl font-black tracking-tighter mt-3 mb-8">Our Philosophy</h2>

                    <blockquote className="bg-primary/5 border-l-4 border-primary rounded-r-2xl p-8 text-left mb-10 shadow">
                        <p className="text-2xl font-black italic tracking-tight text-base-content">
                            "Skills create opportunities.<br />
                            <span className="text-primary">Certificates only document them.</span>"
                        </p>
                        <footer className="mt-4 text-sm text-base-content/50 font-semibold">— SkillNet Team</footer>
                    </blockquote>

                    <p className="text-base-content/70 text-lg leading-relaxed max-w-xl mx-auto">
                        The world doesn't reward certificates — it rewards{' '}
                        <strong className="text-base-content">capability, creativity, and competence.</strong>
                        {' '}That's why SkillNet focuses on learning that truly matters.
                    </p>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-24 px-4 bg-primary text-primary-content relative overflow-hidden" aria-labelledby="cta-heading">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-white rounded-full" />
                    <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-white rounded-full" />
                </div>
                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <h2 id="cta-heading" className="text-4xl md:text-6xl font-black tracking-tighter mb-4">
                        Ready to Build Real Skills?
                    </h2>
                    <p className="text-primary-content/80 text-xl mb-10 max-w-xl mx-auto">
                        Join SkillNet and start your journey toward genuine mastery — not just a certificate.
                    </p>
                    {currentUser ? (
                        <Link to={studentDashboardLink} className="btn btn-lg bg-white text-primary font-black gap-2 border-none hover:bg-white/90 shadow-2xl">
                            Explore Skills <ArrowRight className="w-5 h-5" />
                        </Link>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/register" className="btn btn-lg bg-white text-primary font-black gap-2 border-none hover:bg-white/90 shadow-2xl">
                                Join SkillNet Free <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link to="/login" className="btn btn-lg btn-outline border-primary-content/50 text-primary-content hover:bg-primary-content/10">
                                Log In
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="bg-base-200 py-10 px-4 text-center border-t border-base-300">
                <div className="flex justify-center mb-4">
                    <img src={LOGO_URL} alt="SkillNet" className="h-10 rounded-lg object-contain" />
                </div>
                <p className="text-base-content/50 text-sm font-medium">
                    © {new Date().getFullYear()} SkillNet. Where True Skills Are Built.
                </p>
                <div className="flex justify-center gap-6 mt-4 text-xs font-bold uppercase tracking-widest text-base-content/40">
                    <Link to="/login" className="hover:text-primary transition-colors">Login</Link>
                    <Link to="/register" className="hover:text-primary transition-colors">Register</Link>
                </div>
            </footer>
        </div>
    );
}
