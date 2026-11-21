"use client";

import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & { value: string };

/** A textarea that grows to fit its content, like a notebook cell. */
export function AutoTextarea({ value, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(resize, [value]);

  useEffect(() => {
    // Wrapping changes with width, and web fonts change it once loaded.
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        resize();
      }
    });
    observer.observe(el);
    document.fonts?.ready.then(resize).catch(() => {});
    return () => observer.disconnect();
  }, []);

  return <textarea ref={ref} value={value} rows={1} {...rest} />;
}
