export const path = __filename;
export function pepe(a:number, b:number) {
    return a + b;
}
export function pepe2(a:number, b:number) {
    return a + b;
}
export function ignoreNextEmpty(a:number, b:number) {
    const aa = a + 1;
    const bb = b + 1;
    /* coverage ignore next */
    return aa + bb;
}
export function ignoreNextCount(a:number, b:number) {
    const aa = a + 1;
    /* coverage ignore next 2 */
    const bb = b + 1;
    return aa + bb;
}
export function ignoreNextBlock(a:number, b:number) {
    /* coverage disable */
    const aa = a + 1;
    const bb = b + 1;
    /* coverage enable */
    return aa + bb;
}