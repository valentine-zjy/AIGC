export function getCookieValue(rawCookieHeader: string | null, cookieName: string) {
  if (!rawCookieHeader) {
    return undefined;
  }

  for (const cookiePart of rawCookieHeader.split(";")) {
    const [name, ...valueParts] = cookiePart.trim().split("=");

    if (name === cookieName) {
      return valueParts.join("=");
    }
  }

  return undefined;
}
