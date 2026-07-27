export function App() {
  return (
    <>
      <div className="app">
        <section className="panel" style={{ ['--i' as string]: 0 }}>
          <header className="panel__head">
            <span className="panel__spark" />
            <h2 className="panel__title">The Watch</h2>
          </header>
          <div className="panel__body">
            <p className="label">the lamps are unlit.</p>
          </div>
        </section>
      </div>
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
