export function isTrustedMutationOrigin(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("referer");

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function isMatchingCsrfToken({
  expected,
  provided,
}: {
  expected: string;
  provided: FormDataEntryValue | null;
}) {
  return typeof provided === "string" && provided.length > 0 && provided === expected;
}
