import Route, { HttpMethod } from "./Route";
import Router, { RouterConfig } from "./Router";

const testConfig: RouterConfig = {
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
};

describe("Router", () => {
  it("should be initialized with the passed configuration", () => {
    const result = Router.initialize({ ...testConfig });

    expect(result).toBeInstanceOf(Router);
  });

  it("should be able to parse and identify the current url", () => {
    //@ts-ignore
    delete window.location;
    //@ts-ignore
    window.location = new URL(
      "https://www.example.com/test/param-1/param-2?q1=a&q2=b"
    );

    const router = Router.initialize({
      ...testConfig,
      routes: {
        correct: {
          uri: "test/{param1}/{param2}",
          methods: [HttpMethod.GET],
        },
        wrong: {
          uri: "test",
          methods: [HttpMethod.GET],
        },
      },
    });

    const result = router.current();

    expect(result).toBeInstanceOf(Route);
    expect(result?.name()).toBe("correct");
  });

  describe("parsing", () => {
    it("should be able to parse a url and return the associated route", () => {
      const router = Router.initialize({
        ...testConfig,
        routes: {
          correct: {
            uri: "test/{param1}/{param2}",
            methods: [HttpMethod.GET],
          },
          wrong: {
            uri: "test",
            methods: [HttpMethod.GET],
          },
        },
      });

      const result = router.parse(
        "/test/param-1/param-2?q1=a&q2=b&bool=1&arr[0]=1&arr[1]=2"
      );

      expect(result).toBeInstanceOf(Route);
      expect(result?.name()).toBe("correct");
    });

    it("it should fail parsing the current url if the location string is empty", () => {
      const error = jest.spyOn(console, "error").mockImplementation(() => {});
      //@ts-ignore
      delete window.location;

      const router = Router.initialize({
        ...testConfig,
        routes: {
          correct: {
            uri: "test/{param1}/{param2}",
            methods: [HttpMethod.GET],
          },
          wrong: {
            uri: "test",
            methods: [HttpMethod.GET],
          },
        },
      });

      const result = router.current();

      expect(result).toBeNull();
      expect(error).toBeCalledTimes(1);
    });

    it("should return null if the current url is not defined", () => {
      //@ts-ignore
      delete window.location;
      //@ts-ignore
      window.location = new URL(
        "https://www.example.com/someroute/param-1/param-2?q1=a&q2=b"
      );

      //@ts-ignore
      delete window.location;

      const router = Router.initialize({
        ...testConfig,
        routes: {
          correct: {
            uri: "test/{param1}/{param2}",
            methods: [HttpMethod.GET],
          },
        },
      });

      const result = router.current();

      expect(result).toBeNull();
    });
  });

  it("should be able to generate a route given its name", () => {
    const router = Router.initialize({
      ...testConfig,
      routes: {
        correct: {
          uri: "test/{param1}/{param2}",
          methods: [HttpMethod.GET],
        },
        wrong: {
          uri: "test",
          methods: [HttpMethod.GET],
        },
      },
    });

    const result = router.compile("correct", {
      param1: "param-1",
      param2: "param-2",
      q1: "a",
      q2: "b",
      arr: [1, 2, 3],
      bool: true,
    });

    expect(result).toBe(
      "/test/param-1/param-2?q1=a&q2=b&arr[0]=1&arr[1]=2&arr[2]=3&bool=1"
    );
  });

  it("should fail to generate a route if it is not defined", () => {
    const router = Router.initialize({
      ...testConfig,
      routes: {
        correct: {
          uri: "test/{param1}/{param2}",
          methods: [HttpMethod.GET],
        },
      },
    });

    const result = () =>
      router.compile("wrong", {
        param1: "param-1",
        param2: "param-2",
        q1: "a",
        q2: "b",
        arr: [1, 2, 3],
        bool: true,
      });

    expect(result).toThrowError();
  });
});
