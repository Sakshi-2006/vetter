'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, Bell, BriefcaseBusiness, ChevronDown, CircleHelp, FileText, Filter, Gauge, GraduationCap, Info, LayoutDashboard, ListChecks, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Upload, Users, X } from 'lucide-react'

type Candidate = { name: string; initials: string; role: string; location: string; experience: number; skills: string[]; score: number; note: string; source: string; status: 'Strong match' | 'Review' | 'Missing must-have' }
const initialCandidates: Candidate[] = [
  { name: 'Maya Chen', initials: 'MC', role: 'Senior Data Analyst · Stripe', location: 'San Francisco, CA', experience: 5, skills: ['SQL', 'Python', 'Tableau', 'Experimentation'], score: 94, note: 'Strong SQL and analytics experience; exceeds 3-year requirement.', source: 'maya_chen_resume.pdf', status: 'Strong match' },
  { name: 'Jordan Lee', initials: 'JL', role: 'Data Analyst · Notion', location: 'New York, NY', experience: 4, skills: ['SQL', 'Python', 'Looker', 'A/B testing'], score: 87, note: 'Meets core skills; BI tooling is adjacent to the requested stack.', source: 'jordan_lee_resume.pdf', status: 'Strong match' },
  { name: 'Amara Okafor', initials: 'AO', role: 'Analytics Engineer · Figma', location: 'Remote · US', experience: 3, skills: ['SQL', 'dbt', 'Python', 'BigQuery'], score: 81, note: 'Relevant analytics depth; no Tableau evidence found in resume.', source: 'amara_okafor_resume.docx', status: 'Review' },
  { name: 'Noah Williams', initials: 'NW', role: 'Business Analyst · Asana', location: 'Austin, TX', experience: 2, skills: ['Excel', 'SQL', 'Power BI'], score: 68, note: 'Strong reporting foundation; Python requirement is not evidenced.', source: 'noah_williams_resume.pdf', status: 'Missing must-have' },
  { name: 'Sofia Martinez', initials: 'SM', role: 'Product Analyst · Duolingo', location: 'Pittsburgh, PA', experience: 4, skills: ['Python', 'SQL', 'Amplitude', 'Statistics'], score: 76, note: 'Good experimentation background; review SQL depth and BI experience.', source: 'sofia_martinez_resume.pdf', status: 'Review' },
]
const requirements = ['SQL', 'Python', 'Tableau', 'Experimentation']
const statusStyle: Record<Candidate['status'], string> = { 'Strong match': 'status-strong', Review: 'status-review', 'Missing must-have': 'status-gap' }

