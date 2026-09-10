// A page that is not moved to the new app yet: says so plainly and points to the demo, where it already works.
export default function Soon({ title, text }: { title: string; text: string }) {
  return (
    <section className="page on">
      <div className="topbar"><h1>{title}</h1></div>
      <div className="scroll">
        <div className="ph">
          <h2>{title}: în lucru în versiunea nouă</h2>
          <p>{text}</p>
          <a className="btn" href="/demo.html" target="_blank" rel="noreferrer">Deschide demo-ul vechi</a>
        </div>
      </div>
    </section>
  );
}
