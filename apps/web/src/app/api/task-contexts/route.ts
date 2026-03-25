import {
  buildTaskContextCookie,
  createAnonymousTaskContext,
  isTaskContextSigningAvailable,
  parseRequestedMode,
  serializeTaskContext,
} from "../../../task-session.ts";

export async function POST(request: Request) {
  if (!isTaskContextSigningAvailable()) {
    return Response.json(
      {
        error: "task_context_unavailable",
        message:
          "Task context signing is unavailable. Configure TASK_CONTEXT_SECRET before accepting uploads.",
      },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const requestedMode = contentType.includes("application/json")
    ? parseRequestedMode((await request.json()).mode)
    : parseRequestedMode(String((await request.formData()).get("mode")));

  if (!requestedMode) {
    return Response.json(
      {
        error: "unsupported_mode",
        message: "Choose either workbench mode or one-click mode.",
      },
      { status: 400 },
    );
  }

  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/upload", request.url).toString(),
      "set-cookie": buildTaskContextCookie(
        serializeTaskContext(createAnonymousTaskContext(requestedMode)),
      ),
    },
  });
}
