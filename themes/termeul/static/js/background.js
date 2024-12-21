const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (!prefersReducedMotion) {
  const bgLayer0 = document.querySelector(".bg-layer-back");
  const bgLayer1 = document.querySelector(".bg-layer-front");

  const startY = window.scrollY;
  const scrollFactor = 0.1;
  const parallaxFactor = 0.5;

  const doParallax = () => {
    const offsetY = window.scrollY - startY;

    const layer1Pos = Math.floor(-offsetY * scrollFactor);
    const layer0Pos = Math.floor(layer1Pos * parallaxFactor);

    bgLayer0.style.backgroundPositionY = `${layer0Pos}px`;
    bgLayer1.style.backgroundPositionY = `${layer1Pos}px`;
  };

  window.addEventListener("scroll", () => {
    doParallax();
  });
}
