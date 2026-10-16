export function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
