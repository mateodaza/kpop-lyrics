export async function readChatJson(request: Request, maxBytes: number): Promise<{ value: unknown; tooLarge: boolean }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { value: null, tooLarge: true };
  if (!request.body) return { value: null, tooLarge: false };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { value: null, tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { value: JSON.parse(text), tooLarge: false };
  } catch {
    return { value: null, tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}
