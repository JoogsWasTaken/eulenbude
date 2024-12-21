const owl = document.querySelector(".owl-btn");
const owlCounter = document.querySelector(".owl-counter");
const owlCounterTimes = document.querySelector(".owl-counter-value");

const owlPatKey = "patCountOwl";
const displayHideMillis = 5000;

const displayActiveClassName = "owl-counter-active";

let displayTimeout = null;

const getPats = () => {
  const countStr = localStorage.getItem(owlPatKey);

  if (countStr != null) {
    try {
      return parseInt(countStr, 10);
    } catch (e) {}
  }

  return 0;
};

const setPats = (patCount) => {
  localStorage.setItem(owlPatKey, `${patCount}`);
};

const updatePatDisplay = () => {
  const patCount = getPats();

  owlCounterTimes.textContent = `${patCount.toLocaleString("en")}`;
};

const hidePatDisplay = () => {
  owlCounter.classList.remove(displayActiveClassName);
};

const showPatDisplay = () => {
  if (displayTimeout) {
    window.clearTimeout(displayTimeout);
  }

  displayTimeout = window.setTimeout(hidePatDisplay, displayHideMillis);
  owlCounter.classList.add(displayActiveClassName);
};

owl.addEventListener("click", () => {
  setPats(getPats() + 1);
  updatePatDisplay();
  showPatDisplay();
});
