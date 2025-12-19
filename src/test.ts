describe("mock test", () => {
  it("mocks", () => {
    const mock = jest.fn();
    mock();
    mock();
    expect(mock.mock.calls).toHaveLength(2);
    mock.mockReturnValue(true);
    mock();
    expect(mock.mock.calls).toHaveLength(3);
    expect(mock.mock.results[2].value).toBe(true);
    mock.mockImplementation(() => false);
    mock();
    expect(mock.mock.calls).toHaveLength(4);
    expect(mock.mock.results[3].value).toBe(false);
  });

  it("to mock functions", () => {
    const obj = {
      method() {
        return true;
      },
    };
    const mock = jest.spyOn(obj, "method").mockReturnValue(false);
    const result = obj.method();
    expect(result).toBe(false);
    expect(mock).toHaveBeenCalled();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls).toHaveLength(1);
    expect(mock.mock.results[0].value).toBe(false);
  });
});
