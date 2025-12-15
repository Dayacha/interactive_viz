// scroll controller for the scrollytelling experience

let scrollObserver = null;
let activeStep = null;


// initialize scroll behavior

function init_scroll() {

  // clean previous observer (needed when charts reload)
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  const steps = document.querySelectorAll(".step");
  activeStep = null;

  if (!steps.length) {
    console.warn("no steps found for scrollytelling");
    return;
  }

  // threshold adjusts for small screens so steps trigger sooner
  const isWide = window.innerWidth > 900;
  const threshold = isWide ? 0.55 : 0.12;
  const rootMargin = isWide ? "0px 0px -20% 0px" : "0px 0px -10% 0px";

  scrollObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {

        if (!entry.isIntersecting) return;

        const stepElem = entry.target;
        const stepNum = Number(stepElem.dataset.step);

        // avoid duplicate triggers
        if (activeStep === stepNum) return;
        activeStep = stepNum;

        // highlight active step
        steps.forEach(s => s.classList.remove("is-active"));
        stepElem.classList.add("is-active");

        // fade in effect
        stepElem.style.opacity = 0;
        stepElem.style.transition = "opacity 0.4s ease-out";
        requestAnimationFrame(() => {
          stepElem.style.opacity = 1;
        });

        // update narrative or visuals (user-defined)
        if (typeof updateChart === "function") {
          updateChart(stepNum);
        }

        // simple logs by section
        const parentSection = stepElem.closest("section")?.id;

        if (parentSection === "flows") {
          console.log("entered migration flows section");
        }
        if (parentSection === "migration") {
          console.log("entered top-5 partners section");
        }
        if (parentSection === "map") {
          console.log("entered global map section");
        }
      });
    },
    { threshold, rootMargin }
  );

  // observe all steps
  steps.forEach(step => scrollObserver.observe(step));

  console.log("scroll system initialized with", steps.length, "steps");
}


// export globally
window.init_scroll = init_scroll;

