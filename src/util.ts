export function assert(
    condition: unknown,
    message = "Assertion failed!",
): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

export const assertDefined = <T>(
    value: T | undefined,
    message = "Assertion failed!",
): T => {
    assert(value !== undefined, message)
    return value
}

export const unreachable = (
    message = "This area of code should be unreachable! Terminating.",
): never => {
    throw new Error(message)
}

export const sleep = (time: number) =>
    new Promise<void>(resolve => setTimeout(resolve, time))

export const runAsync = (
    f: () => Promise<void>,
    onError: (error: any) => void = console.error,
) => f().catch(onError)
