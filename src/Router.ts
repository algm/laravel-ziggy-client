/** @global window */
import Route, { HttpMethod, RouteDefinition } from "./Route";

export type RouterConfig = {
  baseDomain: string;
  basePort?: string | number | null | undefined;
  baseProtocol: string;
  baseUrl: string;
  location?: URL;
  defaultParameters: {
    [name: string]: any;
  };
  routes: {
    [name: string]: RouteDefinition;
  };
  absolute?: Boolean | null | undefined;
};

type Location = {
  host: string;
  pathname: string;
  search: string;
};

export type RouteCollection = {
  [name: string]: Route;
};

export default class Router {
  private readonly routeCollection: RouteCollection;

  constructor(private readonly config: RouterConfig) {
    this.routeCollection = Object.entries(config.routes).reduce(
      (collection, [routeName, definition]: [string, RouteDefinition]) => {
        return {
          ...collection,
          [routeName]: new Route(routeName, definition, config),
        };
      },
      {}
    );
  }

  static initialize(config: RouterConfig): Router {
    return new Router(config);
  }

  current(): Route | null {
    const currentUrlString = this.getCurrentLocationString();

    if (!currentUrlString) {
      console.error("The current method cannot be run in nodejs");

      return null;
    }

    return this.parse(currentUrlString) ?? null;
  }

  private getCurrentLocationString(): string {
    return this.config.absolute
      ? this.location().host + this.location().pathname
      : this.location()
          .pathname.replace(
            this.config.baseUrl.replace(/^\w*:\/\/[^/]+/, ""),
            ""
          )
          .replace(/^\/+/, "/");
  }

  /**
   * Get an object representing the current location (by default this will be
   * the JavaScript `window` global if it's available).
   *
   */
  private location(): Location {
    const { host = "", pathname = "", search = "" } = window?.location ?? {};

    return {
      host: this.config.location?.host ?? host,
      pathname: this.config.location?.pathname ?? pathname,
      search: this.config.location?.search ?? search,
    };
  }

  compile(
    name: string,
    params: object | null,
    absolute: Boolean = false
  ): string {
    const route = this.routeCollection[name] ?? null;

    if (!route) {
      throw new Error(`The route ${name} is not defined in the route list.`);
    }

    return route.compile(params ?? {}, absolute);
  }

  parse(url: string): Route | null {
    // Find the first route that matches the current URL
    const [_, route] = Object.entries(this.routeCollection).find(([_, route]) =>
      route.matchesUrl(url)
    ) ?? [undefined, undefined];

    return route ?? null;
  }
}
