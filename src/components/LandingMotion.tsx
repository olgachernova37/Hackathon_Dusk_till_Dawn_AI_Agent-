"use client";

import { useEffect } from "react";

/**
 * Finishes the landing entrance animations. Each `[data-appear]` element (and
 * the hero video) gets `data-in` once its own animation ends, which drops the
 * animation and pins the final state. If no animation is running at all
 * (unsupported, disabled, reduced motion), everything is marked in at once.
 * With reduced motion requested, the background video keeps playing at half
 * speed instead of freezing on its first frame. If the video cannot play at
 * all, the root gets `data-video-failed` and the large gold infinity mark is
 * shown in its place.
 */
export default function LandingMotion() {
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>("video[data-hero-video]");
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-appear]"));
    const targets: Element[] = video ? [...elements, video] : elements;
    const markIn = (el: Element) => el.setAttribute("data-in", "");

    // Not `{ once: true }`: a child's animation (the badge star, the serif
    // word) bubbles up first and would consume a one-shot listener.
    const listeners = targets.map((el) => {
      const onEnd = (event: Event) => {
        if (event.target !== el) return;
        markIn(el);
        el.removeEventListener("animationend", onEnd);
      };
      el.addEventListener("animationend", onEnd);
      return () => el.removeEventListener("animationend", onEnd);
    });

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (typeof document.getAnimations !== "function") return;
        const animating = targets.some((el) =>
          el.getAnimations().some((a) => a.playState === "running" || a.playState === "finished"),
        );
        if (!animating) targets.forEach(markIn);
      });
    });

    // The error can fire before hydration, so check the current state as well.
    const onVideoError = () => video?.parentElement?.setAttribute("data-video-failed", "");
    video?.addEventListener("error", onVideoError);
    if (video?.error) onVideoError();

    if (video) {
      // Reduced motion: keep the slow ambient wave, just calmer, rather than
      // freezing it - a frozen first frame reads as "the animation is broken".
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.playbackRate = 0.5;
      // Some mobile browsers (battery or data saver) skip the autoPlay attribute
      // but still allow a script-initiated play() for a muted, inline video.
      void video.play().catch(() => {});
    }

    return () => {
      listeners.forEach((remove) => remove());
      video?.removeEventListener("error", onVideoError);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  return null;
}
