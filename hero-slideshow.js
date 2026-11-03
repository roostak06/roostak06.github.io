(() => {
  "use strict";

  const hero = document.querySelector(".hero");
  const layer = hero && hero.querySelector(".hero-slideshow");
  if (!layer) return;

  const images = [
    "./assets/hero-village-1.webp",
    "./assets/hero-village-2.webp",
    "./assets/hero-village-3.webp",
    "./assets/hero-village-4.webp"
  ];
  const intervalMs = 60 * 1000;
  const fadeMs = 1400;
  let current = 0;

  // Preload all backgrounds to avoid blank flashes during transitions.
  images.forEach((src) => {
    const image = new Image();
    image.src = src;
  });

  window.setInterval(() => {
    current = (current + 1) % images.length;
    layer.style.opacity = "0";

    window.setTimeout(() => {
      layer.style.backgroundImage =
        `linear-gradient(90deg,rgba(248,247,239,.72),rgba(248,247,239,.48)),url("${images[current]}")`;
      layer.style.opacity = "1";
    }, fadeMs);
  }, intervalMs);
})();
