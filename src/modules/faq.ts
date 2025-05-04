export function initFaqAccordion(): void {
  const accordions = document.querySelectorAll<HTMLElement>(".faq6_accordion");

  accordions.forEach((accordion) => {
    const question = accordion.querySelector<HTMLElement>(".faq6_question");
    const answer = accordion.querySelector<HTMLElement>(".faq6_answer");
    const icon = accordion.querySelector<HTMLElement>(".faq6_icon-wrapper"); // Assuming this is the icon to rotate

    if (!question || !answer || !icon) {
      console.warn("FAQ accordion missing required elements:", accordion);
      return;
    }

    // Initial state: closed
    answer.style.maxHeight = "0";
    answer.style.overflow = "hidden";
    answer.style.transition = "max-height 0.3s ease-out";
    icon.style.transition = "transform 0.3s ease-out";

    question.addEventListener("click", () => {
      const isOpen = accordion.classList.contains("is-open");

      if (isOpen) {
        // Close the accordion
        answer.style.maxHeight = "0";
        icon.style.transform = "rotate(0deg)";
        accordion.classList.remove("is-open");
      } else {
        // Open the accordion
        answer.style.maxHeight = `${answer.scrollHeight}px`;
        icon.style.transform = "rotate(45deg)"; // Rotate icon 45 degrees
        accordion.classList.add("is-open");
      }
    });

    // Recalculate max-height on window resize for open accordions
    window.addEventListener("resize", () => {
      if (accordion.classList.contains("is-open")) {
        // Temporarily remove transition for instant resize
        const originalTransition = answer.style.transition;
        answer.style.transition = "none";

        answer.style.maxHeight = "none"; // Reset maxHeight to get natural height
        const scrollHeight = answer.scrollHeight;
        answer.style.maxHeight = `${scrollHeight}px`;

        // Restore transition after a short delay
        setTimeout(() => {
          answer.style.transition = originalTransition;
        }, 0);
      }
    });
  });
}
