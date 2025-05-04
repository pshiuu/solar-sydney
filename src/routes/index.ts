import { WFRoute } from "@xatom/core";
import { initHome } from "../pages/home";
import { initQuote } from "../pages/quote";

export const initRoutes = () => {
  new WFRoute("/").execute(() => {
    initHome();
  });
  new WFRoute("/get-solar-quotes").execute(() => {
    initQuote();
  });
};
