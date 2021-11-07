import { RouterConfig } from "./Router";
import { stringify } from "query-string";

type ParameterSegment = {
  name: string;
  required: Boolean;
};

type BaseParams = string | number | Array<any> | object;

export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  HEAD = "HEAD",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export type RouteDefinition = {
  uri: string;
  domain?: string | null;
  methods: Array<HttpMethod>;
  bindings?: {
    [name: string]: any;
  };
};

export default class Route {
  constructor(
    private routeName: string,
    private definition: RouteDefinition,
    private config: RouterConfig
  ) {}

  name() {
    return this.routeName;
  }

  toString() {
    return "/haha";
  }

  get origin(): string {
    let origin = "";

    if (this.config.absolute) {
      origin = this.config.baseUrl;

      if (this.definition.domain) {
        origin = `${this.config.baseUrl.match(/^\w+:\/\//)?.[0]}${
          this.definition.domain
        }${this.config.basePort ? `:${this.config.basePort}` : ""}`;
      }
    }

    return origin;
  }

  /**
   * Get a 'template' of the complete URL for this route.
   *
   * @example
   * https://{team}.ziggy.dev/user/{user}
   */
  get template(): string {
    return `${this.origin}/${this.definition.uri}`.replace(/\/+$/, "");
  }

  /**
   * Get an array of objects representing the parameters that this route accepts.
   *
   * @example
   * [{ name: 'team', required: true }, { name: 'user', required: false }]
   */
  get parameterSegments(): ParameterSegment[] {
    return (
      this.template.match(/{[^}?]+\??}/g)?.map((segment) => ({
        name: segment.replace(/{|\??}/g, ""),
        required: !/\?}$/.test(segment),
      })) ?? []
    );
  }

  get pattern(): string {
    // Transform the route's template into a regex that will match a hydrated URL,
    // by replacing its parameter segments with matchers for parameter values
    return (
      this.template
        .replace(/\/{[^}?]*\?}/g, "(/[^/?]+)?")
        // TODO: the above line with the leading slash is necessary to pick up completely optional *segments*,
        // like in `/pages/{subPage?}`, so that those are handled first before the more permissive patterns
        // below, but there's probably a way to do this in one shot
        .replace(/{[^}?]*\?}/g, "([^/?]+)?")
        .replace(/{[^}]+}/g, "[^/?]+")
        .replace(/^\w+:\/\//, "")
    );
  }

  matchesUrl(url: string): Boolean {
    if (!this.definition.methods.includes(HttpMethod.GET)) return false;

    let replaced: string = url.replace(/\/+$/, "").split("?").shift() ?? "";

    return new RegExp(`^${this.pattern}$`).test(replaced);
  }

  compile(
    params: string | number | Array<any> | object | null,
    absolute: Boolean = false
  ): string {
    const segmentParams = this.parameterSegments.map(({ name }) => name);
    const parsedParams: { [name: string]: any } = Object.entries(
      this.parseParams(params ?? {}) ?? {}
    ).reduce((collection, [name, value]: [string, any]) => {
      if (!segmentParams.includes(name)) {
        return collection;
      }

      return { ...collection, [name]: value };
    }, {});
    let queryStringParams = {};

    if (typeof params === "object") {
      queryStringParams = Object.entries(params as object).reduce(
        (collection: object, [name, value]: [string, any]) => {
          if (segmentParams.includes(name)) {
            return collection;
          }

          if (typeof value === "boolean") {
            value = Number(value);
          }

          return { ...collection, [name]: value };
        },
        {}
      );
    }

    if (!this.parameterSegments.length) return this.template;

    const baseUrl = this.template
      .replace(/{([^}?]+)\??}/g, (_, segment: string) => {
        // If the parameter is missing but is not optional, throw an error
        if (
          [null, undefined].includes(parsedParams[segment]) &&
          this.parameterSegments.find(({ name }) => name === segment)?.required
        ) {
          throw new Error(
            `Ziggy error: '${segment}' parameter is required for route '${this.name()}'.`
          );
        }

        return encodeURIComponent(parsedParams[segment] ?? "");
      })
      .replace(/\/+$/, "");

    if (!Object.keys(queryStringParams).length) {
      return baseUrl;
    }

    const queryString = stringify(queryStringParams, {
      arrayFormat: "index",
      skipNull: true,
      sort: false,
    });

    return `${baseUrl}?${queryString}`;
  }

  /**
   * Parse Laravel-style route parameters of any type into a normalized object.
   *
   * @example
   * // with route parameter names 'event' and 'venue'
   * _parse(1); // { event: 1 }
   * _parse({ event: 2, venue: 3 }); // { event: 2, venue: 3 }
   * _parse(['Taylor', 'Matt']); // { event: 'Taylor', venue: 'Matt' }
   * _parse([4, { uuid: 56789, name: 'Grand Canyon' }]); // { event: 4, venue: 56789 }
   */
  private parseParams(params: BaseParams): { [name: string]: any } {
    // If `params` is a string or integer, wrap it in an array
    params = ["string", "number"].includes(typeof params) ? [params] : params;

    // Separate segments with and without defaults, and fill in the default values
    const segments: ParameterSegment[] = this.parameterSegments.filter(
      ({ name }) => !this.config.defaultParameters[name]
    );

    let objectParams = {};

    if (Array.isArray(params)) {
      // If the parameters are an array they have to be in order, so we can transform them into
      // an object by keying them with the template segment names in the order they appear
      objectParams = (params as Array<BaseParams>).reduce(
        (result: object, current, i) =>
          !!segments[i]
            ? { ...result, [segments[i].name]: current }
            : { ...result, [current as string]: "" },
        {}
      ) as object;
    } else {
      objectParams = params;

      if (segments.length === 1 && typeof params === "object") {
        objectParams = params as { [name: string]: any };

        objectParams = this.inferSingleSegment(
          objectParams,
          segments[0].name,
          segments
        );
      }
    }

    return {
      ...this.defaults(),
      ...this.substituteBindings(objectParams),
    };
  }

  private defaults() {
    return this.parameterSegments
      .filter(({ name }) => this.config.defaultParameters[name])
      .reduce(
        (result, { name }, i) => ({
          ...result,
          [name]: this.config.defaultParameters[name],
        }),
        {}
      );
  }

  private inferSingleSegment(
    objectParams: { [name: string]: any },
    segmentName: string,
    segments: ParameterSegment[]
  ): { [name: string]: any } {
    const bindings = this.definition.bindings ?? {};
    const firstBindingKey = Object.keys(bindings)[0];

    if (
      !objectParams[segmentName] &&
      (objectParams.hasOwnProperty(bindings[firstBindingKey]) ||
        objectParams.hasOwnProperty("id"))
    ) {
      // If there is only one template segment and `params` is an object, that object is
      // ambiguous—it could contain the parameter key and value, or it could be an object
      // representing just the value (e.g. a model); we can inspect it to find out, and
      // if it's just the parameter value, we can wrap it in an object with its key
      return { [segments[0].name]: objectParams };
    }

    return objectParams;
  }

  /**
   * Substitute Laravel route model bindings in the given parameters.
   *
   * @example
   * _substituteBindings({ post: { id: 4, slug: 'hello-world', title: 'Hello, world!' } }, { bindings: { post: 'slug' } }); // { post: 'hello-world' }
   *
   */
  substituteBindings(params: { [name: string]: any }): { [name: string]: any } {
    return Object.entries(params).reduce((result, [key, value]) => {
      // If the value isn't an object, or if the key isn't a named route parameter,
      // there's nothing to substitute so we return it as-is
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !this.parameterSegments.some(({ name }) => name === key)
      ) {
        return { ...result, [key]: value };
      }

      let bindings = this.definition.bindings ?? {};

      if (!value.hasOwnProperty(bindings?.[key])) {
        if (value.hasOwnProperty("id")) {
          // As a fallback, we still accept an 'id' key not explicitly registered as a binding
          bindings[key] = "id";
        } else {
          throw new Error(
            `Ziggy error: object passed as '${key}' parameter is missing route model binding key '${bindings[key]}'.`
          );
        }
      }

      return { ...result, [key]: value[bindings[key]] };
    }, {});
  }
}
