import { WFRoute } from "@xatom/core";
import { helloWorldFn } from "../modules";

export const helloWorldRoutes = () => {
  new WFRoute("/").execute(helloWorldFn);
};
