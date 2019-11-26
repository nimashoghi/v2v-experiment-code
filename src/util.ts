export function assert(
    condition: unknown,
    message = "Assertion failed!",
): asserts condition {
    if (!condition) {
        throw new Error(message)
    }
}

export function unreachable(
    message = "This area of code should be unreachable! Terminating.",
): never {
    throw new Error(message)
}

export const sleep = (time: number) =>
    new Promise<void>(resolve => setTimeout(resolve, time))
