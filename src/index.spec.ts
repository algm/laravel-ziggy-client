import route from "./index";

describe('laravel-ziggy-client', () => {
    it('should be able to generate urls from name', () => {
        const result = route('test');

        expect(result).toBe("/haha");
    });
})