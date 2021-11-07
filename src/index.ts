import Router, { RouterConfig } from "./Router";

let currentRouter: Router;

export const route = (
  name: string,
  params: object | null = null,
  absolute: Boolean = false
): string | null => {
  ensureRouterIsInitialized();

  return currentRouter?.compile(name, params, absolute).toString();
};

export const currentRouteName = (): string | undefined | null => {
  ensureRouterIsInitialized();

  return currentRouter?.current()?.name();
};

export const initialize = (config: RouterConfig) =>
  (currentRouter = Router.initialize(config));

function ensureRouterIsInitialized() {
  if (!currentRouter) {
    console.error(
      "Router not initialized, make sure you called the initialize function before parsing urls"
    );
  }
}
