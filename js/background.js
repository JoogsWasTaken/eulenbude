const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (!prefersReducedMotion) {
  const bgLayerBack = document.querySelector(".bg-layer-back");
  const bgLayerFront = document.querySelector(".bg-layer-front");

  const startY = window.scrollY;
  const scrollFactor = 0.1;
  const parallaxFactor = 0.5;

  const doParallax = () => {
    const offsetY = window.scrollY - startY;

    const layerBackPos = Math.floor(-offsetY * scrollFactor);
    const layerFrontPos = Math.floor(layerBackPos * parallaxFactor);

    bgLayerBack.style.backgroundPositionY = `${layerFrontPos}px`;
    bgLayerFront.style.backgroundPositionY = `${layerBackPos}px`;
  };

  window.addEventListener("scroll", () => {
    doParallax();
  });
}