export default function Page() {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All candidates')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [notice, setNotice] = useState('')
  const [sortHigh, setSortHigh] = useState(true)
  const [activeNav, setActiveNav] = useState('Overview')
  const [threshold, setThreshold] = useState(70)

  const ranked = useMemo(() => candidates.filter((person) => {
    const matchesQuery = `${person.name} ${person.role} ${person.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All candidates' || (filter === 'Shortlist' ? person.score >= threshold : person.status === 'Missing must-have')
    return matchesQuery && matchesFilter
  }).sort((a, b) => sortHigh ? b.score - a.score : a.score - b.score), [candidates, query, filter, sortHigh, threshold])

  function addFiles(files: FileList | null) {
    if (!files?.length) return
    const added: Candidate[] = Array.from(files).map((file) => {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      return { name, initials: name.split(' ').map((part) => part[0]).slice(0, 2).join(''), role: 'New applicant · Resume uploaded', location: 'Location not provided', experience: 0, skills: [], score: 0, note: 'Resume queued for parsing. Connect the FastAPI backend to calculate a screening score.', source: file.name, status: 'Review' }
    })
    setCandidates((previous) => [...added, ...previous])
    setShowUpload(false)
    setNotice(`${added.length} resume${added.length === 1 ? '' : 's'} added to the review queue`)
    window.setTimeout(() => setNotice(''), 3500)
  }

  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    const rows = [['Candidate', 'Role', 'Score', 'Status', 'Matched skills', 'Explanation', 'Source'], ...ranked.map((person) => [person.name, person.role, `${person.score}%`, person.status, person.skills.join('; '), person.note, person.source])]
    const csv = rows.map((row) => row.map(escape).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'candidate-screening-report.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Talent Lens home"><span className="brand-mark"><Sparkles size={18} /></span><span>talent<span className="brand-light">lens</span></span></a>
        <div className="workspace-switch"><span className="workspace-avatar">N</span><span className="workspace-name"><strong>Northstar Labs</strong><small>Recruiting team</small></span><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {[['Overview', LayoutDashboard], ['Candidates', Users], ['Jobs', BriefcaseBusiness], ['Reports', ListChecks]].map(([label, Icon]) => {
            const name = label as string
            const IconComponent = Icon as typeof LayoutDashboard
            return <button key={name} className={`nav-item ${activeNav === name ? 'nav-active' : ''}`} onClick={() => setActiveNav(name)}><IconComponent size={17} /><span>{name}</span>{name === 'Candidates' && <span className="nav-count">{candidates.length}</span>}</button>
          })}
        </nav>
        <div className="nav-label jobs-label">ACTIVE ROLE</div>
        <button className="role-link" onClick={() => setNotice('Viewing applicants for Senior Data Analyst')}><span className="role-dot" /><span><strong>Senior Data Analyst</strong><small>San Francisco · 24 applicants</small></span><ChevronDown size={14} /></button>
        <div className="sidebar-bottom"><div className="ethical-card"><ShieldCheck size={17} /><p><strong>Human-first hiring</strong><span>Scores support review, never replace it.</span></p></div><button className="nav-item"><Settings2 size={17} /><span>Settings</span></button><button className="profile-row"><span className="profile-avatar">AR</span><span><strong>Alex Rivera</strong><small>Recruiter</small></span><ChevronDown size={14} /></button></div>
      </aside>

      <section className="main-area" id="overview">
        <header className="topbar"><div className="crumb">Hiring <span>/</span> <strong>{activeNav}</strong></div><div className="topbar-actions"><span className="demo-pill"><span /> Demo workspace</span><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button><span className="profile-avatar top-avatar">AR</span></div></header>
        <div className="content-wrap">
          <div className="page-heading"><div><div className="eyebrow">TALENT OVERVIEW <span>·</span> MONDAY, MAY 19</div><h1>Good morning, Alex <span className="wave">✳</span></h1><p>Here&apos;s what&apos;s happening with your open roles today.</p></div><button className="primary-button" onClick={() => setShowUpload(true)}><Upload size={16} /> Add resumes</button></div>

          <section className="role-banner"><div className="role-icon"><BriefcaseBusiness size={20} /></div><div className="role-title"><span>OPEN ROLE</span><h2>Senior Data Analyst</h2><p>Product &amp; Insights <span>·</span> San Francisco, CA <span>·</span> Posted 12 days ago</p></div><div className="role-banner-meta"><div><strong>24</strong><span>Applicants</span></div><div><strong>3</strong><span>Days to review</span></div></div><button className="subtle-button" onClick={() => setNotice('Job description panel is ready to connect')}><span>View job</span><ArrowUpRight size={15} /></button></section>

          <section className="metrics-grid" aria-label="Candidate overview">
            <article className="metric-card"><div className="metric-top"><span>Total applicants</span><Users size={17} /></div><div className="metric-number">{24 + Math.max(0, candidates.length - 5)}<span className="metric-change">+6 this week</span></div><div className="metric-foot">Across 1 open role</div><div className="mini-bars" aria-hidden="true">{[24, 39, 29, 54, 42, 63, 46, 70, 55, 77, 57, 85].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></article>
            <article className="metric-card"><div className="metric-top"><span>Strong matches</span><Gauge size={17} /></div><div className="metric-number">{candidates.filter((person) => person.score >= 80).length}<span className="metric-change">of {candidates.length} reviewed</span></div><div className="metric-foot">Score of 80 or above</div><div className="metric-progress"><i style={{ width: `${Math.max(5, candidates.filter((person) => person.score >= 80).length / candidates.length * 100)}%` }} /></div></article>
            <article className="metric-card"><div className="metric-top"><span>Need your review</span><Info size={17} /></div><div className="metric-number">{candidates.filter((person) => person.status === 'Review').length}<span className="metric-change muted-change">candidates</span></div><div className="metric-foot">Require human evaluation</div><div className="review-avatars"><span>AO</span><span>SM</span><span className="more-avatar">+2</span><small>Waiting for your review</small></div></article>
            <article className="metric-card"><div className="metric-top"><span>Missing a must-have</span><GraduationCap size={17} /></div><div className="metric-number">{candidates.filter((person) => person.status === 'Missing must-have').length}<span className="metric-change muted-change">flagged for review</span></div><div className="metric-foot">Not auto-rejected</div><div className="missing-note"><span /> Check the evidence before deciding</div></article>
          </section>

          <section className="candidate-section"><div className="section-heading"><div><h2>Candidate review</h2><p>Ranked by role fit to help you prioritize — not make decisions for you.</p></div><button className="text-button" onClick={() => setThreshold((current) => current === 70 ? 80 : 70)}><SlidersHorizontal size={15} /> Tune criteria</button></div>
            <div className="criteria-strip"><div className="criteria-title"><Sparkles size={15} /><strong>Role criteria</strong><span>Based on job description</span></div><div className="criteria-skills">{requirements.map((skill) => <span className="skill-chip" key={skill}><i />{skill}</span>)}</div><button className="criteria-edit" onClick={() => setNotice(`Shortlist threshold: ${threshold}%`)}>Min. {threshold}% <ChevronDown size={13} /></button><button className="criteria-info" aria-label="Criteria information" title="Scores are decision-support signals only"><Info size={15} /></button></div>
            <div className="table-toolbar"><div className="candidate-count"><strong>{ranked.length}</strong> candidates <span>·</span> Updated just now</div><div className="table-actions"><label className="search-field"><Search size={15} /><input aria-label="Search candidates" placeholder="Search candidates..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label><select aria-label="Filter candidates" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All candidates</option><option>Shortlist</option><option>Missing must-have</option></select><button className="filter-button" aria-label="Filter candidates"><Filter size={15} /></button><button className="export-button" onClick={exportCsv}><ArrowDownToLine size={15} /> Export</button></div></div>
            <div className="table-scroll"><table className="candidate-table"><thead><tr><th> CANDIDATE</th><th><button className="sort-head" onClick={() => setSortHigh((value) => !value)}>ROLE FIT <ChevronDown size={12} className={sortHigh ? '' : 'flip-icon'} /></button></th><th>MATCHED SKILLS</th><th>EXPERIENCE</th><th>REVIEW STATUS</th><th aria-label="Details" /></tr></thead><tbody>{ranked.map((person) => <tr key={`${person.name}-${person.source}`} onClick={() => setSelected(person)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelected(person) }}><td><div className="candidate-identity"><span className={`candidate-avatar avatar-${person.initials.charCodeAt(0) % 5}`}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.role}</small></span></div></td><td><div className="score-cell"><strong className={person.score >= 80 ? 'score-high' : person.score === 0 ? 'score-empty' : ''}>{person.score ? `${person.score}%` : '—'}</strong>{person.score > 0 && <span className="score-track"><i style={{ width: `${person.score}%` }} /></span>}</div></td><td><div className="skill-list">{person.skills.length ? person.skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>) : <span className="no-skills">Pending parse</span>}{person.skills.length > 3 && <small>+{person.skills.length - 3}</small>}</div></td><td><span className="experience-cell">{person.experience ? `${person.experience} years` : '—'}</span></td><td><span className={`status-pill ${statusStyle[person.status]}`}><i />{person.status}</span></td><td><button className="row-detail" aria-label={`Review ${person.name}`}><ArrowUpRight size={15} /></button></td></tr>)}</tbody></table>{ranked.length === 0 && <div className="empty-table"><Search size={20} /><strong>No candidates found</strong><span>Try a different search or filter.</span></div>}</div>
            <div className="table-footer"><span>Showing <strong>{ranked.length}</strong> of {candidates.length} candidates</span><button onClick={() => { setFilter('All candidates'); setQuery('') }}>View all candidates <ArrowUpRight size={14} /></button></div>
          </section>
          <div className="footnote"><ShieldCheck size={15} /><span><strong>People make the decisions.</strong> Scores reflect resume evidence against role criteria and may be incomplete or inaccurate. Review every applicant fairly.</span><button onClick={() => setNotice('Fair hiring guidance: evaluate job-related evidence only.')}>Learn about fair hiring</button></div>
        </div>
      </section>

      {showUpload && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowUpload(false) }}><section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><button className="modal-close" onClick={() => setShowUpload(false)} aria-label="Close"><X size={18} /></button><div className="upload-icon"><FileText size={22} /></div><h2 id="upload-title">Add candidate resumes</h2><p>Upload PDF, DOCX, or TXT files to add them to this role&apos;s review queue.</p><label className="dropzone"><Upload size={22} /><strong>Choose files to upload</strong><span>PDF, DOCX or TXT · Up to 10 MB each</span><input type="file" multiple accept=".pdf,.docx,.txt" onChange={(event) => addFiles(event.target.files)} /></label><div className="modal-disclaimer"><ShieldCheck size={15} /> Demo mode: files are not transmitted or stored. Connect the API for parsing.</div></section></div>}
      {selected && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close" onClick={() => setSelected(null)} aria-label="Close"><X size={18} /></button><div className="detail-person"><span className="candidate-avatar detail-avatar">{selected.initials}</span><div><div className="eyebrow">CANDIDATE REVIEW</div><h2 id="detail-title">{selected.name}</h2><p>{selected.role}</p></div></div><div className="detail-score"><div><span>Role fit signal</span><strong>{selected.score || '—'}{selected.score ? '%' : ''}</strong></div><div className="detail-bar"><i style={{ width: `${selected.score}%` }} /></div><span className={`status-pill ${statusStyle[selected.status]}`}><i />{selected.status}</span></div><h3>Evidence summary</h3><p className="detail-note">{selected.note}</p><h3>Skills identified</h3><div className="detail-skills">{selected.skills.length ? selected.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>Resume parsing pending</span>}</div><p className="detail-source"><FileText size={14} /> {selected.source}</p><div className="detail-human"><ShieldCheck size={16} /><span>This is a decision-support signal, not an automated hiring recommendation. Review the original resume and assess the full application.</span></div><button className="primary-button detail-done" onClick={() => setSelected(null)}>Close review</button></section></div>}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </main>
  )
}
