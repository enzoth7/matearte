"use client";

// Adapted for MateArte from @piyushxdev/interactive-video-portfolio-scroller on 21st.dev.
import { Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { presentationMedia } from "@/data/catalog";

export function MateArteVideoStory() {
  const items = presentationMedia.videos;
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(sectionRef, { amount: 0.18 });
  const reduceMotion = useReducedMotion();
  const active = items[activeIndex];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!inView || reduceMotion) {
      video.pause();
      return;
    }

    video.muted = true;
    let cancelled = false;
    video.play()
      .then(() => {
        if (cancelled) return;
        setMuted(true);
        setPlaying(true);
      })
      .catch(() => {
        if (!cancelled) setPlaying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeIndex, inView, reduceMotion]);

  function selectItem(index: number) {
    videoRef.current?.pause();
    setPlaying(false);
    setMuted(true);
    setActiveIndex(index);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  }

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[var(--ink)] text-[var(--paper)]" aria-labelledby="video-story-title">
      <div className="container-shell pt-20 md:pt-28">
        <p className="eyebrow text-[var(--rawhide)]">Archivo audiovisual</p>
        <div className="mt-7 flex items-start gap-5 md:items-end md:gap-10">
          <h2 id="video-story-title" className="display-lg max-w-[50rem]">Historias que se ven en movimiento.</h2>
          <Image
            src={presentationMedia.footballAssociationLogo.src}
            alt={presentationMedia.footballAssociationLogo.alt}
            width={presentationMedia.footballAssociationLogo.width}
            height={presentationMedia.footballAssociationLogo.height}
            className="h-20 w-auto shrink-0 object-contain md:h-28"
          />
        </div>
        <p className="mt-7 max-w-2xl text-base leading-8 text-white/68">Tres miradas al oficio, la personalización y el vínculo de MateArte con la cultura uruguaya.</p>
      </div>

      <div className="container-shell grid min-h-[54rem] items-stretch gap-10 pb-20 pt-14 lg:grid-cols-12 lg:gap-0 lg:pb-0">
        <div className="min-w-0 flex flex-col justify-center lg:col-span-5 lg:pr-16">
          <div role="tablist" aria-label="Historias audiovisuales" className="grid grid-cols-3 border-t border-white/18 lg:block lg:border-t-0">
            {items.map((item, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`video-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls="video-story-panel"
                  onClick={() => selectItem(index)}
                  className={`group grid min-h-14 w-full place-items-center border-b border-white/18 py-3 text-center transition-colors duration-200 lg:min-h-24 lg:grid-cols-[2.25rem_1fr] lg:place-items-stretch lg:items-center lg:gap-4 lg:border-t lg:py-5 lg:text-left ${selected ? "text-white" : "text-white/42 hover:text-white/72"}`}
                >
                  <span className={`text-xs tracking-[0.18em] transition-colors ${selected ? "text-[var(--rawhide)]" : "text-current"}`}>0{index + 1}</span>
                  <span className="display-font hidden text-2xl leading-tight lg:block lg:text-3xl">{item.title}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-8 hidden max-w-md text-xs leading-6 text-white/48 lg:block">Material provisto para esta presentación. Jugadores, AUF, marcas y piezas vinculadas requieren validación antes de la publicación final.</p>
        </div>

        <div id="video-story-panel" role="tabpanel" aria-labelledby={`video-tab-${active.id}`} className="relative min-h-[42rem] overflow-hidden lg:col-span-7 lg:min-h-[54rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              className="absolute inset-0"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.025 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <video
                ref={videoRef}
                src={active.src}
                poster={active.poster}
                autoPlay={!reduceMotion}
                muted={muted}
                playsInline
                preload="metadata"
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onEnded={() => setPlaying(false)}
                className="h-full w-full object-cover"
                aria-label={`${active.eyebrow}: ${active.title}`}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(23,19,15,.5),transparent_35%),linear-gradient(0deg,rgba(23,19,15,.88),transparent_48%)]" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-10">
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rawhide)] uppercase">{active.eyebrow}</p>
                <p className="display-font mt-3 max-w-xl text-3xl leading-tight text-white md:text-4xl">{active.title}</p>
                <p className="mt-3 max-w-lg text-base leading-7 text-white/72">{active.description}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="absolute right-5 top-5 z-20 flex gap-2 md:right-8 md:top-8">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-sm border border-white/35 bg-[color:rgb(23_19_15_/_0.68)] text-white backdrop-blur-sm transition-colors hover:border-[var(--rawhide)] hover:bg-[var(--walnut)]"
              onClick={togglePlayback}
              aria-label={playing ? "Pausar video" : "Reproducir video"}
            >
              {playing ? <Pause size={19} weight="fill" aria-hidden="true" /> : <Play size={19} weight="fill" aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-sm border border-white/35 bg-[color:rgb(23_19_15_/_0.68)] text-white backdrop-blur-sm transition-colors hover:border-[var(--rawhide)] hover:bg-[var(--walnut)]"
              onClick={toggleSound}
              aria-label={muted ? "Activar sonido" : "Silenciar video"}
            >
              {muted ? <SpeakerSlash size={19} aria-hidden="true" /> : <SpeakerHigh size={19} aria-hidden="true" />}
            </button>
          </div>

        </div>
        <p className="text-xs leading-6 text-white/48 lg:hidden">Material provisto para esta presentación. Jugadores, AUF, marcas y piezas vinculadas requieren validación antes de la publicación final.</p>
      </div>
    </section>
  );
}
