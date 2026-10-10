import { Link, Route, Routes } from 'react-router'

function Home() {
  return (
    <main className="shell">
      <p className="eyebrow">Lottery Stats</p>
      <h1>Hungarian lottery statistics</h1>
      <p>
        The application foundation is ready. Lottery data and statistics are
        planned for a later phase.
      </p>
      <Link to="/about">About this project</Link>
    </main>
  )
}

function About() {
  return (
    <main className="shell">
      <p className="eyebrow">Lottery Stats</p>
      <h1>About</h1>
      <p>
        A future home for statistics based on official Hungarian lottery
        drawings.
      </p>
      <Link to="/">Home</Link>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
    </Routes>
  )
}
