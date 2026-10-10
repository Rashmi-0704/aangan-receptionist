"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  { src: "/interiors/living-room.jpg", label: "Living room" },
  { src: "/interiors/staircase.jpg", label: "Staircase" },
  { src: "/interiors/kitchen.jpg", label: "Kitchen" },
  { src: "/interiors/living-sofa.jpg", label: "Lounge" },
  { src: "/interiors/bedroom.jpg", label: "Bedroom" },
  { src: "/interiors/hallway.jpg", label: "Gallery" },
  { src: "/interiors/lounge.jpg", label: "Reading corner" },
];
const INTERVAL_MS = 7000;

/** Full-bleed crossfading interior photos behind the dashboard. Pausable (WCAG 2.2.2). */
export function BackgroundSlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("aangan-slideshow-paused") === "1") setPaused(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (paused) return;
    const tick = () => {
      if (!document.hidden) setIndex((i) => (i + 1) % SLIDES.length);
    };
    const id = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  function togglePause() {
    setPaused((p) => {
      try { localStorage.setItem("aangan-slideshow-paused", p ? "0" : "1"); } catch {}
      return !p;
    });
  }

  return (
    <>
      <div className="slideshow" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <div
            key={s.src}
            className={`slide${i === index ? " is-active" : ""}`}
            style={{ backgroundImage: `url(${s.src})` }}
          />
        ))}
        <div className="slideshow-scrim" />
      </div>
      <div className="slide-caption">
        <span className="slide-caption-label">{SLIDES[index].label}</span>
        <span className="slide-dots" aria-hidden="true">
          {SLIDES.map((s, i) => <span key={s.src} className={i === index ? "on" : ""} />)}
        </span>
        <button className="slide-pause" onClick={togglePause} aria-label={paused ? "Play background slideshow" : "Pause background slideshow"}>
          {paused ? (
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" /></svg>
          )}
        </button>
      </div>
    </>
  );
}
