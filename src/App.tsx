
import { useState } from 'react'
import './App.css'

type Sport = 'All sports' | 'Football' | 'Basketball' | 'Tennis'
type Session = 'Daytime' | 'Overnight'
type View = 'Overview' | 'Predictions' | 'Ticket Builder' | 'Performance' | 'Data Sources'

const navigation: { label: View; icon: string }[] = [
  { label: 'Overview', icon: '◫' },
  { label: 'Predictions', icon: '⌁' },
  { label: 'Ticket Builder', icon: '▤' },
  { label: 'Performance', icon: '↗' },
  { label: 'Data Sources', icon: '◉' },
]

const sports: Sport[] = ['All sports', 'Football', 'Basketball', 'Tennis']

function App() {
  const [activeView, setActiveView] = useState<View>('Overview')
  const [activeSport, setActiveSport] = useState<Sport>('All sports')
  const [activeSession, setActiveSession] = useState<Session>('Daytime')
  const [menuOpen, setMenuOpen] = useState(false)

  const selectView = (view: View) => {
    setActiveView(view)
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">S<span>.</span></div>
          <div>
            <div className="brand-name">SMART<span>SPORTS</span></div>
            <div className="brand-caption">INTELLIGENCE PLATFORM</div>
          </div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activeView === item.label ? 'active' : ''}`}
              onClick={() => selectView(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === 'Ticket Builder' && <span className="nav-tag">NEW</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />
        <div className="workspace-label">SPORTS</div>
        <div className="sport-shortcuts">
          {sports.slice(1).map((sport) => (
            <button
              key={sport}
              className={`sport-shortcut ${activeSport === sport ? 'selected' : ''}`}
              onClick={() => {
                setActiveSport(sport)
                setActiveView('Predictions')
                setMenuOpen(false)
              }}
            >
              <span className={`sport-dot ${sport.toLowerCase()}`} />
              {sport}
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="system-card">
            <div className="system-card-top">
              <span className="status-indicator offline" />
              <span>System status</span>
            </div>
            <strong>Awaiting data connection</strong>
            <p>Prediction services are not yet connected.</p>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">SS</div>
            <div className="profile-info">
              <strong>SmartSports AI</strong>
              <span>Private workspace</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation">☰</button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{activeView}</strong></div>
          </div>
          <div className="topbar-right">
            <div className="environment-pill"><span className="status-indicator offline" /> DATA OFFLINE</div>
            <button className="icon-button" title="Notifications" aria-label="Notifications">♧</button>
            <div className="top-avatar">SS</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> SPORTS INTELLIGENCE / CONTROL CENTRE</div>
              <h1>{activeView === 'Overview' ? 'Good to see you.' : activeView}</h1>
              <p className="page-subtitle">
                {activeView === 'Overview'
                  ? 'Your sports analysis workspace. Evidence first, predictions second.'
                  : `Manage and review your ${activeView.toLowerCase()} workspace.`}
              </p>
            </div>
            <div className="date-chip"><span>◷</span> {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </section>

          <section className="notice-bar">
            <span className="notice-icon">i</span>
            <div>
              <strong>Data providers are not connected yet</strong>
              <p>This workspace is in setup mode. No live fixtures, odds or predictions are being displayed.</p>
            </div>
            <button onClick={() => selectView('Data Sources')}>Configure sources <span>→</span></button>
          </section>

          <section className="section-heading">
            <div>
              <h2>Intelligence overview</h2>
              <p>Live system metrics will appear here after verified data connections are configured.</p>
            </div>
            <div className="sport-filter" aria-label="Filter by sport">
              {sports.map((sport) => (
                <button
                  key={sport}
                  className={activeSport === sport ? 'filter-active' : ''}
                  onClick={() => setActiveSport(sport)}
                >
                  {sport}
                </button>
              ))}
            </div>
          </section>

          <section className="metrics-grid">
            <MetricCard label="Verified fixtures" value="—" detail="Awaiting provider connection" icon="◷" />
            <MetricCard label="Analysed events" value="—" detail="No analysis run yet" icon="⌁" />
            <MetricCard label="Qualified selections" value="—" detail="No selections generated" icon="◎" />
            <MetricCard label="Settled predictions" value="—" detail="No results recorded" icon="↗" />
          </section>

          <section className="content-grid">
            <div className="panel ticket-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">TICKET WORKSPACE</div>
                  <h2>Ticket sessions</h2>
                  <p>Separate schedules and selection rules for each session.</p>
                </div>
                <span className="panel-icon">▤</span>
              </div>

              <div className="session-tabs">
                <button className={activeSession === 'Daytime' ? 'session-active' : ''} onClick={() => setActiveSession('Daytime')}>
                  <span className="session-symbol">☀</span> Daytime
                </button>
                <button className={activeSession === 'Overnight' ? 'session-active' : ''} onClick={() => setActiveSession('Overnight')}>
                  <span className="session-symbol">☾</span> Overnight
                </button>
              </div>

              <div className="session-summary">
                <div>
                  <span className="muted-label">SESSION</span>
                  <strong>{activeSession === 'Daytime' ? 'Daytime selections' : 'Overnight selections'}</strong>
                </div>
                <span className="status-pill pending">NOT GENERATED</span>
              </div>

              {activeSession === 'Daytime' ? (
                <div className="ticket-targets">
                  <div className="ticket-target">
                    <div><strong>Standard tickets</strong><span>3 tickets · target combined odds 2,000+</span></div>
                    <span className="target-number">03</span>
                  </div>
                  <div className="ticket-target">
                    <div><strong>Mega tickets</strong><span>2 tickets · target up to 5,000,000</span></div>
                    <span className="target-number">02</span>
                  </div>
                  <div className="session-rule">All selected events must finish by 10:00 PM WAT, with 11:00 PM as the absolute latest.</div>
                </div>
              ) : (
                <div className="ticket-targets">
                  <div className="ticket-target">
                    <div><strong>Overnight tickets</strong><span>2–3 tickets · minimum 12 selections each</span></div>
                    <span className="target-number">02–03</span>
                  </div>
                  <div className="ticket-target">
                    <div><strong>Combined odds target</strong><span>At least 2,000 per qualifying ticket</span></div>
                    <span className="target-number">2K+</span>
                  </div>
                  <div className="session-rule">Eligible start times: 11:00 PM to 7:00 AM WAT, with limited extensions when justified.</div>
                </div>
              )}

              <button className="primary-button" onClick={() => selectView('Ticket Builder')}>
                Open ticket builder <span>→</span>
              </button>
              <p className="panel-footnote">Targets are constraints, not permission to include weak or unverified selections.</p>
            </div>

            <div className="panel data-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">DATA INTEGRITY</div>
                  <h2>Source health</h2>
                  <p>Provider connection and verification status.</p>
                </div>
                <span className="panel-icon">◉</span>
              </div>
              <div className="source-list">
                <SourceRow name="Football data" detail="Fixtures · results · statistics" />
                <SourceRow name="Basketball data" detail="Fixtures · results · statistics" />
                <SourceRow name="Tennis data" detail="Draws · results · player statistics" />
                <SourceRow name="SportyBet markets" detail="Odds · markets · outcomes" />
              </div>
              <button className="secondary-button" onClick={() => selectView('Data Sources')}>Manage data sources <span>→</span></button>
            </div>
          </section>

          <section className="bottom-grid">
            <div className="panel activity-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <div className="panel-kicker">RECENT ACTIVITY</div>
                  <h2>System activity</h2>
                </div>
                <span className="live-label"><span className="status-indicator offline" /> IDLE</span>
              </div>
              <div className="empty-state">
                <div className="empty-icon">⌁</div>
                <strong>No activity recorded</strong>
                <p>Provider checks, analysis runs and ticket events will be logged here.</p>
              </div>
            </div>

            <div className="panel integrity-panel">
              <div className="panel-heading compact-heading">
                <div>
                  <div className="panel-kicker">MODEL GOVERNANCE</div>
                  <h2>Prediction integrity</h2>
                </div>
                <span className="panel-icon">⌘</span>
              </div>
              <div className="integrity-item"><span className="integrity-check">✓</span><div><strong>No fabricated data</strong><p>Unverified information must never be presented as fact.</p></div></div>
              <div className="integrity-item"><span className="integrity-check">✓</span><div><strong>Uncertainty is visible</strong><p>Probability estimates will include confidence and evidence.</p></div></div>
              <div className="integrity-item"><span className="integrity-check">✓</span><div><strong>Duplicates are controlled</strong><p>The same fixture should not be repeated across tickets.</p></div></div>
            </div>
          </section>

          <footer className="footer">
            <span>SMARTSPORTS AI <span className="footer-separator">/</span> PRIVATE SPORTS INTELLIGENCE</span>
            <span>BUILD 0.1.0 <span className="footer-separator">·</span> SETUP MODE</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail"><span className="status-indicator offline" />{detail}</div>
    </div>
  )
}

function SourceRow({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="source-row">
      <div className="source-symbol">◌</div>
      <div className="source-copy"><strong>{name}</strong><span>{detail}</span></div>
      <span className="source-status"><span className="status-indicator offline" /> Not connected</span>
    </div>
  )
}

export default App
