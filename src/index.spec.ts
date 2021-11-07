import { HttpMethod } from "./Route";
import { route, initialize, currentRouteName } from "./index";

describe("laravel-ziggy-client", () => {
  beforeAll(() => {
    initialize({
      baseDomain: "www.example.com",
      baseProtocol: "https",
      baseUrl: "https://www.example.com",
      defaultParameters: [],
      routes: {
        test: {
          uri: "test",
          methods: [HttpMethod.GET, HttpMethod.HEAD],
        },
      },
    });
  });

  it("should be able to generate urls from name", () => {
    const result = route("test");

    expect(result).toBe("/test");
  });

  it("should be able to retrieve the current route name", () => {
    //@ts-ignore
    delete window.location;
    //@ts-ignore
    window.location = new URL("https://www.example.com/test?q1=a&q2=b");

    const result = currentRouteName();

    expect(result).toBe("test");
  });
});
