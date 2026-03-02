import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus,
  Globe, 
  User, 
  Trash2, 
  Loader2, 
  ExternalLink,
  CheckCircle2,
  X,
  Send,
  Play
} from 'lucide-react';
import { generateAdsFromUrl, generateAdImage, AdContent } from './services/geminiService';

interface Site {
  id: number;
  url: string;
  social_handle: string;
  platform: string;
  posts_completed: number;
  posts_per_day: number;
}

interface Post {
  id: number;
  pipeline_id: number;
  message: string;
  metadata: string;
  created_at: string;
}

export default function App() {
  const [sites, setSites] = useState<Site[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSite, setNewSite] = useState({ url: '', handle: '', platform: 'Instagram', token: '', postsPerDay: 3 });
  const [isAdding, setIsAdding] = useState(false);
  const [demoInitializing, setDemoInitializing] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/pipelines'),
        fetch('/api/activity')
      ]);
      if (sRes.ok) setSites(await sRes.json());
      if (pRes.ok) setPosts(await pRes.json());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: new URL(newSite.url).hostname,
          url: newSite.url,
          social_handle: newSite.handle,
          platform: newSite.platform,
          access_token: newSite.token,
          posts_per_day: newSite.postsPerDay,
          target_posts: 100
        })
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        setNewSite({ url: '', handle: '', platform: 'Instagram', token: '', postsPerDay: 3 });
        fetchData();
        // No longer starting client-side loop; server handles it now
      }
    } finally {
      setIsAdding(false);
    }
  };

  const [demoStages, setDemoStages] = useState<Record<number, string>>({});

  const runDemoCycle = async (site: Site) => {
    const updateStage = (stage: string) => {
      setDemoStages(prev => ({ ...prev, [site.id]: stage }));
    };

    try {
      updateStage('🔍 Reading Website Content...');

      updateStage('🧠 Generating Ad Variants...');
      const ads = await generateAdsFromUrl(site.url, 1);
      if (!ads.length) throw new Error('No ads generated');
      const ad = ads[0];

      updateStage('🎨 Synthesizing Visual Assets...');
      const imageUrl = await generateAdImage(ad.imagePrompt);

      updateStage('🚀 Simulating API Deployment...');
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: site.id,
          type: 'POSTING',
          message: `[DEMO] Successfully deployed to ${site.platform}`,
          metadata: JSON.stringify({ ...ad, imageUrl })
        })
      });

      updateStage('✅ Deployment Successful');
      fetchData();
      setTimeout(() => {
        setDemoStages(prev => {
          const next = { ...prev };
          delete next[site.id];
          return next;
        });
      }, 3000);
    } catch (err) {
      updateStage('❌ Demo Failed: ' + (err instanceof Error ? err.message : err));
      setTimeout(() => {
        setDemoStages(prev => {
          const next = { ...prev };
          delete next[site.id];
          return next;
        });
      }, 5000);
    }
  };

  const deleteSite = async (id: number) => {
    await fetch(`/api/pipelines/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const updatePostsPerDay = async (id: number, current: number, delta: number) => {
    const next = Math.max(1, Math.min(24, current + delta));
    if (next === current) return;
    
    // Optimistic update
    setSites(prev => prev.map(s => s.id === id ? { ...s, posts_per_day: next } : s));
    
    try {
      await fetch(`/api/pipelines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts_per_day: next })
      });
    } catch (e) {
      fetchData(); // Rollback on error
    }
  };

  const [activeGuide, setActiveGuide] = useState<'instagram' | 'twitter' | 'linkedin'>('instagram');

  const guides = {
    instagram: {
      title: 'Instagram Graph API',
      steps: [
        'Create a Facebook Developer account and a new App.',
        'Add the "Instagram Graph API" product to your app.',
        'Connect a Facebook Page to your Instagram Business account.',
        'Use the Graph API Explorer to generate a "User Access Token".',
        'Exchange it for a "Long-lived Access Token" (60 days) in the settings.'
      ],
      link: 'https://developers.facebook.com/docs/instagram-api'
    },
    twitter: {
      title: 'Twitter/X API v2',
      steps: [
        'Apply for a Developer Account at the Twitter Developer Portal.',
        'Create a new Project and an App inside it.',
        'Enable "OAuth 2.0" in the App settings.',
        'Set App permissions to "Read and Write".',
        'Generate your "Bearer Token" or "API Key & Secret".'
      ],
      link: 'https://developer.twitter.com/en/docs/twitter-api'
    },
    linkedin: {
      title: 'LinkedIn Marketing API',
      steps: [
        'Create a company page on LinkedIn if you don\'t have one.',
        'Go to the LinkedIn Developer Portal and create a new App.',
        'Request access to the "Share on LinkedIn" and "Marketing Developer Platform" products.',
        'Verify your app with your company page.',
        'Generate a "Member Access Token" with "w_member_social" permissions.'
      ],
      link: 'https://developer.linkedin.com/is-it-right-for-me'
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-12 pb-24">
      {demoInitializing && (
        <div className="fixed top-0 left-0 w-full h-1 z-[200]">
          <div className="h-full bg-brand-red animate-[progress_2s_ease-in-out_infinite]"></div>
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-brand-red text-white border border-brand-red/30 px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-bounce">
            <Loader2 className="w-3 h-3 animate-spin" />
            INITIALIZING MISSION...
          </div>
        </div>
      )}
      <header className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-brand-black flex items-center gap-2">
            ZETSU <span className="text-brand-red">ADs</span> LOOP <span className="text-[10px] bg-brand-black text-brand-red px-2 py-0.5 rounded-full font-black tracking-normal border border-brand-red/30">v3.0</span>
          </h1>
          <p className="text-slate-500 font-medium">Autonomous Advertising Command Center</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            disabled={demoInitializing}
            onClick={async () => {
              setDemoInitializing(true);
              try {
                const res = await fetch('/api/pipelines', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: 'Apple',
                    url: 'https://apple.com',
                    social_handle: '@apple',
                    platform: 'Instagram',
                    access_token: 'demo_token_123',
                    target_posts: 100
                  })
                });
                if (res.ok) {
                  const siteData = await res.json();
                  await fetchData();
                  // Small delay to let React render the new site card
                  setTimeout(() => {
                    setDemoInitializing(false);
                    const newSite = { id: siteData.id, url: 'https://apple.com', social_handle: '@apple', platform: 'Instagram', posts_completed: 0, posts_per_day: 3 };
                    runDemoCycle(newSite);
                  }, 800);
                }
              } catch (e) {
                setDemoInitializing(false);
                alert('Demo failed to initialize');
              }
            }}
            className="bg-zinc-100 text-brand-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center gap-2 disabled:opacity-50 border border-zinc-200"
          >
            <Play className="w-4 h-4" />
            Quick Demo
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-red text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Deploy New Site
          </button>
        </div>
      </header>

      {/* Dashboard Grid */}
      <div className="grid lg:grid-cols-3 gap-12 items-start">
        {/* Left Column: Active Pipelines */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-brand-gold rounded-full"></div>
              <h2 className="text-2xl font-bold text-brand-black">Active Pipelines</h2>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sites.length} Active</span>
          </div>

          <div className="grid gap-8">
            {sites.map(site => {
              const latestPost = posts.find(p => p.pipeline_id === site.id && p.metadata);
              let meta = null;
              if (latestPost) {
                try { meta = JSON.parse(latestPost.metadata); } catch (e) {}
              }

              return (
                <div 
                  key={site.id} 
                  className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-500 ${
                    demoStages[site.id] ? 'border-brand-gold ring-4 ring-brand-gold/10 scale-[1.01]' : 'border-zinc-200'
                  }`}
                >
                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                          <Globe className="w-5 h-5 text-brand-gold" />
                          {site.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                          <User className="w-4 h-4" />
                          {site.social_handle} • {site.platform}
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(255,215,0,0.5)]"></div>
                            <span className="text-[10px] font-bold text-brand-black uppercase tracking-wider">Engine Online</span>
                          </div>
                          <div className="flex items-center bg-zinc-100 rounded-lg border border-zinc-200 overflow-hidden">
                            <button 
                              onClick={() => updatePostsPerDay(site.id, site.posts_per_day, -1)}
                              className="px-2 py-1 hover:bg-zinc-200 text-brand-black/40 hover:text-brand-black transition-colors border-r border-zinc-200"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-3 py-1 text-[10px] font-black text-brand-black uppercase tracking-tight">
                              {site.posts_per_day} Posts / Day
                            </span>
                            <button 
                              onClick={() => updatePostsPerDay(site.id, site.posts_per_day, 1)}
                              className="px-2 py-1 hover:bg-zinc-200 text-brand-black/40 hover:text-brand-black transition-colors border-l border-zinc-200"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {demoStages[site.id] && (
                          <div className="pt-2">
                            <span className="bg-brand-gold text-brand-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter animate-pulse border border-brand-black/10">
                              MISSION IN PROGRESS
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {demoStages[site.id] ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-lg border border-zinc-100">
                            <Loader2 className="w-3 h-3 animate-spin text-brand-gold" />
                            <span className="text-[10px] font-bold text-brand-black uppercase tracking-tight">{demoStages[site.id]}</span>
                          </div>
                        ) : (
                          <button 
                            onClick={() => runDemoCycle(site)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 text-brand-black rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors border border-zinc-200"
                          >
                            <Play className="w-3 h-3" />
                            Test Cycle
                          </button>
                        )}
                        <button 
                          onClick={() => deleteSite(site.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Attached Latest Post */}
                    {meta && (
                      <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex flex-col md:flex-row gap-4 group">
                        <div className="w-full md:w-40 aspect-square bg-slate-200 flex-shrink-0 overflow-hidden">
                          <img 
                            src={meta.imageUrl} 
                            alt={meta.headline} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="p-4 flex flex-col justify-center space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black bg-brand-red text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Latest Gen</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(latestPost.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">{meta.headline}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{meta.body}</p>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-4">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Activity Stream</h3>
                      <div className="space-y-2">
                        {posts.filter(p => p.pipeline_id === site.id).slice(0, 5).map(post => (
                          <div key={post.id} className="flex items-center justify-between text-[11px] bg-slate-50/50 p-2 rounded-lg border border-slate-50">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-brand-gold flex-shrink-0" />
                              <span className="text-slate-600 font-medium truncate max-w-[200px]">{post.message}</span>
                            </div>
                            <span className="text-[9px] text-slate-300 font-bold uppercase">
                              {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                        {posts.filter(p => p.pipeline_id === site.id).length === 0 && (
                          <p className="text-xs text-slate-400 italic py-2">Initializing autonomous agent...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {sites.length === 0 && (
              <div className="py-24 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 gap-4 bg-slate-50/50">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <Globe className="w-8 h-8 text-slate-200" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-bold text-slate-900">No Active Pipelines</p>
                  <p className="text-sm">Deploy a new site or try the demo to see it in action.</p>
                </div>
                <button 
                  disabled={demoInitializing}
                  onClick={async () => {
                    setDemoInitializing(true);
                    try {
                      const res = await fetch('/api/pipelines', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: 'Apple',
                          url: 'https://apple.com',
                          social_handle: '@apple',
                          platform: 'Instagram',
                          access_token: 'demo_token_123',
                          target_posts: 100
                        })
                      });
                      if (res.ok) {
                        const siteData = await res.json();
                        await fetchData();
                        setTimeout(() => {
                          setDemoInitializing(false);
                          const newSite = { id: siteData.id, url: 'https://apple.com', social_handle: '@apple', platform: 'Instagram', posts_completed: 0, posts_per_day: 3 };
                          runDemoCycle(newSite);
                        }, 800);
                      }
                    } catch (e) {
                      setDemoInitializing(false);
                    }
                  }}
                  className="bg-brand-black text-brand-gold px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-900 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm border border-brand-gold/20"
                >
                  <Play className="w-4 h-4" />
                  Run Quick Demo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Ad Deployments (Feed Style) */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-8 bg-brand-gold rounded-full"></div>
              <h2 className="text-2xl font-bold text-brand-black">Live Feed</h2>
            </div>
            <span className="text-[10px] font-black text-brand-red uppercase tracking-widest animate-pulse">Live</span>
          </div>
          
          <div className="space-y-6">
            {posts.filter(p => {
              try {
                if (!p.metadata) return false;
                const m = JSON.parse(p.metadata);
                return m.imageUrl && m.headline;
              } catch { return false; }
            }).slice(0, 5).map(post => {
              const meta = JSON.parse(post.metadata);
              const site = sites.find(s => s.id === post.pipeline_id);
              return (
                <div key={post.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group">
                  <div className="aspect-[16/9] bg-slate-100 relative overflow-hidden">
                    <img 
                      src={meta.imageUrl} 
                      alt={meta.headline} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3">
                      <div className="bg-brand-black/90 backdrop-blur px-2 py-1 rounded-lg text-[9px] font-black text-brand-gold uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-brand-gold/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></div>
                        {site?.platform || 'Social'}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-brand-red truncate max-w-[150px]">
                        {site?.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}
                      </span>
                      <span className="text-[9px] font-medium text-slate-300 uppercase">
                        {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">{meta.headline}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{meta.body}</p>
                  </div>
                </div>
              );
            })}
            {posts.filter(p => p.metadata).length === 0 && (
              <div className="py-12 border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3 bg-zinc-50/50">
                <Loader2 className="w-6 h-6 animate-spin text-brand-gold" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Awaiting Stream...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* API Setup Guide */}
      <section className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-3xl font-bold text-brand-black">About Zetsu ADs Loop</h2>
          <p className="text-slate-600 leading-relaxed">
            Zetsu ADs Loop is an autonomous agent that bridges the gap between your product and your audience. 
            It analyzes your website in real-time, synthesizes high-converting ad copy and visuals, 
            and deploys them directly to your social media channels using official APIs.
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-brand-gold rounded-full"></div>
            <h3 className="text-lg font-bold text-brand-black">API Setup Guide</h3>
          </div>

          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            {(['instagram', 'twitter', 'linkedin'] as const).map((id) => (
              <button
                key={id}
                onClick={() => setActiveGuide(id)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                  activeGuide === id ? 'bg-brand-gold text-brand-black shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="space-y-6">
              <h4 className="text-xl font-bold text-slate-900">{guides[activeGuide].title}</h4>
              <ul className="space-y-4">
                {guides[activeGuide].steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-gold/10 text-brand-black text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ul>
              <a 
                href={guides[activeGuide].link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-red font-bold text-sm hover:underline"
              >
                Official Documentation <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">Security Note</p>
                  <p className="text-sm font-bold text-slate-900">Encrypted Storage</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Zetsu ADs Loop stores your access tokens using industry-standard encryption. 
                Tokens are only used during the autonomous deployment cycle and are never exposed in client-side logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Add New Site</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddSite} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Website URL</label>
                <input 
                  required
                  type="url"
                  placeholder="https://example.com"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-gold outline-none"
                  value={newSite.url}
                  onChange={e => setNewSite({...newSite, url: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Social Handle</label>
                <input 
                  required
                  placeholder="@yourbrand"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-gold outline-none"
                  value={newSite.handle}
                  onChange={e => setNewSite({...newSite, handle: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Platform</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-gold outline-none"
                  value={newSite.platform}
                  onChange={e => setNewSite({...newSite, platform: e.target.value})}
                >
                  <option>Instagram</option>
                  <option>Twitter</option>
                  <option>LinkedIn</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Daily Posting Frequency</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="24" 
                        step="1"
                        className="flex-1 accent-brand-gold"
                        value={newSite.postsPerDay}
                        onChange={e => setNewSite({...newSite, postsPerDay: parseInt(e.target.value)})}
                      />
                      <span className="w-12 text-center font-bold text-brand-black bg-brand-gold py-1 rounded-lg border border-brand-gold/30">
                        {newSite.postsPerDay}
                      </span>
                    </div>
                <p className="text-[10px] text-slate-400">How many ads should Zetsu ADs Loop deploy every 24 hours? (Max 24)</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">API Access Token / Key</label>
                <input 
                  required
                  type="password"
                  placeholder="Paste your social API token here"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-gold outline-none"
                  value={newSite.token}
                  onChange={e => setNewSite({...newSite, token: e.target.value})}
                />
                <p className="text-[10px] text-slate-400">Required for autonomous posting to {newSite.platform}.</p>
              </div>
              <button 
                disabled={isAdding}
                className="w-full bg-brand-red text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-red-200"
              >
                {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Start Loop</>}
              </button>
            </form>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { width: 0; left: 0; }
          50% { width: 100%; left: 0; }
          100% { width: 0; left: 100%; }
        }
      `}} />
    </div>
  );
}
