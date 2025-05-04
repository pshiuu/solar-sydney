import { onReady } from "@xatom/core";
import { initRoutes } from "./routes";
import { initFaqAccordion } from "./modules/faq";

onReady(() => {
  initFaqAccordion();
  initRoutes();
});
