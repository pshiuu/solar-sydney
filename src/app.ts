import { onReady } from "@xatom/core";
import { helloWorldRoutes } from "./routes";
import { initFaqAccordion } from "./modules/faq";
import "./modules/muti-step-form";

onReady(() => {
  helloWorldRoutes();
  initFaqAccordion();
});
